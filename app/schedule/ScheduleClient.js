"use client";
import { useMemo, useState } from "react";
import { fmt, dmon, pct } from "../../lib/format";

// ---- Parameter (tunable) -----------------------------------------------------
const HORIZON = 8;   // minggu ke depan
const LOT = 500;     // pembulatan produksi ke atas
// s = titik pesan-ulang (14 hari) · S = pesan-sampai (30 hari, target_stock_30d)
const REORDER_WEEKS = 2;

const mondayOf = (d) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();                 // 0 Sun .. 6 Sat
  x.setUTCDate(x.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return x;
};

const heatStyle = (util) => {
  if (util == null) return { color: "var(--muted)" };
  if (util > 100) return { background: "var(--red-soft)", color: "var(--red)", fontWeight: 700 };
  if (util > 85) return { background: "var(--amber-soft)", color: "var(--amber)", fontWeight: 600 };
  if (util > 0) return { background: "var(--green-soft)", color: "var(--green)" };
  return { color: "var(--muted)" };
};

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export default function ScheduleClient({ plan, pattern, capacity, meta }) {
  const [page, setPage] = useState(0);

  const patternMap = useMemo(() => {
    const m = {}; for (const r of pattern) m[Number(r.week_of_month)] = Number(r.factor); return m;
  }, [pattern]);
  const capMap = useMemo(() => {
    const m = {}; for (const r of capacity) m[r.prod_line] = r.weekly_capacity == null ? null : Number(r.weekly_capacity); return m;
  }, [capacity]);

  // Horizon minggu (mulai Senin minggu berjalan)
  const weeks = useMemo(() => {
    const start = mondayOf(new Date());
    return Array.from({ length: HORIZON }, (_, i) => {
      const ws = new Date(start); ws.setUTCDate(start.getUTCDate() + i * 7);
      const wom = Math.min(5, Math.max(1, Math.ceil(ws.getUTCDate() / 7)));
      return { iso: ws.toISOString().slice(0, 10), wom, factor: patternMap[wom] ?? 1 };
    });
  }, [patternMap]);

  // Simulasi (s,S) per SKU + agregasi beban per line
  const { rows, lineLoad, kpi } = useMemo(() => {
    const rows = [];
    const lineLoad = {};                       // line -> [w]: unit produksi
    for (const p of plan) {
      const wd = Number(p.weekly_demand) || 0;
      const s = REORDER_WEEKS * wd;
      const S = Math.max(Number(p.target_stock_30d) || 0, s);
      let stock = Number(p.soh) || 0;
      let total = 0;
      const cells = weeks.map((w) => {
        const demand = wd * w.factor;
        const projAfter = stock - demand;
        let prod = 0;
        if (projAfter < s) prod = Math.ceil((S - projAfter) / LOT) * LOT;
        stock = projAfter + prod;
        total += prod;
        return { demand: Math.round(demand), prod, closing: Math.round(stock) };
      });
      rows.push({ ...p, cells, total });
      if (total > 0) {
        const L = (lineLoad[p.prod_line] = lineLoad[p.prod_line] || Array(HORIZON).fill(0));
        cells.forEach((c, i) => { L[i] += c.prod; });
      }
    }
    rows.sort((a, b) => b.total - a.total);

    let overCells = 0;
    for (const L in lineLoad) {
      const cap = capMap[L];
      if (cap) lineLoad[L].forEach((u) => { if (u / cap > 1) overCells++; });
    }
    const needCount = rows.filter((r) => r.total > 0).length;
    const totalProd = rows.reduce((s2, r) => s2 + r.total, 0);
    return { rows, lineLoad, kpi: { needCount, totalProd, overCells } };
  }, [plan, weeks, capMap]);

  const lines = useMemo(() => {
    const set = new Set(plan.map((p) => p.prod_line));
    return [...set].sort();
  }, [plan]);

  const PER = 25;
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const cur = Math.min(page, pages - 1);
  const pageRows = rows.slice(cur * PER, cur * PER + PER);
  const src = plan[0]?.demand_source || "—";

  function exportCSV() {
    const head = ["SKU", "Line", "ABC", ...weeks.map((w) => dmon(w.iso)), "Total"];
    const body = rows.map((r) => [r.sku_name, r.prod_line, r.abc_tier || "",
      ...r.cells.map((c) => c.prod), r.total]);
    const csv = "﻿" + [head, ...body].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `production_schedule_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Production Schedule</h1>
          <div className="page-sub">
            time-phased weekly plan · next {HORIZON} weeks · (s,S) policy: reorder at {REORDER_WEEKS}-wk, up to 30-day · lot {fmt(LOT)} · payday-aware
          </div>
        </div>
        <button className="btn-export" onClick={exportCSV}>↓ Export CSV</button>
      </div>

      <div className="note-banner">
        <span className="ic">{src === "Forecast baseline" ? "🎯" : "📊"}</span>
        <div>
          <b>Demand source: {src}.</b>{" "}
          {src === "Forecast baseline"
            ? `Driven by the published forecast baseline${meta && meta.run_date ? " (" + meta.run_date + ")" : ""}, shaped into weekly buckets by the payday curve.`
            : "Using the 12-week run-rate — publish a forecast baseline to drive this from the official forecast."}
          {" "}Assumes production is available within its week (FG lead ≤ 1 week).
        </div>
      </div>

      <section className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Horizon</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{dmon(weeks[0].iso)} – {dmon(weeks[HORIZON - 1].iso)}</div>
          <div className="kpi-sub">{HORIZON} weeks ahead</div>
        </div>
        <div className="card">
          <div className="kpi-label">SKUs to Produce</div>
          <div className="kpi-value">{fmt(kpi.needCount)}</div>
          <div className="kpi-sub">of {fmt(rows.length)} active</div>
        </div>
        <div className="card">
          <div className="kpi-label">Total Production</div>
          <div className="kpi-value">{fmt(kpi.totalProd)}</div>
          <div className="kpi-sub">units · {HORIZON}-week plan</div>
        </div>
        <div className="card">
          <div className="kpi-label">Over-capacity Slots</div>
          <div className="kpi-value" style={{ color: kpi.overCells ? "var(--red)" : "var(--green)" }}>{fmt(kpi.overCells)}</div>
          <div className="kpi-sub">line × week above capacity</div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Line Capacity Load</h2>
        <div className="card-note">weekly production load ÷ line capacity · green ok · amber tight (&gt;85%) · red over (&gt;100%)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Production Line</th>
                <th className="num">Capacity/wk</th>
                {weeks.map((w) => (
                  <th className="num" key={w.iso}>
                    {dmon(w.iso)}{w.factor >= 1.05 ? " 💰" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((L) => {
                const cap = capMap[L];
                const load = lineLoad[L] || Array(HORIZON).fill(0);
                return (
                  <tr key={L}>
                    <td className="name">{L}</td>
                    <td className="num">{cap == null ? "—" : fmt(cap)}</td>
                    {load.map((u, i) => {
                      const util = cap ? (u / cap) * 100 : null;
                      return (
                        <td className="num" key={i} style={heatStyle(util)}
                          title={fmt(u) + " units" + (cap ? " · " + pct(util) : "")}>
                          {u === 0 ? "—" : cap ? pct(util) : fmt(u)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Weekly Production Plan — by SKU ({fmt(rows.length)})</h2>
        <div className="card-note">units to produce each week to hold 30-day cover · 💰 = payday week (higher demand) · {PER} rows per page</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>SKU</th><th>Line</th><th>ABC</th>
                {weeks.map((w) => <th className="num" key={w.iso}>{dmon(w.iso)}{w.factor >= 1.05 ? " 💰" : ""}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.sku_name}>
                  <td className="num" style={{ color: "var(--muted)" }}>{cur * PER + i + 1}</td>
                  <td className="name">{r.sku_name}</td>
                  <td>{r.prod_line}</td>
                  <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier || "—"}</span></td>
                  {r.cells.map((c, j) => (
                    <td className="num" key={j} style={c.prod === 0 ? { color: "var(--muted)" } : { fontWeight: 650 }}
                      title={"demand " + fmt(c.demand) + " · closing " + fmt(c.closing)}>
                      {c.prod === 0 ? "—" : fmt(c.prod)}
                    </td>
                  ))}
                  <td className="num" style={{ fontWeight: 700 }}>{fmt(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="pager">
            <span className="pager-info">{cur * PER + 1}–{Math.min(rows.length, cur * PER + PER)} of {fmt(rows.length)}</span>
            <button className="gloss-pill" disabled={cur === 0} onClick={() => setPage(cur - 1)}>‹ Prev</button>
            <button className="gloss-pill" disabled={cur === pages - 1} onClick={() => setPage(cur + 1)}>Next ›</button>
          </div>
        )}
      </div>
    </>
  );
}
