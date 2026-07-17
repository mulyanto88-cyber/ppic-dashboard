import { sb } from "../lib/supabase";
import { fmt, rp, ym, dmon, pct } from "../lib/format";
import ChartCombo from "./ChartCombo";
import WeeklyBars from "./WeeklyBars";

export const dynamic = "force-dynamic";

function BarChart({ data, valueKey, labelKey, showVal }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="barchart">
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        return (
          <div className="bar-col" key={i}>
            {showVal && <div className="bar-val">{fmt(v)}</div>}
            <div className="bar hl" style={{ height: (v / max) * 100 + "%" }} />
            <div className="bar-label">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

function pctOf(part, total) {
  return total > 0 ? pct((Number(part) || 0) / total * 100) : "—";
}

export default async function DemandAnalytics() {
  let revenue = [], weekly = [], skuValue = [], seg = [], matrix = [],
    movement = [], abc = [], recent = [], watch = [];
  let error = null;
  try {
    const [a, b, c, d, e, f, g, h, i] = await Promise.all([
      sb("v_revenue_monthly?select=*&order=month.asc"),
      sb("v_weekly_trend?select=*&order=week_start.asc"),
      sb("v_sku_value?select=*&order=value_12m.desc"),
      sb("v_sku_segmentation?select=sku_name,abc_tier,movement_class,xyz_class,trend"),
      sb("v_sku_segmentation_summary?select=*"),
      sb("v_sku_movement_summary?select=*"),
      sb("v_sku_abc_summary?select=*"),
      sb("v_sku_recent_sales?select=*"),
      sb("v_sku_trend_watch?select=*&limit=12"),
    ]);
    revenue = a || []; weekly = b || []; skuValue = c || []; seg = d || [];
    matrix = e || []; movement = f || []; abc = g || []; recent = h || []; watch = i || [];
  } catch (err) {
    error = err.message;
  }

  if (error) return <div className="card error"><h2>Failed to load data</h2><pre>{error}</pre></div>;

  const totalValue = skuValue.reduce((s, r) => s + Number(r.value_12m || 0), 0);
  const totalQty = skuValue.reduce((s, r) => s + Number(r.qty_12m || 0), 0);
  const avgPrice = totalQty > 0 ? totalValue / totalQty : 0;
  const nA = skuValue.filter((r) => r.abc_tier_value === "A").length;
  const lastMonth = revenue.length ? revenue[revenue.length - 1].month : null;

  const segMap = {}; for (const s of seg) segMap[s.sku_name] = s;
  const recentMap = {}; for (const r of recent) recentMap[r.sku_name] = r;

  const topValue = skuValue.slice(0, 12);
  const rev18 = revenue.slice(-18).map((r) => ({ ...r, _lbl: ym(r.month) }));

  // 4 recent month labels (untuk header kolom Top 12): [m3, m2, m1, m0]
  const last4 = revenue.slice(-4).map((r) => ym(r.month));

  // totals untuk %
  const movSku = movement.reduce((s, m) => s + Number(m.sku_count || 0), 0);
  const movVol = movement.reduce((s, m) => s + Number(m.qty_12m || 0), 0);
  const abcSku = abc.reduce((s, m) => s + Number(m.sku_count || 0), 0);
  const abcVol = abc.reduce((s, m) => s + Number(m.qty_12m || 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Demand Analytics</h1>
          <div className="page-sub">Active FG (Continue) · data through {lastMonth ? ym(lastMonth) : "—"} · 12-month basis</div>
        </div>
        <a className="btn-export" href="/api/export?view=v_sku_segmentation">↓ Export CSV</a>
      </div>

      <section className="kpi-grid">
        <div className="card"><div className="kpi-label">Revenue (12 mo)</div><div className="kpi-value">{rp(totalValue)}</div><div className="kpi-sub">sales value (IDR)</div></div>
        <div className="card"><div className="kpi-label">Units Sold (12 mo)</div><div className="kpi-value">{fmt(totalQty)}</div><div className="kpi-sub">units delivered</div></div>
        <div className="card"><div className="kpi-label">Avg. Price / Unit</div><div className="kpi-value">{rp(avgPrice)}</div><div className="kpi-sub">blended</div></div>
        <div className="card"><div className="kpi-label">Active SKUs</div><div className="kpi-value">{fmt(skuValue.length)}</div><div className="kpi-sub">{fmt(nA)} Tier A (by value)</div></div>
      </section>

      <div className="card">
        <h2 className="card-title">Monthly Revenue &amp; Units</h2>
        <div className="card-note">last 18 months · bars = revenue · line = units · hover for exact figures</div>
        <ChartCombo data={rev18} />
      </div>

      <div className="card">
        <h2 className="card-title">Weekly Pattern</h2>
        <div className="card-note">last 12 weeks · units delivered (FG) · label = week start · hover for ISO week &amp; date range</div>
        <WeeklyBars data={weekly} />
      </div>

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">Velocity Distribution</h2>
          <div className="card-note">SKU count by movement class</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Class</th><th className="num">SKUs</th><th className="num">% SKU</th><th className="num">Units (12mo)</th><th className="num">% Vol</th></tr></thead>
              <tbody>
                {movement.map((m, k) => (
                  <tr key={k}>
                    <td><span className={"badge " + String(m.movement_class || "").toLowerCase()}>{m.movement_class}</span></td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{pctOf(m.sku_count, movSku)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                    <td className="num">{pctOf(m.qty_12m, movVol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Pareto ABC Distribution</h2>
          <div className="card-note">tier A should be few SKUs but most volume</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tier</th><th className="num">SKUs</th><th className="num">% SKU</th><th className="num">Units (12mo)</th><th className="num">% Vol</th></tr></thead>
              <tbody>
                {abc.map((m, k) => (
                  <tr key={k}>
                    <td><span className={"badge abc-" + String(m.abc_tier || "").toLowerCase()}>{m.abc_tier}</span></td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{pctOf(m.sku_count, abcSku)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                    <td className="num">{pctOf(m.qty_12m, abcVol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Top 12 SKUs — Revenue Contribution</h2>
        <div className="card-note">
          ranked by 12-month value · monthly sales (last 4 months) · <b>{last4[3] || "current"}* = partial month</b> · Avg/mo = 12-week run-rate → monthly
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th className="num">Revenue</th>
                <th className="num">{last4[0] || "M-3"}</th>
                <th className="num">{last4[1] || "M-2"}</th>
                <th className="num">{last4[2] || "M-1"}</th>
                <th className="num">{last4[3] ? last4[3] + "*" : "M-0"}</th>
                <th className="num">Avg/mo</th>
                <th>ABC-val</th>
                <th>XYZ</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {topValue.map((r, k) => {
                const s = segMap[r.sku_name] || {};
                const rc = recentMap[r.sku_name] || {};
                return (
                  <tr key={k}>
                    <td className="name">{r.sku_name}</td>
                    <td className="num">{rp(r.value_12m)}</td>
                    <td className="num">{fmt(rc.m3_qty)}</td>
                    <td className="num">{fmt(rc.m2_qty)}</td>
                    <td className="num">{fmt(rc.m1_qty)}</td>
                    <td className="num">{fmt(rc.m0_qty)}</td>
                    <td className="num">{fmt(rc.avg_monthly_l3m)}</td>
                    <td><span className={"badge abc-" + String(r.abc_tier_value || "").toLowerCase()}>{r.abc_tier_value}</span></td>
                    <td>{s.xyz_class ? <span className={"badge xyz-" + String(s.xyz_class).toLowerCase()}>{s.xyz_class}</span> : "—"}</td>
                    <td>{s.trend ? <span className={"badge " + String(s.trend).toLowerCase()}>{s.trend}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">ABC × XYZ Matrix</h2>
          <div className="card-note">SKU count per combination (qty basis)</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>ABC</th><th>XYZ</th><th className="num">SKUs</th><th className="num">Units (12mo)</th></tr></thead>
              <tbody>
                {matrix.map((m, k) => (
                  <tr key={k}>
                    <td><span className={"badge abc-" + String(m.abc_tier || "").toLowerCase()}>{m.abc_tier}</span></td>
                    <td>{m.xyz_class === "N/A" ? <span className="badge na">N/A</span> : <span className={"badge xyz-" + String(m.xyz_class || "").toLowerCase()}>{m.xyz_class}</span>}</td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Momentum Watchlist</h2>
          <div className="card-note">A/B SKUs declining or C SKUs rising</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>SKU</th><th>ABC</th><th className="num">Units (12mo)</th><th>Trend</th></tr></thead>
              <tbody>
                {watch.map((r, k) => (
                  <tr key={k}>
                    <td className="name">{r.sku_name}</td>
                    <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier}</span></td>
                    <td className="num">{fmt(r.qty_12m)}</td>
                    <td><span className={"badge " + String(r.trend || "").toLowerCase()}>{r.trend}</span></td>
                  </tr>
                ))}
                {watch.length === 0 && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>No SKUs on watchlist.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
