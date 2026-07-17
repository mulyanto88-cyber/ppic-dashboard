import { sb } from "../../lib/supabase";
import DeepDiveClient from "./DeepDiveClient";
import { saveSkuMaster, deleteSkuMaster, bulkUploadSkuMaster } from "./actions";
import { seriesFromMatrix, champion, forecastForward } from "../../lib/forecast";

export const dynamic = "force-dynamic";

export default async function DeepDive({ searchParams }) {
  const sku = searchParams?.sku || "";

  // 1. Fetch Sku List for Picker and Product Master List for Editor
  let skuList = [];
  let productMasterList = [];
  try {
    const [listRes, masterRes] = await Promise.all([
      sb("v_sku_segmentation?select=sku_name&order=qty_12m.desc"),
      sb("product_master?select=*&order=sku_name.asc")
    ]);
    skuList = (listRes || []).map((r) => r.sku_name);
    productMasterList = masterRes || [];
  } catch (e) {
    return <div className="card error"><h2>Failed to load master metadata</h2><pre>{e.message}</pre></div>;
  }

  let detail = null, error = null;
  if (sku) {
    const enc = encodeURIComponent(sku);
    try {
      const results = await Promise.allSettled([
        sb(`v_sku_segmentation?sku_name=ilike.${enc}`),
        sb(`v_sku_value?sku_name=ilike.${enc}`),
        sb(`v_inventory_fg?sku_name=ilike.${enc}`),
        sb(`v_sku_monthly_matrix?sku_name=ilike.${enc}`),
        sb(`sales_monthly?select=month,qty_delivered&sku_name=ilike.${enc}&order=month.asc`),
        sb(`bom?select=component,per_pcs&product=ilike.${enc}&order=component.asc`),
        sb(`v_mrp?select=component,uom,weeks_cover,status`),
        sb(`v_stock_position?select=product,uom,soh,po_incoming`),
      ]);
      const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
      const seg = getVal(results[0]);
      const val = getVal(results[1]);
      const inv = getVal(results[2]);
      const matrix = getVal(results[3]);
      const sales = getVal(results[4]);
      const bom = getVal(results[5]);
      const mrp = getVal(results[6]);
      const stock = getVal(results[7]);

      const cleanSeriesMap = seriesFromMatrix(matrix);
      const cleanSeries = Object.values(cleanSeriesMap)[0] || [];

      let champMethod = "wma";
      let champForecast = [];
      if (cleanSeries.length >= 4) {
        const champ = champion(cleanSeries);
        champMethod = champ.method;
        champForecast = forecastForward(cleanSeries, champMethod, { h: 3, skipCurrent: true });
      }

      const matMap = {};
      for (const m of mrp) matMap[(m.component || "").toUpperCase().trim()] = m;
      
      const stockMap = {};
      for (const s of stock) stockMap[(s.product || "").toUpperCase().trim()] = s;

      const ym = (dateStr) => {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        return d.toLocaleDateString("id-ID", { year: "numeric", month: "short" });
      };

      detail = {
        seg: seg[0] || {},
        val: val[0] || {},
        inv: inv[0] || {},
        fc: champForecast,
        champMethod,
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
    <DeepDiveClient
      skuList={skuList}
      currentSku={sku}
      detail={detail}
      productMasterList={productMasterList}
      saveSkuMasterAction={saveSkuMaster}
      deleteSkuMasterAction={deleteSkuMaster}
      bulkUploadSkuMasterAction={bulkUploadSkuMaster}
    />
  );
}
