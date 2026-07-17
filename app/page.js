import { sb } from "../lib/supabase";
import { fmt, rp, ym } from "../lib/format";

export const dynamic = "force-dynamic";

/* CSS bar chart (weekly pattern) */
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

/* SVG combo: revenue bars + qty line */
function ComboChart({ data }) {
  const W = 760, H = 210, padX = 10, padTop = 14, padBottom = 24;
  const n = data.length || 1;
  const plotH = H - padTop - padBottom;
  const maxRev = Math.max(1, ...data.map((d) => Number(d.revenue_idr) || 0));
  const maxQty = Math.max(1, ...data.map((d) => Number(d.qty) || 0));
  const slot = (W - padX * 2) / n;
  const qy = (v) => padTop + plotH - ((Number(v) || 0) / maxQty) * plotH;
  const pts = data.map((d, i) => [padX + slot * i + slot / 2, qy(d.qty)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {data.map((d, i) => {
          const h = ((Number(d.revenue_idr) || 0) / maxRev) * plotH;
          return (
            <rect key={i} x={padX + slot * i + slot * 0.22} y={padTop + plotH - h}
              width={slot * 0.56} height={h} rx="2.5" style={{ fill: "var(--accent)", opacity: 0.5 }} />
          );
        })}
        <path d={path} style={{ fill: "none", stroke: "var(--green)", strokeWidth: 2 }} />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" style={{ fill: "var(--green)" }} />)}
        {data.map((d, i) =>
          n <= 12 || i % 2 === 0 ? (
            <text key={i} x={padX + slot * i + slot / 2} y={H - 8}
              style={{ fontSize: 9, fill: "var(--muted)" }} textAnchor="middle">{d._lbl}</text>
          ) : null
        )}
      </svg>
      <div className="legend">
        <span className="lg-accent">Revenue (IDR)</span>
        <span className="lg-green">Units delivered</span>
      </div>
    </>
  );
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

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
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
  const recentMap = {};
  for (const r of recent) recentMap[r.sku_name] = r;

  const topValue = skuValue.slice(0, 12);
  const rev18 = revenue.slice(-18).map((r) => ({ ...r, _lbl: ym(r.month) }));
  const wk12 = weekly.map((r) => ({ ...r, _lbl: "W" + r.iso_week }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Demand Analytics</h1>
          <div className="page-sub">
            Active FG (Continue) · data through {lastMonth ? ym(lastMonth) : "—"} · 12-month basis
          </div>
        </div>
        <a className="btn-export" href="/api/export?view=v_sku_segmentation">↓ Export CSV</a>
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
        <h2 className="card-title">Monthly Revenue &amp; Units</h2>
        <div className="card-note">last 18 months · bars = revenue (IDR) · line = units delivered</div>
        <ComboChart data={rev18} />
      </div>

      <div className="card">
        <h2 className="card-title">Weekly Pattern</h2>
        <div className="card-note">last 12 weeks · units delivered (FG)</div>
        <BarChart data={wk12} valueKey="qty" labelKey="_lbl" showVal />
      </div>

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">Velocity Distribution</h2>
          <div className="card-note">SKU count by movement class</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Class</th><th className="num">SKUs</th><th className="num">Units (12 mo)</th></tr></thead>
              <tbody>
                {movement.map((m, k) => (
                  <tr key={k}>
                    <td><span className={"badge " + String(m.movement_class || "").toLowerCase()}>{m.movement_class}</span></td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Pareto ABC Distribution</h2>
          <div className="card-note">SKU count &amp; volume by contribution tier</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tier</th><th className="num">SKUs</th><th className="num">Units (12 mo)</th></tr></thead>
              <tbody>
                {abc.map((m, k) => (
                  <tr key={k}>
                    <td><span className={"badge abc-" + String(m.abc_tier || "").toLowerCase()}>{m.abc_tier}</span></td>
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
        <div className="card-note">
          ranked by 12-month value · Sales L3M = last 3 calendar months (incl. Jul) · Avg/mo = 12-week run-rate → monthly
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th className="num">Revenue</th>
                <th className="num">Units 12mo</th>
                <th className="num">Sales L3M</th>
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
                    <td className="num">{fmt(r.qty_12m)}</td>
                    <td className="num">{fmt(rc.sales_l3m)}</td>
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
              <thead><tr><th>ABC</th><th>XYZ</th><th className="num">SKUs</th><th className="num">Units (12 mo)</th></tr></thead>
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
              <thead><tr><th>SKU</th><th>ABC</th><th className="num">Units (12 mo)</th><th>Trend</th></tr></thead>
              <tbody>
                {watch.map((r, k) => (
                  <tr key={k}>
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
