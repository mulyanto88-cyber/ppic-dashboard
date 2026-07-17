import { sb } from "../../lib/supabase";
import ForecastClient from "./ForecastClient";

export const dynamic = "force-dynamic";

export default async function Forecast() {
  let series = [], seg = [], val = [], error = null;
  try {
    const [a, b, c] = await Promise.all([
      sb("v_sku_monthly_series?select=sku_name,month,qty"),
      sb("v_sku_segmentation?select=sku_name,type,abc_tier,xyz_class,trend,qty_12m"),
      sb("v_sku_value?select=sku_name,value_12m,abc_tier_value&order=value_12m.desc"),
    ]);
    series = a || []; seg = b || []; val = c || [];
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
        <p>Make sure migration 0026 (v_sku_monthly_series) has been run in Supabase.</p>
      </div>
    );
  }

  return <ForecastClient series={series} seg={seg} val={val} />;
}
