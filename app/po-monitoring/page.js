import { sb } from "../../lib/supabase";
import { fmt } from "../../lib/format";

export const dynamic = "force-dynamic";

// Tampilkan qty outstanding dengan satuan; gram -> kg biar proper
function outDisp(r) {
  if (r.uom === "g" && r.outstanding_kg != null) return fmt(r.outstanding_kg) + " kg";
  return fmt(r.outstanding_qty) + (r.uom ? " " + r.uom : "");
}

export default async function POMonitoring() {
  let kpi = {}, vendors = [], lines = [], error = null;
  try {
    const [a, b, c] = await Promise.all([
      sb("v_po_monitoring_kpi?select=*"),
      sb("v_po_vendor_summary?select=*&limit=15"),
      sb("v_po_open_lines?select=*&limit=40"),
    ]);
    kpi = (a && a[0]) || {}; vendors = b || []; lines = c || [];
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
        <p>Make sure migration 0014 has been run and the Stock ETL loaded po_open.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">PO Monitoring</h1>
        <div className="page-sub">Open purchase orders · outstanding = ordered − received · for supplier follow-up</div>
      </div>

      <section className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Open PO Lines</div>
          <div className="kpi-value">{fmt(kpi.open_lines)}</div>
          <div className="kpi-sub">lines not fully received</div>
        </div>
        <div className="card">
          <div className="kpi-label">Open POs</div>
          <div className="kpi-value">{fmt(kpi.open_pos)}</div>
          <div className="kpi-sub">purchase orders</div>
        </div>
        <div className="card">
          <div className="kpi-label">Products Awaiting</div>
          <div className="kpi-value">{fmt(kpi.open_products)}</div>
          <div className="kpi-sub">distinct materials</div>
        </div>
        <div className="card">
          <div className="kpi-label">Vendors</div>
          <div className="kpi-value">{fmt(kpi.vendors)}</div>
          <div className="kpi-sub">with open lines</div>
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
