import { sb } from "../../lib/supabase";
import { fmt, rp, ym } from "../../lib/format";
import SkuPicker from "./SkuPicker";

export const dynamic = "force-dynamic";

const MAT_BADGE = { Critical: "declining", "Below Min": "stable", OK: "growing" };

const IconDollarSign = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const IconPackage = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
const IconTag = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>;
const IconTrendingUp = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;

function Bars({ data, valueKey, labelKey }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="barchart">
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          <div className="bar hl" style={{ height: (Number(d[valueKey]) || 0) / max * 100 + "%", transition: "all 0.2s ease-in-out" }} />
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
      const results = await Promise.allSettled([
        sb(`v_sku_segmentation?sku_name=ilike.${enc}`),
        sb(`v_sku_value?sku_name=ilike.${enc}`),
        sb(`v_inventory_fg?sku_name=ilike.${enc}`),
        sb(`v_forecast_monthly?sku_name=ilike.${enc}&order=forecast_month.asc`),
        sb(`sales_monthly?select=month,qty_delivered&sku_name=ilike.${enc}&order=month.asc`),
        sb(`bom?select=component,per_pcs&product=ilike.${enc}&order=component.asc`),
        sb(`v_mrp?select=component,uom,weeks_cover,status`),
        sb(`v_stock_position?select=product,uom,soh,po_incoming`),
      ]);
      const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
      const seg = getVal(results[0]);
      const val = getVal(results[1]);
      const inv = getVal(results[2]);
      const fc = getVal(results[3]);
      const sales = getVal(results[4]);
      const bom = getVal(results[5]);
      const mrp = getVal(results[6]);
      const stock = getVal(results[7]);

      const matMap = {};
      for (const m of mrp) matMap[(m.component || "").toUpperCase().trim()] = m;
      
      const stockMap = {};
      for (const s of stock) stockMap[(s.product || "").toUpperCase().trim()] = s;

      detail = {
        seg: seg[0] || {},
        val: val[0] || {},
        inv: inv[0] || {},
        fc: fc,
        sales: sales.slice(-18).map((r) => ({ ...r, _lbl: ym(r.month) })),
        bom: bom.map((b) => {
          const key = (b.component || "").toUpperCase().trim();
          return {
            ...b,
            mat: matMap[key] || {},
            stock: stockMap[key] || {},
          };
        }),
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
            <div className="card kpi-card">
              <div className="kpi-icon accent"><IconDollarSign /></div>
              <div>
                <div className="kpi-label">Revenue (12 mo)</div>
                <div className="kpi-value">{rp(detail.val.value_12m)}</div>
                <div className="kpi-sub">{fmt(detail.seg.qty_12m)} units</div>
              </div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-icon green"><IconPackage /></div>
              <div>
                <div className="kpi-label">Stock on Hand</div>
                <div className="kpi-value">{fmt(detail.inv.soh_qty)}</div>
                <div className="kpi-sub">DOI {detail.inv.doi_days == null ? "—" : detail.inv.doi_days + " d"}</div>
              </div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-icon amber"><IconTag /></div>
              <div>
                <div className="kpi-label">Avg Price</div>
                <div className="kpi-value">{rp(detail.val.avg_price_idr)}</div>
                <div className="kpi-sub">per unit</div>
              </div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-icon muted"><IconTrendingUp /></div>
              <div>
                <div className="kpi-label">Forecast (next mo)</div>
                <div className="kpi-value">{detail.fc[0] ? fmt(detail.fc[0].forecast_qty) : "—"}</div>
                <div className="kpi-sub">WMA</div>
              </div>
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
            <div className="card-note">components per unit · material stock & coverage from warehouse</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th className="num">Per Unit</th>
                    <th>Satuan</th>
                    <th className="num">Stock on Hand (SOH)</th>
                    <th className="num">PO Incoming</th>
                    <th className="num">Wks Cover</th>
                    <th>Material Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.bom.map((b, i) => {
                    const isG = (b.mat.uom || b.stock.uom) === "g";
                    const displayUom = isG ? "kg" : (b.mat.uom || b.stock.uom || "—");
                    
                    const formatVal = (v) => {
                      if (v == null) return "—";
                      const num = Number(v) || 0;
                      return isG ? (num / 1000).toFixed(1) : fmt(num);
                    };

                    const rawSoh = b.stock.soh ?? b.mat.soh;
                    const rawPO = b.stock.po_incoming ?? b.mat.po_incoming;

                    return (
                      <tr key={i}>
                        <td className="name">{b.component}</td>
                        <td className="num">{b.per_pcs}</td>
                        <td><span className="badge method">{isG ? "g" : displayUom}</span></td>
                        <td className="num">{formatVal(rawSoh)}</td>
                        <td className="num">{formatVal(rawPO)}</td>
                        <td className="num">{b.mat.weeks_cover == null ? "—" : b.mat.weeks_cover}</td>
                        <td>{b.mat.status ? <span className={"badge " + (MAT_BADGE[b.mat.status] || "na")}>{b.mat.status}</span> : <span className="badge na">No Demand</span>}</td>
                      </tr>
                    );
                  })}
                  {detail.bom.length === 0 && <tr><td colSpan={7} style={{ color: "var(--muted)" }}>No BOM found for this SKU.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
