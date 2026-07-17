"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, ym, pct } from "../../lib/format";
import {
  METHODS, METHOD_KEYS, seriesFromMatrix, backtest, predictions, champion, forecastForward,
} from "../../lib/forecast";

const TABS = ["Overview", "Accuracy", "Model Lab"];
const METHOD_COLORS = {
  naive: "var(--muted)", ma3: "var(--accent-2)", wma: "var(--accent)",
  trend: "var(--green)", seasonal: "var(--amber)",
};

// ---- compute every SKU's models once (memoized in parent) --------------------
function computeModel(matrixRows) {
  const map = seriesFromMatrix(matrixRows);
  const skus = {};
  let months = [];
  for (const sku in map) {
    const s = map[sku];
    if (s.length < 4) continue;
    const total12 = s.slice(-12).reduce((a, b) => a + b.q, 0);
    if (total12 <= 0) continue;                    // lewati SKU tanpa penjualan
    const methods = {};
    for (const m of METHOD_KEYS) methods[m] = backtest(s, m);
    const champ = champion(s);
    const fwd = {};
    for (const m of METHOD_KEYS) fwd[m] = forecastForward(s, m, { h: 3, skipCurrent: true });
    if (!months.length && fwd.wma.length) months = fwd.wma.map((x) => x.ym);
    skus[sku] = { name: sku, series: s, total12, methods, champ, fwd };
  }
  return { skus, months };
}

const accColor = (a) =>
  a === null ? {} : { color: a >= 80 ? "var(--green)" : a >= 60 ? "var(--amber)" : "var(--red)" };
const trendClass = (t) => (t ? String(t).toLowerCase() : "na");

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCSV(list, months, segMap, valMap) {
  const head = ["SKU", "Type", "ABC (value)", "XYZ", "Trend", "Champion Model", "Accuracy_%",
    ...months.map(ym), "Total 3-mo"];
  const rows = [...list].sort((a, b) => b.total12 - a.total12).map((x) => {
    const sg = segMap[x.name] || {};
    const acc = x.champ.wmape === null ? "" : (100 - x.champ.wmape).toFixed(1);
    const f = x.fwd[x.champ.method];
    const tot3 = f.reduce((s, p) => s + p.q, 0);
    return [x.name, sg.type || "", valMap[x.name] || "", sg.xyz_class || "", sg.trend || "",
      METHODS[x.champ.method].label, acc, ...f.map((p) => p.q), tot3];
  });
  const csv = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `forecast_all_sku_${stamp}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function ForecastClient({ matrix, seg, val, meta, live = [], liveDetail = [], liveErr = null }) {
  const [tab, setTab] = useState("Overview");
  const { skus, months } = useMemo(() => computeModel(matrix), [matrix]);
  const segMap = useMemo(() => {
    const m = {}; for (const r of seg) m[r.sku_name] = r; return m;
  }, [seg]);
  const ranked = useMemo(() => val.filter((v) => skus[v.sku_name]), [val, skus]);
  const valMap = useMemo(() => {
    const m = {}; for (const v of val) m[v.sku_name] = v.abc_tier_value; return m;
  }, [val]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Forecast</h1>
          <div className="page-sub">
            Per-SKU champion model · next 3 complete months
            {months.length ? " (" + months.map(ym).join(" · ") + ")" : ""} · Active FG
          </div>
        </div>
        <button className="btn-export" onClick={() => exportCSV(Object.values(skus), months, segMap, valMap)}>
          ↓ Download full forecast (all SKUs)
        </button>
      </div>

      <div className="gloss-tabs">
        {TABS.map((t) => (
          <button key={t} className={"gloss-pill" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <Overview skus={skus} months={months} segMap={segMap} ranked={ranked} meta={meta} />}
      {tab === "Accuracy" && (
        <Accuracy skus={skus} segMap={segMap} ranked={ranked} months={months}
          meta={meta} live={live} liveDetail={liveDetail} liveErr={liveErr} />
      )}
      {tab === "Model Lab" && <ModelLab skus={skus} months={months} segMap={segMap} ranked={ranked} />}
    </>
  );
}

// ---- Publish official baseline (writes forecast_log via API) -----------------
function PublishBar({ meta }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function publish() {
    if (!window.confirm(
      "Publish forecast baseline hari ini?\n\nAngka dikunci & jadi sumber demand resmi untuk MPS / MRP. Publish ulang di hari yang sama akan menimpa."
    )) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/forecast/publish", { method: "POST" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "failed");
      setMsg("✓ Baseline published " + j.run_date + " · " + fmt(j.skus) + " SKUs · MPS/MRP now use it");
      router.refresh();
    } catch (e) {
      setMsg("✗ " + e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="card publish-bar">
      <div>
        <div className="kpi-label">Official Baseline</div>
        <div style={{ marginTop: 6, fontSize: 14 }}>
          {meta && meta.run_date ? (
            <>Published <b>{meta.run_date}</b> · {fmt(meta.skus)} SKUs locked · feeding MPS / MRP</>
          ) : (
            <span style={{ color: "var(--muted)" }}>
              Not published yet — MPS / MRP currently use the 12-week run-rate. Publish to lock this forecast as the official demand.
            </span>
          )}
        </div>
        {msg && (
          <div style={{ marginTop: 7, fontSize: 13, color: msg[0] === "✓" ? "var(--green)" : "var(--red)" }}>{msg}</div>
        )}
      </div>
      <button className="btn-export" onClick={publish} disabled={busy} style={busy ? { opacity: 0.6 } : {}}>
        {busy ? "Publishing…" : "⤴ Publish baseline"}
      </button>
    </div>
  );
}

// ============================ OVERVIEW =======================================
function Overview({ skus, months, segMap, ranked, meta }) {
  const list = Object.values(skus);
  let ae = 0, tot = 0;
  for (const x of list) { const b = x.methods[x.champ.method]; if (b) { ae += b.ae; tot += b.tot; } }
  const portAcc = tot > 0 ? 100 - (ae / tot) * 100 : null;

  const totalByMonth = months.map((mo, i) => ({
    _lbl: ym(mo),
    total: list.reduce((s, x) => s + (x.fwd[x.champ.method][i]?.q || 0), 0),
  }));

  const mix = {};
  for (const x of list) mix[x.champ.method] = (mix[x.champ.method] || 0) + 1;
  const topMethod = Object.entries(mix).sort((a, b) => b[1] - a[1])[0] || ["wma", 0];

  // SEMUA SKU Continue yang punya forecast: urutan revenue, plus sisanya by volume
  const inRanked = new Set(ranked.map((v) => v.sku_name));
  const extras = list
    .filter((x) => !inRanked.has(x.name))
    .sort((a, b) => b.total12 - a.total12)
    .map((x) => ({ sku_name: x.name, abc_tier_value: null }));
  const rows = [...ranked, ...extras];
  const maxBar = Math.max(1, ...totalByMonth.map((d) => d.total));

  return (
    <>
      <PublishBar meta={meta} />

      <section className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Portfolio Accuracy</div>
          <div className="kpi-value" style={accColor(portAcc)}>{portAcc === null ? "—" : pct(portAcc)}</div>
          <div className="kpi-sub">volume-weighted · backtest · target ≥ 80%</div>
        </div>
        <div className="card">
          <div className="kpi-label">Forecast {months[0] ? ym(months[0]) : ""}</div>
          <div className="kpi-value">{fmt(totalByMonth[0]?.total || 0)}</div>
          <div className="kpi-sub">total units · all SKUs · champion model</div>
        </div>
        <div className="card">
          <div className="kpi-label">SKUs Forecasted</div>
          <div className="kpi-value">{fmt(list.length)}</div>
          <div className="kpi-sub">Active FG · with sales history</div>
        </div>
        <div className="card">
          <div className="kpi-label">Top Champion</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{METHODS[topMethod[0]].label}</div>
          <div className="kpi-sub">{fmt(topMethod[1])} of {fmt(list.length)} SKUs</div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Total Forecast by Month</h2>
        <div className="card-note">total units · all SKUs · each SKU on its own champion model</div>
        <div className="barchart">
          {totalByMonth.map((d, i) => (
            <div className="bar-col" key={i}>
              <div className="bar-val">{fmt(d.total)}</div>
              <div className="bar hl" style={{ height: (d.total / maxBar) * 100 + "%" }} />
              <div className="bar-label">{d._lbl}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Forecast by SKU — All Active SKUs ({fmt(rows.length)})</h2>
        <div className="card-note">every Continue SKU with sales history · sorted by revenue · champion model each · accuracy = 100 − backtest wMAPE</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th><th>ABC</th><th>Trend</th><th>Champion</th>
                {months.map((m) => <th className="num" key={m}>{ym(m)}</th>)}
                <th className="num">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => {
                const x = skus[v.sku_name];
                const sg = segMap[v.sku_name] || {};
                const acc = x.champ.wmape === null ? null : 100 - x.champ.wmape;
                const f = x.fwd[x.champ.method];
                return (
                  <tr key={i}>
                    <td className="name">{v.sku_name}</td>
                    <td><span className={"badge abc-" + String(v.abc_tier_value || "").toLowerCase()}>{v.abc_tier_value || "—"}</span></td>
                    <td><span className={"badge " + trendClass(sg.trend)}>{sg.trend || "—"}</span></td>
                    <td><span className="badge champ">{METHODS[x.champ.method].label}</span></td>
                    {f.map((p, j) => <td className="num" key={j}>{fmt(p.q)}</td>)}
                    <td className="num" style={accColor(acc)}>{acc === null ? "—" : pct(acc)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ============================ LIVE PERFORMANCE ================================
const BAND_STYLE = {
  Under:    { background: "var(--accent-soft)", color: "var(--accent)" },
  Accurate: { background: "var(--green-soft)",  color: "var(--green)" },
  Over:     { background: "var(--amber-soft)",  color: "var(--amber)" },
};
const biasColor = (b) =>
  b == null ? {} : { color: Math.abs(b) <= 10 ? "var(--green)" : Math.abs(b) <= 25 ? "var(--amber)" : "var(--red)" };

function LivePerformance({ live, liveDetail, liveErr, meta, months }) {
  const latestMonth = liveDetail.length ? liveDetail[0].forecast_month : null;
  const misses = latestMonth
    ? liveDetail.filter((r) => r.forecast_month === latestMonth).slice(0, 10)
    : [];

  return (
    <>
      <div className="card">
        <h2 className="card-title">Live Performance — published vs actual</h2>
        <div className="card-note">
          real accuracy of locked baselines · a month is scored automatically once it completes ·
          uses the last baseline published before the month began
        </div>
        {live.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th><th>Baseline run</th><th className="num">SKUs</th>
                  <th className="num">Forecast</th><th className="num">Actual</th>
                  <th className="num">Accuracy</th><th className="num">Bias</th>
                  <th className="num">Under / Acc / Over</th>
                </tr>
              </thead>
              <tbody>
                {live.map((r, i) => (
                  <tr key={i}>
                    <td className="name">{ym(r.forecast_month)}</td>
                    <td>{r.run_date}</td>
                    <td className="num">{fmt(r.skus)}</td>
                    <td className="num">{fmt(r.forecast_total)}</td>
                    <td className="num">{fmt(r.actual_total)}</td>
                    <td className="num" style={accColor(r.accuracy_pct == null ? null : Number(r.accuracy_pct))}>
                      {r.accuracy_pct == null ? "—" : pct(r.accuracy_pct)}
                    </td>
                    <td className="num" style={biasColor(r.bias_pct == null ? null : Number(r.bias_pct))}>
                      {r.bias_pct == null ? "—" : (Number(r.bias_pct) > 0 ? "+" : "") + pct(r.bias_pct)}
                    </td>
                    <td className="num">
                      <span style={{ color: "var(--accent)" }}>{fmt(r.under_count)}</span>
                      {" / "}
                      <span style={{ color: "var(--green)" }}>{fmt(r.accurate_count)}</span>
                      {" / "}
                      <span style={{ color: "var(--amber)" }}>{fmt(r.over_count)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="gloss-empty">
            {liveErr
              ? "Live tracking not active yet — run migration 0029 (v_forecast_vs_actual) in Supabase."
              : meta && meta.run_date
              ? `Baseline published ${meta.run_date} — the first live score lands automatically once ${months[0] ? ym(months[0]) : "the first forecast month"} completes. Nothing to do.`
              : "No baseline published yet — publish one in Overview. Live tracking starts after its first forecast month completes."}
          </div>
        )}
      </div>

      {misses.length > 0 && (
        <div className="card">
          <h2 className="card-title">Biggest Misses — {ym(latestMonth)}</h2>
          <div className="card-note">largest absolute errors in the latest scored month · use these to challenge the model or the plan</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th><th>Model</th><th className="num">Forecast</th><th className="num">Actual</th>
                  <th className="num">Error</th><th className="num">APE</th><th>Band</th>
                </tr>
              </thead>
              <tbody>
                {misses.map((r, i) => (
                  <tr key={i}>
                    <td className="name">{r.sku_name}</td>
                    <td><span className="badge method">{r.method}</span></td>
                    <td className="num">{fmt(r.forecast_qty)}</td>
                    <td className="num">{fmt(r.actual_qty)}</td>
                    <td className="num">{(Number(r.error_qty) > 0 ? "+" : "") + fmt(r.error_qty)}</td>
                    <td className="num">{r.ape_pct == null ? "—" : pct(r.ape_pct)}</td>
                    <td><span className="badge" style={BAND_STYLE[r.band] || {}}>{r.band}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ============================ ACCURACY =======================================
function Accuracy({ skus, segMap, ranked, months, meta, live = [], liveDetail = [], liveErr = null }) {
  const list = Object.values(skus);

  const methodAgg = useMemo(() => METHOD_KEYS.map((m) => {
    let ae = 0, tot = 0, n = 0;
    for (const x of list) { const b = x.methods[m]; if (b && b.tot) { ae += b.ae; tot += b.tot; n += b.nPred; } }
    return { m, wmape: tot > 0 ? (ae / tot) * 100 : null, n };
  }), [skus]);
  const bestWmape = Math.min(...methodAgg.filter((x) => x.wmape !== null).map((x) => x.wmape));

  const mix = {};
  for (const x of list) mix[x.champ.method] = (mix[x.champ.method] || 0) + 1;

  const bias = useMemo(() => {
    let under = 0, acc = 0, over = 0;
    for (const x of list) {
      for (const p of predictions(x.series, x.champ.method)) {
        if (p.a <= 0) continue;
        const r = p.f / p.a;
        if (r < 0.9) under++; else if (r > 1.1) over++; else acc++;
      }
    }
    const t = under + acc + over || 1;
    return { under, acc, over, t };
  }, [skus]);

  const inRanked = new Set(ranked.map((v) => v.sku_name));
  const rows = [
    ...ranked,
    ...list.filter((x) => !inRanked.has(x.name))
      .sort((a, b) => b.total12 - a.total12)
      .map((x) => ({ sku_name: x.name, abc_tier_value: null })),
  ];

  return (
    <>
      <LivePerformance live={live} liveDetail={liveDetail} liveErr={liveErr} meta={meta} months={months} />

      <div className="note-banner">
        <span className="ic">ℹ️</span>
        <div>
          {live.length ? (
            <>
              <b>Method stats below are backtest-based.</b> They rank methods on history (what each{" "}
              <i>would</i> have scored). Real published-vs-actual performance is in the Live Performance card above.
            </>
          ) : (
            <>
              <b>Backtest-based accuracy.</b> Numbers below come from a 1-step-ahead rolling backtest on
              historical sales (what each method <i>would</i> have scored). Live published-vs-actual tracking
              fills the card above automatically once a baseline&apos;s forecast month completes.
            </>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 className="card-title">Accuracy by Method (portfolio)</h2>
          <div className="card-note">volume-weighted wMAPE across all SKUs · lower is better</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Method</th><th className="num">wMAPE</th><th className="num">Accuracy</th><th className="num">Champion of</th></tr></thead>
              <tbody>
                {methodAgg.map((x) => (
                  <tr key={x.m} style={x.wmape === bestWmape ? { fontWeight: 700 } : {}}>
                    <td>
                      <span className="badge method" style={{ color: METHOD_COLORS[x.m] }}>{METHODS[x.m].label}</span>
                    </td>
                    <td className="num">{x.wmape === null ? "—" : pct(x.wmape)}</td>
                    <td className="num" style={accColor(x.wmape === null ? null : 100 - x.wmape)}>
                      {x.wmape === null ? "—" : pct(100 - x.wmape)}
                    </td>
                    <td className="num">{fmt(mix[x.m] || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-note" style={{ marginTop: 12, marginBottom: 0 }}>
            “Champion of” = SKUs where this method wins per-SKU. The portfolio best method is bold, but each
            SKU still uses its own champion.
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Forecast Bias (champion)</h2>
          <div className="card-note">across all backtested SKU-months · ±10% band</div>
          <div className="bias-bar">
            <div className="bias-under" style={{ width: (bias.under / bias.t) * 100 + "%" }}>
              {bias.under / bias.t > 0.08 ? Math.round((bias.under / bias.t) * 100) + "%" : ""}
            </div>
            <div className="bias-acc" style={{ width: (bias.acc / bias.t) * 100 + "%" }}>
              {bias.acc / bias.t > 0.08 ? Math.round((bias.acc / bias.t) * 100) + "%" : ""}
            </div>
            <div className="bias-over" style={{ width: (bias.over / bias.t) * 100 + "%" }}>
              {bias.over / bias.t > 0.08 ? Math.round((bias.over / bias.t) * 100) + "%" : ""}
            </div>
          </div>
          <div className="fc-legend">
            <span style={{ color: "var(--accent)" }}><i />Under-forecast &nbsp;{fmt(bias.under)}</span>
            <span style={{ color: "var(--green)" }}><i />Accurate ±10% &nbsp;{fmt(bias.acc)}</span>
            <span style={{ color: "var(--amber)" }}><i />Over-forecast &nbsp;{fmt(bias.over)}</span>
          </div>
          <div className="card-note" style={{ marginTop: 16, marginBottom: 0 }}>
            Under-forecasting risks stock-outs; over-forecasting ties up working capital. A healthy engine
            sits near the middle with the largest slice Accurate.
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Accuracy by SKU — All Active SKUs ({fmt(rows.length)})</h2>
        <div className="card-note">per-SKU champion backtest · sorted by revenue</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>SKU</th><th>ABC</th><th>XYZ</th><th>Champion</th><th className="num">wMAPE</th><th className="num">Accuracy</th></tr>
            </thead>
            <tbody>
              {rows.map((v, i) => {
                const x = skus[v.sku_name];
                const sg = segMap[v.sku_name] || {};
                const acc = x.champ.wmape === null ? null : 100 - x.champ.wmape;
                return (
                  <tr key={i}>
                    <td className="name">{v.sku_name}</td>
                    <td><span className={"badge abc-" + String(v.abc_tier_value || "").toLowerCase()}>{v.abc_tier_value || "—"}</span></td>
                    <td><span className={"badge xyz-" + trendClass(sg.xyz_class)}>{sg.xyz_class || "—"}</span></td>
                    <td><span className="badge champ">{METHODS[x.champ.method].label}</span></td>
                    <td className="num">{x.champ.wmape === null ? "—" : pct(x.champ.wmape)}</td>
                    <td className="num" style={accColor(acc)}>{acc === null ? "—" : pct(acc)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ============================ MODEL LAB ======================================
function ModelLab({ skus, months, segMap, ranked }) {
  const all = useMemo(() => Object.values(skus).sort((a, b) => b.total12 - a.total12), [skus]);
  const [sel, setSel] = useState(all[0]?.name || "");
  const [q, setQ] = useState("");

  const ql = q.trim().toLowerCase();
  const matches = ql ? all.filter((x) => x.name.toLowerCase().includes(ql)).slice(0, 8) : [];
  const x = skus[sel];
  const sg = segMap[sel] || {};

  return (
    <>
      <div className="grid-2">
        <div className="card" style={{ marginBottom: 18 }}>
          <h2 className="card-title">Pick a SKU</h2>
          <div className="card-note">compare every method for one SKU · champion is auto-selected</div>
          <input className="gloss-search" placeholder="Search a SKU…" value={q}
            onChange={(e) => setQ(e.target.value)} />
          {ql && (
            <div className="sku-matches">
              {matches.length === 0 ? <div className="gloss-empty">No SKU matches “{q}”.</div> :
                matches.map((m) => (
                  <div key={m.name} className={"sku-match" + (m.name === sel ? " pick-active" : "")}
                    onClick={() => { setSel(m.name); setQ(""); }}>{m.name}</div>
                ))}
            </div>
          )}
        </div>
        <div className="card" style={{ marginBottom: 18 }}>
          <h2 className="card-title">{sel || "—"}</h2>
          <div className="dd-badges">
            {sg.type && <span className="badge">{sg.type}</span>}
            {sg.abc_tier && <span className={"badge abc-" + String(sg.abc_tier).toLowerCase()}>ABC {sg.abc_tier}</span>}
            {sg.xyz_class && <span className={"badge xyz-" + trendClass(sg.xyz_class)}>{sg.xyz_class}</span>}
            {sg.trend && <span className={"badge " + trendClass(sg.trend)}>{sg.trend}</span>}
            {x && <span className="badge champ">Champion: {METHODS[x.champ.method].label}</span>}
          </div>
          <div className="card-note" style={{ marginTop: 12, marginBottom: 0 }}>
            12-mo volume {x ? fmt(x.total12) : "—"} units · {x ? x.series.length : 0} months of history
          </div>
        </div>
      </div>

      {x && (
        <>
          <div className="card">
            <h2 className="card-title">Actual vs Methods</h2>
            <div className="card-note">solid = actual history · dashed = each method’s forecast for the next 3 months</div>
            <LabChart x={x} months={months} />
          </div>

          <div className="card">
            <h2 className="card-title">Method Comparison</h2>
            <div className="card-note">backtest wMAPE ranks the methods · champion = lowest</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Method</th><th className="num">wMAPE</th><th className="num">Accuracy</th>
                    {months.map((m) => <th className="num" key={m}>{ym(m)}</th>)}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {METHOD_KEYS.map((m) => {
                    const b = x.methods[m];
                    const acc = b.wmape === null ? null : 100 - b.wmape;
                    const isCh = m === x.champ.method;
                    return (
                      <tr key={m} style={isCh ? { fontWeight: 700 } : {}}>
                        <td><span className="badge method" style={{ color: METHOD_COLORS[m] }}>{METHODS[m].label}</span></td>
                        <td className="num">{b.wmape === null ? "—" : pct(b.wmape)}</td>
                        <td className="num" style={accColor(acc)}>{acc === null ? "—" : pct(acc)}</td>
                        {x.fwd[m].map((p, j) => <td className="num" key={j}>{fmt(p.q)}</td>)}
                        <td>{isCh && <span className="badge champ">★ champion</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---- SVG chart: actual history + each method's forward forecast --------------
function LabChart({ x, months }) {
  const hist = x.series.slice(-15);
  const H = hist.length, F = months.length, T = H + F;
  const W = 720, HT = 260, pad = { l: 46, r: 14, t: 16, b: 28 };
  const plotW = W - pad.l - pad.r, plotH = HT - pad.t - pad.b;
  const xAt = (i) => pad.l + (T <= 1 ? 0 : (i / (T - 1)) * plotW);
  const vals = [...hist.map((p) => p.q), ...METHOD_KEYS.flatMap((m) => x.fwd[m].map((p) => p.q))];
  const ymax = Math.max(1, ...vals);
  const yAt = (v) => pad.t + plotH - (v / ymax) * plotH;
  const poly = (pts) => pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");

  const actualPts = hist.map((p, i) => [xAt(i), yAt(p.q)]);
  const anchor = actualPts[H - 1] || [xAt(0), yAt(0)];
  const divX = xAt(H - 1);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${HT}`} width="100%" style={{ display: "block" }} preserveAspectRatio="xMidYMid meet">
        {/* forecast region divider */}
        <line x1={divX} y1={pad.t} x2={divX} y2={pad.t + plotH} strokeDasharray="3 4" style={{ stroke: "var(--line)" }} />
        {/* actual history */}
        <polyline points={poly(actualPts)} strokeLinejoin="round" strokeLinecap="round"
          style={{ fill: "none", stroke: "var(--text-dim)", strokeWidth: 2.5 }} />
        {actualPts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.2" style={{ fill: "var(--text-dim)" }} />)}
        {/* each method forward, from anchor */}
        {METHOD_KEYS.map((m) => {
          const fpts = [anchor, ...x.fwd[m].map((p, j) => [xAt(H + j), yAt(p.q)])];
          const isCh = m === x.champ.method;
          return (
            <g key={m}>
              <polyline points={poly(fpts)} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round"
                style={{ fill: "none", stroke: METHOD_COLORS[m], strokeWidth: isCh ? 3 : 1.6, opacity: isCh ? 1 : 0.7 }} />
              {isCh && x.fwd[m].map((p, j) => (
                <g key={j}>
                  <circle cx={xAt(H + j)} cy={yAt(p.q)} r="3" style={{ fill: METHOD_COLORS[m] }} />
                  <text x={xAt(H + j)} y={yAt(p.q) - 7} textAnchor="middle" style={{ fontSize: 10, fill: "var(--text)" }}>{fmt(p.q)}</text>
                </g>
              ))}
            </g>
          );
        })}
        {/* x labels: last actual month + forward months */}
        <text x={divX} y={HT - 9} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted)" }}>{ym(hist[H - 1].ym)}</text>
        {months.map((mo, j) => (
          <text key={j} x={xAt(H + j)} y={HT - 9} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted)" }}>{ym(mo)}</text>
        ))}
      </svg>
      <div className="fc-legend">
        <span style={{ color: "var(--text-dim)" }}><i />Actual</span>
        {METHOD_KEYS.map((m) => (
          <span key={m} style={{ color: METHOD_COLORS[m] }}>
            <i className="dash" />{METHODS[m].label}{m === x.champ.method ? " ★" : ""}
          </span>
        ))}
      </div>
    </>
  );
}
