import { sb } from "../../lib/supabase";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryHealth() {
  let kpi = {}, byMove = [], cover = [], inv = [], stockPosition = [];
  
  const results = await Promise.allSettled([
    sb("v_kpi_inventory_value?select=*"),
    sb("v_inventory_by_movement?select=*"),
    sb("v_mps_cover?select=*&order=weeks_of_cover.asc"),
    sb("v_inventory_fg?select=*&order=soh_value_est.desc"),
    sb("v_stock_position?select=*&order=total_position.desc"),
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  kpi = getVal(results[0])[0] || {};
  byMove = getVal(results[1]);
  cover = getVal(results[2]);
  inv = getVal(results[3]);
  stockPosition = getVal(results[4]);

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
    />
  );
}
