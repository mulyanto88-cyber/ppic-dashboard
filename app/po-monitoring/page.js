import { sb } from "../../lib/supabase";
import { fmt, rp } from "../../lib/format";
import POMonitoringClient from "./POMonitoringClient";

export const dynamic = "force-dynamic";

const IconList = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
const IconFileText = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const IconPackage = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
const IconAlertTriangle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;

export default async function POMonitoring() {
  let kpi = {}, vendors = [], lines = [];
  
  const results = await Promise.allSettled([
    sb("v_po_monitoring_kpi?select=*"),
    sb("v_po_vendor_summary?select=*"), // fetch all vendors from the updated summary view
    sb("v_po_pipeline?select=*"), // fetch all active open lines from v_po_pipeline
    sb("v_po_by_status?select=*"),          // breakdown total PO by status (0046)
    sb("v_po_by_vendor?select=*&limit=15"), // breakdown total PO by vendor (0046)
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  kpi = getVal(results[0])[0] || {};
  vendors = getVal(results[1]);
  lines = getVal(results[2]);
  const byStatus = getVal(results[3]);
  const byVendor = getVal(results[4]);

  const hasData = results.some(r => r.status === "fulfilled");
  if (!hasData) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>Database connection failed or returned no data.</pre>
        <p>Make sure database migrations 0043-0045 have been run and the Odoo purchase_order_line table contains data.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">PO Monitoring &amp; Expediting</h1>
          <div className="page-sub">Odoo open purchase orders · outstanding = ordered − received · track ETAs and overdue shipments</div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <a className="btn-export" href="/api/export?view=v_po_pipeline&limit=10000">↓ Export Open Pipeline</a>
          <a className="btn-export" style={{ background: "none", border: "1px solid var(--border)" }} href="/api/export?view=v_po_vendor_summary&limit=1000">↓ Export Vendor Summary</a>
        </div>
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon accent"><IconList /></div>
          <div>
            <div className="kpi-label">Open PO Lines</div>
            <div className="kpi-value">{fmt(kpi.open_lines)}</div>
            <div className="kpi-sub">active lines waiting for delivery</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon green"><IconFileText /></div>
          <div>
            <div className="kpi-label">Open POs</div>
            <div className="kpi-value">{fmt(kpi.open_pos)}</div>
            <div className="kpi-sub">distinct purchase orders</div>
          </div>
        </div>
        <div className="card kpi-card" style={{ borderColor: (kpi.expedite_lines > 0) ? "var(--red)" : undefined }}>
          <div className="kpi-icon red" style={{ background: (kpi.expedite_lines > 0) ? "rgba(220, 53, 69, 0.1)" : undefined, color: (kpi.expedite_lines > 0) ? "var(--red)" : "var(--green)" }}><IconAlertTriangle /></div>
          <div>
            <div className="kpi-label">Expedite Lines</div>
            <div className="kpi-value" style={{ color: (kpi.expedite_lines > 0) ? "var(--red)" : "var(--green)" }}>{fmt(kpi.expedite_lines)}</div>
            <div className="kpi-sub">materials critical or below min</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon amber"><IconPackage /></div>
          <div>
            <div className="kpi-label">Awaiting Value</div>
            <div className="kpi-value" style={{ fontSize: "19px", color: "var(--amber)" }}>{rp(kpi.outstanding_value_idr)}</div>
            <div className="kpi-sub">locked capital in transit</div>
          </div>
        </div>
      </section>

      {(byStatus.length > 0 || byVendor.length > 0) && (
        <section className="grid-2">
          <div className="card">
            <h2 className="card-title">PO Book — by Status</h2>
            <div className="card-note">
              latest purchase.order snapshot · Draft = RFQ still running (common in FOOM flow) ·
              qty is mixed units (indicative) · value = qty × unit price
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th><th className="num">POs</th><th className="num">Lines</th>
                    <th className="num">Qty*</th><th className="num">Ordered Value</th>
                    <th className="num">Outst. Qty*</th><th className="num">Outst. Value</th>
                  </tr>
                </thead>
                <tbody>
                  {byStatus.map((s, i) => {
                    const lbl = s.status === "draft" ? "Draft (RFQ)" : s.status === "purchase" ? "Confirmed" : s.status === "done" ? "Done" : "Cancelled";
                    const cls = s.status === "draft" ? "stable" : s.status === "purchase" ? "growing" : s.status === "done" ? "method" : "declining";
                    return (
                      <tr key={i}>
                        <td><span className={"badge " + cls}>{lbl}</span></td>
                        <td className="num">{fmt(s.pos)}</td>
                        <td className="num">{fmt(s.lines)}</td>
                        <td className="num">{fmt(s.total_qty)}</td>
                        <td className="num">{rp(s.ordered_value_idr)}</td>
                        <td className="num">{fmt(s.outstanding_qty)}</td>
                        <td className="num" style={{ fontWeight: 600, color: Number(s.outstanding_value_idr) > 0 ? "var(--amber)" : "var(--muted)" }}>
                          {rp(s.outstanding_value_idr)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">PO Book — Top Vendors by Value</h2>
            <div className="card-note">total ordered vs outstanding value per vendor · top 15 · all statuses</div>
            <div className="table-wrap" style={{ maxHeight: "320px", overflowY: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Vendor</th><th className="num">POs</th><th className="num">Lines</th>
                    <th className="num">Ordered Value</th><th className="num">Outst. Value</th>
                  </tr>
                </thead>
                <tbody>
                  {byVendor.map((v, i) => (
                    <tr key={i}>
                      <td className="name">{v.vendor || "—"}</td>
                      <td className="num">{fmt(v.pos)}</td>
                      <td className="num">{fmt(v.lines)}</td>
                      <td className="num">{rp(v.ordered_value_idr)}</td>
                      <td className="num" style={{ fontWeight: 600, color: Number(v.outstanding_value_idr) > 0 ? "var(--amber)" : "var(--muted)" }}>
                        {rp(v.outstanding_value_idr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">Open Lines by Vendor</h2>
          <div className="card-note">Vendors sorted by number of critical lines and outstanding value.</div>
          <div className="table-wrap" style={{ maxHeight: "250px", overflowY: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="num">Open Lines</th>
                  <th className="num">Critical Lines</th>
                  <th className="num">POs</th>
                  <th className="num">Total Value</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v, i) => (
                  <tr key={i}>
                    <td className="name">{v.vendor}</td>
                    <td className="num">{fmt(v.open_lines)}</td>
                    <td className="num" style={{ color: v.critical_lines > 0 ? "var(--red)" : "var(--green)", fontWeight: v.critical_lines > 0 ? "bold" : "normal" }}>
                      {fmt(v.critical_lines)}
                    </td>
                    <td className="num">{fmt(v.open_pos)}</td>
                    <td className="num" style={{ color: "var(--muted)" }}>{rp(v.outstanding_value_idr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">PO Expediting Governance</h2>
          <div className="card-note">Why monitoring ETAs and actions is crucial for SCM &amp; PPIC:</div>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 10px 0" }}>
              1. <b>Expedite Alert:</b> Any PO line marked with <b>🚨 Expedite</b> represents material that is currently Critical or Below Min in MRP. These need urgent prioritizing!
            </p>
            <p style={{ margin: "0 0 10px 0" }}>
              2. <b>Stale POs:</b> Lines flagged as <b>⏳ Stale PO</b> have been open for more than 60 days with 0% received. Follow up to see if these should be force-closed or re-ordered.
            </p>
            <p style={{ margin: 0 }}>
              3. <b>SKU Drill-Down:</b> Click on any material name in the table below to jump directly into its <b>Deep Dive profile</b> to see where it is used, its current SOH, and its weekly consumption.
            </p>
          </div>
        </div>
      </section>

      <POMonitoringClient
        initialLines={lines}
        initialKpi={kpi}
        initialVendors={vendors}
      />
    </>
  );
}
