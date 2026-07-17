import { sb } from "../../lib/supabase";
import ForecastClient from "./ForecastClient";

export const dynamic = "force-dynamic";

export default async function Forecast() {
  let matrix = [], seg = [], val = [], meta = null, error = null;
  try {
    const results = await Promise.allSettled([
      sb("v_sku_monthly_matrix?select=sku_name,start_month,qtys"),
      sb("v_sku_segmentation?select=sku_name,type,abc_tier,xyz_class,trend,qty_12m"),
      sb("v_sku_value?select=sku_name,value_12m,abc_tier_value&order=value_12m.desc"),
      sb("v_forecast_baseline_meta?select=*"),
    ]);
    const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
    matrix = getVal(results[0]);
    seg = getVal(results[1]);
    val = getVal(results[2]);
    meta = getVal(results[3])[0] || null;
    
    if (results[0].status === "rejected") {
       error = "Failed to load matrix data: " + results[0].reason?.message;
    }
  } catch (e) {
    error = e.message;
  }

  // Live performance (published vs actual) — try/catch terpisah supaya halaman
  // tetap jalan bila migrasi 0029 belum dijalankan.
  let live = [], liveDetail = [], liveErr = null;
  try {
    const [e, f] = await Promise.all([
      sb("v_forecast_accuracy_live?select=*"),
      sb("v_forecast_vs_actual?select=*&order=forecast_month.desc,abs_error.desc&limit=300"),
    ]);
    live = e || []; liveDetail = f || [];
  } catch (e) {
    liveErr = e.message;
  }

  // Best Estimate bulan berjalan (0031) — terpisah juga; tanpa view ini kolom
  // BE hanya tidak muncul, halaman tetap jalan.
  let be = [];
  try {
    be = (await sb("v_current_month_be?select=*")) || [];
  } catch (e) {
    be = [];
  }

  // Scope coverage (% volume tercakup Continue FG) untuk badge — resilient
  let scope = null;
  try {
    const s = await sb("v_forecast_scope_coverage?select=*");
    scope = (s && s[0]) || null;
  } catch (e) {
    scope = null;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
        <p>Make sure migration 0030 (v_sku_monthly_matrix) has been run in Supabase.</p>
      </div>
    );
  }

  return (
    <ForecastClient
      matrix={matrix} seg={seg} val={val} meta={meta}
      live={live} liveDetail={liveDetail} liveErr={liveErr} be={be} scope={scope}
    />
  );
}
