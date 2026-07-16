import { sb } from "../../lib/supabase";
import { fmt, rp, ym } from "../../lib/format";
import SkuPicker from "./SkuPicker";

export const dynamic = "force-dynamic";

const MAT_BADGE = { Critical: "declining", "Below Min": "stable", OK: "growing" };

function Bars({ data, valueKey, labelKey }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="barchart">
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          <div className="bar" style={{ height: (Number(d[valueKey]) || 0) / max * 100 + "%" }} />
          <div className="bar-label">{d[labelKey]}</div>
        </div>
      ))}
    </div>
  );
}

export default async function DeepDive({ searchParams }) {
  const sku = searchParams?.sku || "";

  // daftar SKU untuk picker
  let skuList = [];
  try {
    const list = await sb("v_sku_segmentation?select=sku_name&order=qty_12m.desc");
    skuList = (list || []).map((r) => r.sku_name);
  } catch (e) {
    return <div className="card error"><h2>Failed to load</h2><pre>{e.message}</pre></div>;
  }

  let detail = null, error = null;
  if (sku) {
    const enc = encodeURIComponent(sku);
    try {
      const [seg, val, inv, fc, sales, bom, mrp] = await Promise.all([
        sb(`v_sku_segmentation?sku_name=ilike.${enc}`),
        sb(`v_sku_value?sku_name=ilike.${enc}`),
        sb(`v_inventory_fg?sku_name=ilike.${enc}`),
        sb(`v_forecast_monthly?sku_name=ilike.${enc}&order=forecast_month.asc`),
        sb(`sales_monthly?select=month,qty_delivered&sku_name=ilike.${enc}&order=month.asc`),
        sb(`bom?select=component,per_pcs&product=ilike.${enc}&order=component.asc`),
        sb(`v_mrp?select=component,uom,weeks_cover,status`),
      ]);
      const matMap = {};
      for (const m of mrp || []) matMap[(m.component || "").toUpperCase().trim()] = m;
      detail = {
        seg: (seg && seg[0]) || {},
        val: (val && val[0]) || {},
        inv: (inv && inv[0]) || {},
        fc: fc || [],
        sales: (sales || []).slice(-18).map((r) => ({ ...r, _lbl: ym(r.month) })),
        bom: (bom || []).map((b) => ({ ...b, mat: matMap[(b.component || "").toUpperCase().trim()] || {} })),
      };
    } catch (e) {
      error = e.message;
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Deep Dive</h1>
          <div className="page-sub">360° view of a single SKU — demand, forecast, stock & materials</div>
        </div>
      </div>

      <SkuPicker skus={skuList} current={sku} />

      {error && <div className="card error"><h2>Failed to load</h2><pre>{error}</pre></div>}

      {!sku && (
        <div className="card"><div className="gloss-empty">Search and pick a SKU above to see its full profile.</div></div>
      )}

      {sku && detail && (
        <>
          <div className="card">
            <h2 className="card-title">{detail.seg.sku_name || sku}</h2>
            <div className="card-note">Type: {detail.seg.type || "—"}</div>
            <div className="dd-badges">
              {detail.seg.abc_tier && <span className={"badge abc-" + String(detail.seg.abc_tier).toLowerCase()}>ABC-qty {detail.seg.abc_tier}</span>}
              {detail.val.abc_tier_value && <span className={"badge abc-" + String(detail.val.abc_tier_value).toLowerCase()}>ABC-value {detail.val.abc_tier_value}</span>}
              {detail.seg.xyz_class && <span className={"badge xyz-" + String(detail.seg.xyz_class).toLowerCase()}>{detail.seg.xyz_class}</span>}
              {detail.seg.movement_class && <span className={"badge " + String(detail.seg.movement_class).toLowerCase()}>{detail.seg.movement_class}</span>}
              {detail.seg.trend && <span className={"badge " + String(detail.seg.trend).toLowerCase()}>{detail.seg.trend}</span>}
            </div>
          </div>

          <section className="kpi-grid">
            <div className="card">
              <div className="kpi-label">Revenue (12 mo)</div>
              <div className="kpi-value">{rp(detail.val.value_12m)}</div>
              <div className="kpi-sub">{fmt(detail.seg.qty_12m)} units</div>
            </div>
            <div className="card">
              <div className="kpi-label">Stock on Hand</div>
              <div className="kpi-value">{fmt(detail.inv.soh_qty)}</div>
              <div className="kpi-sub">DOI {detail.inv.doi_days == null ? "—" : detail.inv.doi_days + " d"}</div>
            </div>
            <div className="card">
              <div className="kpi-label">Avg Price</div>
              <div className="kpi-value">{rp(detail.val.avg_price_idr)}</div>
              <div className="kpi-sub">per unit</div>
            </div>
            <div className="card">
              <div className="kpi-label">Forecast (next mo)</div>
              <div className="kpi-value">{detail.fc[0] ? fmt(detail.fc[0].forecast_qty) : "—"}</div>
              <div className="kpi-sub">WMA</div>
            </div>
          </section>

          <section className="grid-2">
            <div className="card">
              <h2 className="card-title">Monthly Sales</h2>
              <div className="card-note">last 18 months · units delivered</div>
              {detail.sales.length ? <Bars data={detail.sales} valueKey="qty_delivered" labelKey="_lbl" />
                : <div className="gloss-empty">No sales history.</div>}
            </div>
            <div className="card">
              <h2 className="card-title">Forecast — 3 Months</h2>
              <div className="card-note">WMA (0.6 / 0.3 / 0.1)</div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Month</th><th className="num">Forecast</th></tr></thead>
                  <tbody>
                    {detail.fc.map((r, i) => (
                      <tr key={i}><td>{ym(r.forecast_month)}</td><td className="num">{fmt(r.forecast_qty)}</td></tr>
                    ))}
                    {detail.fc.length === 0 && <tr><td colSpan={2} style={{ color: "var(--muted)" }}>No forecast.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <div className="card">
            <h2 className="card-title">Bill of Materials</h2>
            <div className="card-note">components per unit · material coverage from MRP</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Component</th><th className="num">Per Unit</th><th className="num">Wks Cover</th><th>Material Status</th></tr>
                </thead>
                <tbody>
                  {detail.bom.map((b, i) => (
                    <tr key={i}>
                      <td className="name">{b.component}</td>
                      <td className="num">{b.per_pcs}{b.mat.uom ? " " + b.mat.uom : ""}</td>
                      <td className="num">{b.mat.weeks_cover == null ? "—" : b.mat.weeks_cover}</td>
                      <td>{b.mat.status ? <span className={"badge " + (MAT_BADGE[b.mat.status] || "na")}>{b.mat.status}</span> : "—"}</td>
                    </tr>
                  ))}
                  {detail.bom.length === 0 && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>No BOM found for this SKU.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
