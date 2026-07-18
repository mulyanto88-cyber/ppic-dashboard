import { sb, sbAll } from "../../lib/supabase";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryHealth() {
  let kpi = {}, byMove = [], cover = [], inv = [], stockPosition = [], productMaster = [], skuValue = [];
  
  const results = await Promise.allSettled([
    sb("v_kpi_inventory_value?select=*"),
    sb("v_inventory_by_movement?select=*"),
    sb("v_mps_cover?select=*&order=weeks_of_cover.asc"),
    sb("v_inventory_fg?select=*&order=soh_value_est.desc"),
    sbAll("v_stock_position?select=*&order=total_position.desc"), // 1.428 baris > limit 1000 → wajib paginasi
    sb("product_master?select=sku_name,status"),
    sb("v_sku_value?select=sku_name,avg_price_idr"),
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  kpi = getVal(results[0])[0] || {};
  byMove = getVal(results[1]);
  cover = getVal(results[2]);
  inv = getVal(results[3]);
  stockPosition = getVal(results[4]);
  productMaster = getVal(results[5]);
  skuValue = getVal(results[6]);

  const hasData = results.some(r => r.status === "fulfilled");
  if (!hasData) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>Database connection failed or returned no data.</pre>
        <p>Make sure migrations up to 0015 have been run and the Stock ETL has loaded.</p>
      </div>
    );
  }

  return (
    <InventoryClient
      kpi={kpi}
      byMove={byMove}
      cover={cover}
      inv={inv}
      stockPosition={stockPosition}
      productMaster={productMaster}
      skuValue={skuValue}
    />
  );
}
