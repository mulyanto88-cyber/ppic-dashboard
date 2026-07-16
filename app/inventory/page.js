import { sb } from "../../lib/supabase";
import { fmt, rp } from "../../lib/format";

export const dynamic = "force-dynamic";

const COVER_BADGE = {
  Critical: "declining",
  "Below Min": "stable",
  Healthy: "growing",
  Overstock: "na",
};

export default async function InventoryHealth() {
  let kpi = {}, byMove = [], cover = [], inv = [], error = null;
  try {
    const [a, b, c, d] = await Promise.all([
      sb("v_kpi_inventory_value?select=*"),
      sb("v_inventory_by_movement?select=*"),
      sb("v_mps_cover?select=*&order=weeks_of_cover.asc"),
      sb("v_inventory_fg?select=*&order=soh_value_est.desc"),
    ]);
    kpi = (a && a[0]) || {}; byMove = b || []; cover = c || []; inv = d || [];
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
        <p>Make sure migrations up to 0015 have been run and the Stock ETL has loaded.</p>
      </div>
    );
  }

  // cover status distribution
  const statusOrder = ["Critical", "Below Min", "Healthy", "Overstock"];
  const statusCount = {};
  for (const r of cover) {
    if (r.cover_status) statusCount[r.cover_status] = (statusCount[r.cover_status] || 0) + 1;
  }
  // at-risk = Critical + Below Min, ranked by demand (wk_run_rate) — biggest exposure first
  const atRisk = cover
    .filter((r) => r.cover_status === "Critical" || r.cover_status === "Below Min")
    .sort((x, y) => Number(y.wk_run_rate || 0) - Number(x.wk_run_rate || 0))
    .slice(0, 15);
  // slow/dead with stock (value tied up)
  const slowDead = inv
    .filter((r) => (r.movement_class === "Slow" || r.movement_class === "Dead") && Number(r.soh_qty) > 0)
    .slice(0, 15);
  const slowDeadValue = inv
    .filter((r) => r.movement_class === "Slow" || r.movement_class === "Dead")
    .reduce((s, r) => s + Number(r.soh_value_est || 0), 0);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Inventory Health</h1>
        <div className="page-sub">Finished Goods · clean SOH · value = est. (SOH × avg sales price)</div>
      </div>

      <section className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Inventory Value (est.)</div>
          <div className="kpi-value">{rp(kpi.total_value_est)}</div>
          <div className="kpi-sub">{fmt(kpi.total_qty)} units on hand</div>
        </div>
        <div className="card">
          <div className="kpi-label">SKUs with Stock</div>
          <div className="kpi-value">{fmt(kpi.sku_with_stock)}</div>
          <div className="kpi-sub">of {fmt(kpi.sku_count)} active FG</div>
        </div>
        <div className="card">
          <div className="kpi-label">Stock-out SKUs</div>
          <div className="kpi-value" style={{ color: "var(--red)" }}>{fmt(kpi.stockout_sku)}</div>
          <div className="kpi-sub">zero on hand</div>
        </div>
        <div className="card">
          <div className="kpi-label">Slow / Dead Value</div>
          <div className="kpi-value" style={{ color: "var(--amber)" }}>{rp(slowDeadValue)}</div>
          <div className="kpi-sub">capital tied in slow/dead stock</div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">Weeks-of-Cover Status</h2>
          <div className="card-note">Critical &lt; 1 wk (lead time) · Below Min &lt; 30 d · Healthy · Overstock</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Status</th><th className="num">SKUs</th></tr></thead>
              <tbody>
                {statusOrder.map((s) => (
                  <tr key={s}>
                    <td><span className={"badge " + (COVER_BADGE[s] || "na")}>{s}</span></td>
                    <td className="num">{fmt(statusCount[s] || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Inventory by Velocity</h2>
          <div className="card-note">SOH & est. value per movement class</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Class</th><th className="num">SKUs</th><th className="num">SOH</th><th className="num">Est. Value</th><th className="num">Avg DOI</th></tr></thead>
              <tbody>
                {byMove.map((m, i) => (
                  <tr key={i}>
                    <td><span className={"badge " + String(m.movement_class || "").toLowerCase()}>{m.movement_class}</span></td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{fmt(m.soh_qty)}</td>
                    <td className="num">{rp(m.soh_value_est)}</td>
                    <td className="num">{m.avg_doi_days == null ? "—" : m.avg_doi_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">At-Risk — Low Cover, High Demand</h2>
        <div className="card-note">Critical / Below Min, ranked by weekly demand (biggest exposure first)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th><th>ABC</th><th className="num">SOH</th>
                <th className="num">Demand/wk</th><th className="num">Weeks Cover</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.map((r, i) => (
                <tr key={i}>
                  <td className="name">{r.sku_name}</td>
                  <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier}</span></td>
                  <td className="num">{fmt(r.soh)}</td>
                  <td className="num">{fmt(r.wk_run_rate)}</td>
                  <td className="num">{r.weeks_of_cover}</td>
                  <td><span className={"badge " + (COVER_BADGE[r.cover_status] || "na")}>{r.cover_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Slow / Dead Stock — Capital Tied Up</h2>
        <div className="card-note">SKUs with stock but Slow/Dead velocity · ranked by est. value</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>SKU</th><th>Type</th><th className="num">SOH</th><th className="num">Est. Value</th><th>Velocity</th><th>Trend</th></tr>
            </thead>
            <tbody>
              {slowDead.map((r, i) => (
                <tr key={i}>
                  <td className="name">{r.sku_name}</td>
                  <td>{r.type}</td>
                  <td className="num">{fmt(r.soh_qty)}</td>
                  <td className="num">{rp(r.soh_value_est)}</td>
                  <td><span className={"badge " + String(r.movement_class || "").toLowerCase()}>{r.movement_class}</span></td>
                  <td>{r.trend ? <span className={"badge " + String(r.trend).toLowerCase()}>{r.trend}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
