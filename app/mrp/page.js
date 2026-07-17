import { sb } from "../../lib/supabase";
import { fmt } from "../../lib/format";

export const dynamic = "force-dynamic";

const MRP_BADGE = { Critical: "declining", "Below Min": "stable", OK: "growing" };

// tampilkan qty dengan satuan; gram -> kg
function q(val, uom) {
  if (uom === "g") return fmt(Math.round(Number(val) / 1000)) + " kg";
  return fmt(val) + (uom ? " " + uom : "");
}

const IconLayers = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>;
const IconAlertTriangle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
const IconArrowDownCircle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 12 16 16 12"></polyline><line x1="12" y1="8" x2="12" y2="16"></line></svg>;
const IconShoppingCart = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>;

export default async function MRP() {
  let kpi = {}, rows = [];
  
  const results = await Promise.allSettled([
    sb("v_mrp_kpi?select=*"),
    sb("v_mrp?select=*&order=net_requirement.desc&limit=50"),
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  kpi = getVal(results[0])[0] || {};
  rows = getVal(results[1]);

  const hasData = results.some(r => r.status === "fulfilled");
  if (!hasData) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>Database connection failed or returned no data.</pre>
        <p>Make sure migration 0018 has been run (needs BOM, stock position &amp; demand).</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">MRP — Material Requirements</h1>
          <div className="page-sub">
            FG demand × BOM → weekly material consumption vs stock position · min stock 45 days
          </div>
        </div>
        <a className="btn-export" href="/api/export?view=v_mrp">↓ Export CSV</a>
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon accent"><IconLayers /></div>
          <div>
            <div className="kpi-label">Materials Planned</div>
            <div className="kpi-value">{fmt(kpi.materials)}</div>
            <div className="kpi-sub">components with demand</div>
          </div>
        </div>
        <div className="card kpi-card" style={{ borderColor: kpi.critical > 0 ? "var(--red)" : undefined }}>
          <div className="kpi-icon red" style={{ background: kpi.critical > 0 ? "var(--red-soft)" : undefined, color: kpi.critical > 0 ? "var(--red)" : "var(--green)" }}><IconAlertTriangle /></div>
          <div>
            <div className="kpi-label">Critical</div>
            <div className="kpi-value" style={{ color: kpi.critical > 0 ? "var(--red)" : "var(--green)" }}>{fmt(kpi.critical)}</div>
            <div className="kpi-sub">&lt; 2 weeks cover (≈ lead time)</div>
          </div>
        </div>
        <div className="card kpi-card" style={{ borderColor: kpi.below_min > 0 ? "var(--amber)" : undefined }}>
          <div className="kpi-icon amber"><IconArrowDownCircle /></div>
          <div>
            <div className="kpi-label">Below Min</div>
            <div className="kpi-value" style={{ color: "var(--amber)" }}>{fmt(kpi.below_min)}</div>
            <div className="kpi-sub">&lt; 45-day stock</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon muted"><IconShoppingCart /></div>
          <div>
            <div className="kpi-label">Need to Order</div>
            <div className="kpi-value">{fmt(kpi.need_order)}</div>
            <div className="kpi-sub">net requirement &gt; 0</div>
          </div>
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
