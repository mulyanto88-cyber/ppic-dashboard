import { sb, sbAll } from "../../lib/supabase";
import DeepDiveClient from "./DeepDiveClient";
import {
  saveSkuMaster,
  deleteSkuMaster,
  bulkUploadSkuMaster,
  saveMaterialMaster,
  deleteMaterialMaster,
  bulkUploadMaterialMaster
} from "./actions";
import { seriesFromMatrix, champion, forecastForward } from "../../lib/forecast";

export const dynamic = "force-dynamic";

export default async function DeepDive({ searchParams }) {
  const sku = searchParams?.sku || "";

  // 1. Fetch Master Lists to populate Picker and Editors
  let pickerItems = [];
  let productMasterList = [];
  let materialMasterList = [];
  try {
    const [listRes, masterRes, materialRes] = await Promise.all([
      sb("v_sku_segmentation?select=sku_name&order=qty_12m.desc"),
      sb("product_master?select=*&order=sku_name.asc"),
      sbAll("material_master?select=*&order=material_name.asc") // 1.030 baris > limit 1000
    ]);

    const fgs = (listRes || []).map((r) => ({ name: r.sku_name, type: "FG" }));
    const rmpms = (materialRes || []).map((r) => ({ name: r.material_name, type: "RMPM" }));
    pickerItems = [...fgs, ...rmpms];

    productMasterList = masterRes || [];
    materialMasterList = materialRes || [];
  } catch (e) {
    return <div className="card error"><h2>Failed to load master metadata</h2><pre>{e.message}</pre></div>;
  }

  let detail = null, error = null;
  if (sku) {
    const enc = encodeURIComponent(sku);
    try {
      // Check whether it is Finished Good (FG) or Raw & Packaging Material (RMPM)
      const [fgCheck, rmpmCheck] = await Promise.all([
        sb(`product_master?sku_name=eq.${enc}`),
        sb(`material_master?material_name=eq.${enc}`)
      ]);

      const isFg = fgCheck && fgCheck.length > 0;
      const isRmpm = rmpmCheck && rmpmCheck.length > 0;

      if (isFg) {
        const results = await Promise.allSettled([
          sb(`v_sku_segmentation?sku_name=ilike.${enc}`),
          sb(`v_sku_value?sku_name=ilike.${enc}`),
          sb(`v_inventory_fg?sku_name=ilike.${enc}`),
          sb(`v_sku_monthly_matrix?sku_name=ilike.${enc}`),
          sb(`sales_monthly?select=month,qty_delivered&sku_name=ilike.${enc}&order=month.asc`),
          sb(`bom?select=component,per_pcs&product=ilike.${enc}&order=component.asc`),
          sb(`v_mrp?select=component,uom,weeks_cover,status`),
          sbAll(`v_stock_position?select=product,uom,soh,po_incoming`), // >1000 baris — tanpa paginasi, stok komponen BOM bisa hilang acak
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
          type: "FG",
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
      } else if (isRmpm) {
        // Material Drill Down
        const results = await Promise.allSettled([
          sb(`v_mrp?component=eq.${enc}`),
          sb(`bom?select=product,per_pcs&component=eq.${enc}&order=product.asc`),
          sb(`v_sku_segmentation?select=sku_name,abc_tier,xyz_class`),
        ]);

        const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
        const mrpInfo = getVal(results[0])[0] || rmpmCheck[0];
        const usedInRaw = getVal(results[1]);
        const fgSeg = getVal(results[2]);

        const fgSegMap = {};
        for (const s of fgSeg) fgSegMap[(s.sku_name || "").toUpperCase().trim()] = s;

        const usedIn = usedInRaw.map((u) => {
          const key = (u.product || "").toUpperCase().trim();
          return {
            product: u.product,
            per_pcs: u.per_pcs,
            seg: fgSegMap[key] || {}
          };
        });

        detail = {
          type: "RMPM",
          mrp: mrpInfo,
          usedIn
        };
      }
    } catch (e) {
      error = e.message;
    }
  }

  return (
    <DeepDiveClient
      pickerItems={pickerItems}
      currentSku={sku}
      detail={detail}
      productMasterList={productMasterList}
      materialMasterList={materialMasterList}
      saveSkuMasterAction={saveSkuMaster}
      deleteSkuMasterAction={deleteSkuMaster}
      bulkUploadSkuMasterAction={bulkUploadSkuMaster}
      saveMaterialMasterAction={saveMaterialMaster}
      deleteMaterialMasterAction={deleteMaterialMaster}
      bulkUploadMaterialMasterAction={bulkUploadMaterialMaster}
    />
  );
}
