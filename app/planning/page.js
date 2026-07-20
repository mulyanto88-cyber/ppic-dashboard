import { sb } from "../../lib/supabase";
import { fmt } from "../../lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CAP_BADGE = {
  "Over capacity": "declining",
  Tight: "stable",
  OK: "growing",
  "No line": "na",
};

const IconServer = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>;
const IconAlertCircle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;
const IconArrowDownCircle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 12 16 16 12"></polyline><line x1="12" y1="8" x2="12" y2="16"></line></svg>;
const IconActivity = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;

function UtilBar({ pct }) {
  const p = Math.min(100, Math.max(0, Number(pct) || 0));
  const color = p > 100 ? "var(--red)" : p > 85 ? "var(--amber)" : "var(--green)";
  return (
    <div style={{ background: "var(--panel-2)", borderRadius: 6, height: 8, width: 120, display: "inline-block", verticalAlign: "middle" }}>
      <div style={{ width: p + "%", height: "100%", background: color, borderRadius: 6, transition: "width 0.3s ease" }} />
    </div>
  );
}

export default async function Planning() {
  let cap = [], load = [], plan = [];
  
  const results = await Promise.allSettled([
    sb("v_mps_capacity?select=*"),
    sb("v_mps_line_load?select=*"),
    sb("v_mps_plan?select=*&order=net_requirement.desc&limit=40"),
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  cap = getVal(results[0]);
  load = getVal(results[1]);
  plan = getVal(results[2]);

  const hasData = results.some(r => r.status === "fulfilled");
  if (!hasData) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>Database connection failed or returned no data.</pre>
        <p>Make sure migrations 0016 &amp; 0017 have been run.</p>
      </div>
    );
  }

  const needCount = plan.filter((r) => Number(r.net_requirement) > 0).length;
  const overLines = cap.filter((r) => r.status === "Over capacity").length;

  const srcCounts = {};
  for (const r of plan) srcCounts[r.demand_source] = (srcCounts[r.demand_source] || 0) + 1;
  const dominant = Object.entries(srcCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const usingForecast = dominant === "Forecast baseline";

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Planning — MPS</h1>
          <div className="page-sub">
            Weekly production plan · demand vs line capacity · min stock 30 days · 3 shifts × 15.5 shift-weeks
          </div>
        </div>
        <a className="btn-export" href="/api/export?view=v_mps_plan">↓ Export CSV</a>
      </div>

      <div className="note-banner">
        <span className="ic">{usingForecast ? "🎯" : "📊"}</span>
        <div>
          <b>Demand source: {dominant || "—"}.</b>{" "}
          {usingForecast
            ? "MPS is driven by the published forecast baseline (monthly ÷ 4.345 = weekly rate)."
            : "No forecast baseline published yet — MPS uses the 12-week sales run-rate. Publish a baseline in the Forecast tab to switch."}
        </div>
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon accent"><IconServer /></div>
          <div>
            <div className="kpi-label">Production Lines</div>
            <div className="kpi-value">{fmt(cap.filter((c) => c.weekly_capacity).length)}</div>
            <div className="kpi-sub">with defined capacity</div>
          </div>
        </div>
        <div className="card kpi-card" style={{ borderColor: overLines > 0 ? "var(--red)" : undefined }}>
          <div className="kpi-icon red" style={{ background: overLines > 0 ? "var(--red-soft)" : undefined, color: overLines > 0 ? "var(--red)" : "var(--green)" }}><IconAlertCircle /></div>
          <div>
            <div className="kpi-label">Lines Over Capacity</div>
            <div className="kpi-value" style={{ color: overLines ? "var(--red)" : "var(--green)" }}>{fmt(overLines)}</div>
            <div className="kpi-sub">demand &gt; weekly capacity</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon amber"><IconArrowDownCircle /></div>
          <div>
            <div className="kpi-label">SKUs Below Min</div>
            <div className="kpi-value" style={{ color: "var(--amber)" }}>{fmt(needCount)}</div>
            <div className="kpi-sub">need production to reach 30-day stock</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon muted"><IconActivity /></div>
          <div>
            <div className="kpi-label">Busiest Line</div>
            <div className="kpi-value" style={{ fontSize: 18 }}>{cap[0] ? cap[0].prod_line : "—"}</div>
            <div className="kpi-sub">{cap[0] && cap[0].utilization_pct != null ? cap[0].utilization_pct + "% util." : "—"}</div>
          </div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Line Capacity Utilization</h2>
        <div className="card-note">weekly demand vs weekly capacity per production line</div>
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
                <th>Demand</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((r, i) => (
                <tr key={i}>
                  <td className="name"><Link href={`/deep-dive?sku=${encodeURIComponent(r.sku_name)}`} style={{color:"inherit",textDecoration:"none"}}>{r.sku_name}</Link></td>
                  <td>{r.prod_line}</td>
                  <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier}</span></td>
                  <td className="num">{fmt(r.weekly_demand)}</td>
                  <td className="num">{fmt(r.soh)}</td>
                  <td className="num" style={{ color: Number(r.weeks_cover) < 1 ? "var(--red)" : Number(r.weeks_cover) < 4.3 ? "var(--amber)" : "var(--green)" }}>
                    {r.weeks_cover == null ? "—" : r.weeks_cover}
                  </td>
                  <td className="num">{fmt(r.target_stock_30d)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmt(r.net_requirement)}</td>
                  <td><span className={"badge " + (r.demand_source === "Forecast baseline" ? "growing" : "")}>{r.demand_source === "Forecast baseline" ? "Forecast" : "Run-rate"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
