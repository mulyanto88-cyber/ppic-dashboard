import { sb } from "../../lib/supabase";
import { fmt } from "../../lib/format";

export const dynamic = "force-dynamic";

const MRP_BADGE = { Critical: "declining", "Below Min": "stable", OK: "growing" };

// tampilkan qty dengan satuan; gram -> kg
function q(val, uom) {
  if (uom === "g") return fmt(Math.round(Number(val) / 1000)) + " kg";
  return fmt(val) + (uom ? " " + uom : "");
}

export default async function MRP() {
  let kpi = {}, rows = [], error = null;
  try {
    const [a, b] = await Promise.all([
      sb("v_mrp_kpi?select=*"),
      sb("v_mrp?select=*&order=net_requirement.desc&limit=50"),
    ]);
    kpi = (a && a[0]) || {}; rows = b || [];
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
        <p>Make sure migration 0018 has been run (needs BOM, stock position &amp; demand).</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">MRP — Material Requirements</h1>
        <div className="page-sub">
          FG demand × BOM → weekly material consumption vs stock position · min stock 45 days
        </div>
      </div>

      <section className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Materials Planned</div>
          <div className="kpi-value">{fmt(kpi.materials)}</div>
          <div className="kpi-sub">components with demand</div>
        </div>
        <div className="card">
          <div className="kpi-label">Critical</div>
          <div className="kpi-value" style={{ color: "var(--red)" }}>{fmt(kpi.critical)}</div>
          <div className="kpi-sub">&lt; 2 weeks cover (≈ lead time)</div>
        </div>
        <div className="card">
          <div className="kpi-label">Below Min</div>
          <div className="kpi-value" style={{ color: "var(--amber)" }}>{fmt(kpi.below_min)}</div>
          <div className="kpi-sub">&lt; 45-day stock</div>
        </div>
        <div className="card">
          <div className="kpi-label">Need to Order</div>
          <div className="kpi-value">{fmt(kpi.need_order)}</div>
          <div className="kpi-sub">net requirement &gt; 0</div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Material Requirements — Order Priority</h2>
        <div className="card-note">
          net requirement = 45-day target − stock position (SOH + PO incoming + MO WIP) · gram shown as kg
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Vendor</th>
                <th className="num">Use/wk</th>
                <th className="num">SOH</th>
                <th className="num">PO In</th>
                <th className="num">WIP</th>
                <th className="num">Position</th>
                <th className="num">Wks Cover</th>
                <th className="num">Net Req.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="name">{r.component}</td>
                  <td className="name">{r.vendor}</td>
                  <td className="num">{q(r.weekly_consumption, r.uom)}</td>
                  <td className="num">{q(r.soh, r.uom)}</td>
                  <td className="num">{q(r.po_incoming, r.uom)}</td>
                  <td className="num">{q(r.mo_wip, r.uom)}</td>
                  <td className="num">{q(r.total_position, r.uom)}</td>
                  <td className="num" style={{ color: Number(r.weeks_cover) < 2 ? "var(--red)" : Number(r.weeks_cover) < 6.43 ? "var(--amber)" : "var(--green)" }}>
                    {r.weeks_cover == null ? "—" : r.weeks_cover}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {r.uom === "g" ? (r.net_requirement_kg != null ? fmt(r.net_requirement_kg) + " kg" : "—") : fmt(r.net_requirement)}
                  </td>
                  <td><span className={"badge " + (MRP_BADGE[r.status] || "na")}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
