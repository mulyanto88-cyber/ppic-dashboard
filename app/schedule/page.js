import { sb } from "../../lib/supabase";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function Schedule() {
  let plan = [], pattern = [], capacity = [], meta = null, bomMatrix = [], error = null;
  const results = await Promise.allSettled([
    sb("v_mps_plan?select=sku_name,prod_line,abc_tier,xyz_class,weekly_demand,soh,target_stock_30d,demand_source"),
    sb("v_weekly_pattern?select=*"),
    sb("v_mps_capacity?select=prod_line,weekly_capacity"),
    sb("v_forecast_baseline_meta?select=*"),
    sb("v_bom_matrix?select=product,comps"),   // material gate (0039); resilient bila belum di-run
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  plan = getVal(results[0]);
  pattern = getVal(results[1]);
  capacity = getVal(results[2]);
  meta = getVal(results[3])[0] || null;
  bomMatrix = getVal(results[4]);

  const hasData = results.some(r => r.status === "fulfilled");
  if (!hasData) {
    error = "Database connection failed or returned no data.";
  } else if (plan.length === 0) {
    error = "No production plan rows. Check that v_mps_plan (migrations 0027–0028) is live and demand (baseline or run-rate) exists.";
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

  return <ScheduleClient plan={plan} pattern={pattern} capacity={capacity} meta={meta} bomMatrix={bomMatrix} />;
}
