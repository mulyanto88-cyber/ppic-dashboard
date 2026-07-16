import { sb } from "../lib/supabase";
import { fmt, rp, ym } from "../lib/format";

export const dynamic = "force-dynamic";

function BarChart({ data, valueKey, labelKey, showVal, fmtVal }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="barchart">
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const hl = d._hl;
        return (
          <div className="bar-col" key={i}>
            {showVal && <div className="bar-val">{fmtVal ? fmtVal(v) : fmt(v)}</div>}
            <div className={"bar" + (hl ? " hl" : "")} style={{ height: (v / max) * 100 + "%" }} />
            <div className="bar-label">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default async function DemandAnalytics() {
  let revenue = [], payday = [], skuValue = [], seg = [], matrix = [], movement = [], watch = [];
  let error = null;
  try {
    const [a, b, c, d, e, f, g] = await Promise.all([
      sb("v_revenue_monthly?select=*&order=month.asc"),
      sb("v_payday_pattern?select=*&order=week_of_month.asc"),
      sb("v_sku_value?select=*&order=value_12m.desc"),
      sb("v_sku_segmentation?select=sku_name,abc_tier,movement_class,xyz_class,trend"),
      sb("v_sku_segmentation_summary?select=*"),
      sb("v_sku_movement_summary?select=*"),
      sb("v_sku_trend_watch?select=*&limit=12"),
    ]);
    revenue = a || []; payday = b || []; skuValue = c || []; seg = d || [];
    matrix = e || []; movement = f || []; watch = g || [];
  } catch (err) {
    error = err.message;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
        <p>
          Check <code>SUPABASE_URL</code> &amp; <code>SUPABASE_SERVICE_ROLE_KEY</code> in
          Vercel, and that schema <code>ppic</code> is in Exposed schemas.
        </p>
      </div>
    );
  }

  const totalValue = skuValue.reduce((s, r) => s + Number(r.value_12m || 0), 0);
  const totalQty = skuValue.reduce((s, r) => s + Number(r.qty_12m || 0), 0);
  const avgPrice = totalQty > 0 ? totalValue / totalQty : 0;
  const nA = skuValue.filter((r) => r.abc_tier_value === "A").length;
  const lastMonth = revenue.length ? revenue[revenue.length - 1].month : null;

  const segMap = {};
  for (const s of seg) segMap[s.sku_name] = s;
  const topValue = skuValue.slice(0, 12);
  const rev18 = revenue.slice(-18).map((r) => ({ ...r, _lbl: ym(r.month) }));
  const paydayData = payday.map((d) => ({
    ...d,
    _hl: /payday|29\+/.test(String(d.week_of_month)),
  }));

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Demand Analytics</h1>
        <div className="page-sub">
          Active FG (Continue) · data through {lastMonth ? ym(lastMonth) : "—"} · 12-month basis
        </div>
      </div>

      <section className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Revenue (12 mo)</div>
          <div className="kpi-value">{rp(totalValue)}</div>
          <div className="kpi-sub">sales value (IDR)</div>
        </div>
        <div className="card">
          <div className="kpi-label">Units Sold (12 mo)</div>
          <div className="kpi-value">{fmt(totalQty)}</div>
          <div className="kpi-sub">units delivered</div>
        </div>
        <div className="card">
          <div className="kpi-label">Avg. Price / Unit</div>
          <div className="kpi-value">{rp(avgPrice)}</div>
          <div className="kpi-sub">blended</div>
        </div>
        <div className="card">
          <div className="kpi-label">Active SKUs</div>
          <div className="kpi-value">{fmt(skuValue.length)}</div>
          <div className="kpi-sub">{fmt(nA)} Tier A (by value)</div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Monthly Revenue Trend</h2>
        <div className="card-note">Last 18 months · sales value (IDR)</div>
        <BarChart data={rev18} valueKey="revenue_idr" labelKey="_lbl" />
      </div>

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">Payday Pattern (week of month)</h2>
          <div className="card-note">avg units/week · 12 mo · green = payday window (day ≥ 22)</div>
          <div className="payday">
            <BarChart data={paydayData} valueKey="avg_qty" labelKey="week_of_month" showVal />
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Velocity Distribution</h2>
          <div className="card-note">SKU count by movement class</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Class</th><th className="num">SKUs</th><th className="num">Units (12 mo)</th></tr></thead>
              <tbody>
                {movement.map((m, i) => (
                  <tr key={i}>
                    <td><span className={"badge " + String(m.movement_class || "").toLowerCase()}>{m.movement_class}</span></td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Top 12 SKUs — Revenue Contribution</h2>
        <div className="card-note">ranked by 12-month sales value (IDR)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th className="num">Revenue</th>
                <th className="num">Units</th>
                <th className="num">Price/Unit</th>
                <th>ABC (value)</th>
                <th>XYZ</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {topValue.map((r, i) => {
                const s = segMap[r.sku_name] || {};
                return (
                  <tr key={i}>
                    <td className="name">{r.sku_name}</td>
                    <td className="num">{rp(r.value_12m)}</td>
                    <td className="num">{fmt(r.qty_12m)}</td>
                    <td className="num">{rp(r.avg_price_idr)}</td>
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
              <thead><tr><th>ABC</th><th>XYZ</th><th className="num">SKUs</th><th className="num">Units (12 mo)</th></tr></thead>
              <tbody>
                {matrix.map((m, i) => (
                  <tr key={i}>
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
              <thead><tr><th>SKU</th><th>ABC</th><th className="num">Units (12 mo)</th><th>Trend</th></tr></thead>
              <tbody>
                {watch.map((r, i) => (
                  <tr key={i}>
                    <td className="name">{r.sku_name}</td>
                    <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier}</span></td>
                    <td className="num">{fmt(r.qty_12m)}</td>
                    <td><span className={"badge " + String(r.trend || "").toLowerCase()}>{r.trend}</span></td>
                  </tr>
                ))}
                {watch.length === 0 && (
                  <tr><td colSpan={4} style={{ color: "var(--muted)" }}>No SKUs on watchlist.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
