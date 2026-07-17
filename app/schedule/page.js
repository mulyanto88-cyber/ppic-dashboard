import { sb } from "../../lib/supabase";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function Schedule() {
  let plan = [], pattern = [], capacity = [], meta = null, error = null;
  try {
    const [a, b, c, d] = await Promise.all([
      sb("v_mps_plan?select=sku_name,prod_line,abc_tier,xyz_class,weekly_demand,soh,target_stock_30d,demand_source"),
      sb("v_weekly_pattern?select=*"),
      sb("v_mps_capacity?select=prod_line,weekly_capacity"),
      sb("v_forecast_baseline_meta?select=*"),
    ]);
    plan = a || []; pattern = b || []; capacity = c || []; meta = (d && d[0]) || null;
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
        <p>Make sure migrations through 0035 (v_weekly_pattern) have been run in Supabase.</p>
      </div>
    );
  }

  return <ScheduleClient plan={plan} pattern={pattern} capacity={capacity} meta={meta} />;
}
