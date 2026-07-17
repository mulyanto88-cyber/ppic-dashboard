import { sb } from "../../lib/supabase";
import { fmt } from "../../lib/format";

export const dynamic = "force-dynamic";

// Tampilkan qty outstanding dengan satuan; gram -> kg biar proper
function outDisp(r) {
  if (r.uom === "g" && r.outstanding_kg != null) return fmt(r.outstanding_kg) + " kg";
  return fmt(r.outstanding_qty) + (r.uom ? " " + r.uom : "");
}

const IconList = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
const IconFileText = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const IconPackage = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
const IconTruck = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>;

export default async function POMonitoring() {
  let kpi = {}, vendors = [], lines = [];
  
  const results = await Promise.allSettled([
    sb("v_po_monitoring_kpi?select=*"),
    sb("v_po_vendor_summary?select=*&limit=15"),
    sb("v_po_open_lines?select=*&limit=40"),
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  kpi = getVal(results[0])[0] || {};
  vendors = getVal(results[1]);
  lines = getVal(results[2]);

  const hasData = results.some(r => r.status === "fulfilled");
  if (!hasData) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>Database connection failed or returned no data.</pre>
        <p>Make sure migration 0014 has been run and the Stock ETL loaded po_open.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">PO Monitoring</h1>
          <div className="page-sub">Open purchase orders · outstanding = ordered − received · for supplier follow-up</div>
        </div>
        <a className="btn-export" href="/api/export?view=v_po_open_lines">↓ Export CSV</a>
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon accent"><IconList /></div>
          <div>
            <div className="kpi-label">Open PO Lines</div>
            <div className="kpi-value">{fmt(kpi.open_lines)}</div>
            <div className="kpi-sub">lines not fully received</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon green"><IconFileText /></div>
          <div>
            <div className="kpi-label">Open POs</div>
            <div className="kpi-value">{fmt(kpi.open_pos)}</div>
            <div className="kpi-sub">purchase orders</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon amber"><IconPackage /></div>
          <div>
            <div className="kpi-label">Products Awaiting</div>
            <div className="kpi-value">{fmt(kpi.open_products)}</div>
            <div className="kpi-sub">distinct materials</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon muted"><IconTruck /></div>
          <div>
            <div className="kpi-label">Vendors</div>
            <div className="kpi-value">{fmt(kpi.vendors)}</div>
            <div className="kpi-sub">with open lines</div>
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">Open Lines by Vendor</h2>
          <div className="card-note">vendors to follow up, most open lines first</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Vendor</th><th className="num">Lines</th><th className="num">Products</th><th className="num">POs</th></tr></thead>
              <tbody>
                {vendors.map((v, i) => (
                  <tr key={i}>
                    <td className="name">{v.vendor}</td>
                    <td className="num">{fmt(v.open_lines)}</td>
                    <td className="num">{fmt(v.open_products)}</td>
                    <td className="num">{fmt(v.open_pos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Note on units</h2>
          <div className="card-note">why outstanding isn't summed across products</div>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            Outstanding quantities use different units of measure (grams, pieces, units),
            so a single grand total across products would be meaningless. Read each line
            in its own unit. Gram-based materials (VG, PG, SALTNIC) are shown in <b>kg</b>.
          </p>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Outstanding PO Lines</h2>
        <div className="card-note">largest outstanding first · % received shows fulfilment progress</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>PO Ref</th>
                <th>Vendor</th>
                <th>Product</th>
                <th className="num">Ordered</th>
                <th className="num">Outstanding</th>
                <th className="num">% Received</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((r, i) => (
                <tr key={i}>
                  <td>{r.order_reference}</td>
                  <td className="name">{r.vendor}</td>
                  <td className="name">{r.product}</td>
                  <td className="num">{fmt(r.qty)}{r.uom ? " " + r.uom : ""}</td>
                  <td className="num">{outDisp(r)}</td>
                  <td className="num" style={{ color: Number(r.pct_received) >= 80 ? "var(--green)" : Number(r.pct_received) > 0 ? "var(--amber)" : "var(--red)" }}>
                    {r.pct_received == null ? "—" : r.pct_received + "%"}
                  </td>
                  <td>{r.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
