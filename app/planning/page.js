import { sb } from "../../lib/supabase";
import { fmt } from "../../lib/format";

export const dynamic = "force-dynamic";

const CAP_BADGE = {
  "Over capacity": "declining",
  Tight: "stable",
  OK: "growing",
  "No line": "na",
};

function UtilBar({ pct }) {
  const p = Math.min(100, Math.max(0, Number(pct) || 0));
  const color = p > 100 ? "var(--red)" : p > 85 ? "var(--amber)" : "var(--green)";
  return (
    <div style={{ background: "var(--panel-2)", borderRadius: 6, height: 8, width: 120, display: "inline-block", verticalAlign: "middle" }}>
      <div style={{ width: p + "%", height: "100%", background: color, borderRadius: 6 }} />
    </div>
  );
}

export default async function Planning() {
  let cap = [], load = [], plan = [], error = null;
  try {
    const [a, b, c] = await Promise.all([
      sb("v_mps_capacity?select=*"),
      sb("v_mps_line_load?select=*"),
      sb("v_mps_plan?select=*&order=net_requirement.desc&limit=40"),
    ]);
    cap = a || []; load = b || []; plan = c || [];
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
        <p>Make sure migrations 0016 &amp; 0017 have been run.</p>
      </div>
    );
  }

  const needCount = plan.filter((r) => Number(r.net_requirement) > 0).length;
  const overLines = cap.filter((r) => r.status === "Over capacity").length;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Planning — MPS</h1>
        <div className="page-sub">
          Weekly production plan · demand vs line capacity · min stock 30 days · 3 shifts × 16.5 shift-weeks
        </div>
      </div>

      <section className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Production Lines</div>
          <div className="kpi-value">{fmt(cap.filter((c) => c.weekly_capacity).length)}</div>
          <div className="kpi-sub">with defined capacity</div>
        </div>
        <div className="card">
          <div className="kpi-label">Lines Over Capacity</div>
          <div className="kpi-value" style={{ color: overLines ? "var(--red)" : "var(--green)" }}>{fmt(overLines)}</div>
          <div className="kpi-sub">demand &gt; weekly capacity</div>
        </div>
        <div className="card">
          <div className="kpi-label">SKUs Below Min</div>
          <div className="kpi-value" style={{ color: "var(--amber)" }}>{fmt(needCount)}</div>
          <div className="kpi-sub">need production to reach 30-day stock</div>
        </div>
        <div className="card">
          <div className="kpi-label">Busiest Line</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{cap[0] ? cap[0].prod_line : "—"}</div>
          <div className="kpi-sub">{cap[0] && cap[0].utilization_pct != null ? cap[0].utilization_pct + "% util." : "—"}</div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Line Capacity Utilization</h2>
        <div className="card-note">weekly demand (12-wk run-rate) vs weekly capacity per production line</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Production Line</th>
                <th className="num">Weekly Demand</th>
                <th className="num">Weekly Capacity</th>
                <th className="num">Utilization</th>
                <th></th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cap.map((r, i) => (
                <tr key={i}>
                  <td className="name">{r.prod_line}</td>
                  <td className="num">{fmt(r.weekly_demand)}</td>
                  <td className="num">{r.weekly_capacity == null ? "—" : fmt(r.weekly_capacity)}</td>
                  <td className="num">{r.utilization_pct == null ? "—" : r.utilization_pct + "%"}</td>
                  <td>{r.utilization_pct == null ? null : <UtilBar pct={r.utilization_pct} />}</td>
                  <td><span className={"badge " + (CAP_BADGE[r.status] || "na")}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Production Plan — Top Net Requirements</h2>
        <div className="card-note">SKUs furthest below their 30-day min stock · produce to close the gap</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Line</th>
                <th>ABC</th>
                <th className="num">Demand/wk</th>
                <th className="num">SOH</th>
                <th className="num">Weeks Cover</th>
                <th className="num">Target (30d)</th>
                <th className="num">Net Requirement</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((r, i) => (
                <tr key={i}>
                  <td className="name">{r.sku_name}</td>
                  <td>{r.prod_line}</td>
                  <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier}</span></td>
                  <td className="num">{fmt(r.weekly_demand)}</td>
                  <td className="num">{fmt(r.soh)}</td>
                  <td className="num" style={{ color: Number(r.weeks_cover) < 1 ? "var(--red)" : Number(r.weeks_cover) < 4.3 ? "var(--amber)" : "var(--green)" }}>
                    {r.weeks_cover == null ? "—" : r.weeks_cover}
                  </td>
                  <td className="num">{fmt(r.target_stock_30d)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmt(r.net_requirement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
