import { sb, sbAll } from "../lib/supabase";
import DemandAnalyticsClient from "./DemandAnalyticsClient";

export const dynamic = "force-dynamic";

export default async function DemandAnalytics() {
  let revenue = [], weekly = [], skuValue = [], seg = [],
    recent = [], watch = [], productMaster = [],
    salesMonthly18 = [], salesWeekly12 = [];

  const results = await Promise.allSettled([
    sb("v_revenue_monthly?select=*&order=month.asc"),
    sb("v_weekly_trend?select=*&order=week_start.asc"),
    sb("v_sku_value?select=*&order=value_12m.desc"),
    sb("v_sku_segmentation?select=sku_name,abc_tier,movement_class,xyz_class,trend,type"),
    sb("v_sku_recent_sales?select=*"),
    sb("v_sku_trend_watch?select=*&limit=24"),
    sbAll("product_master?select=sku_name,brand,type,sub_category,series,status"),
  ]);

  const getVal = (res) => (res.status === "fulfilled" ? res.value || [] : []);

  revenue = getVal(results[0]);
  weekly = getVal(results[1]);
  skuValue = getVal(results[2]);
  seg = getVal(results[3]);
  recent = getVal(results[4]);
  watch = getVal(results[5]);
  productMaster = getVal(results[6]);

  const hasData = results.some((r) => r.status === "fulfilled");
  if (!hasData) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>Database connection failed or returned no data.</pre>
      </div>
    );
  }

  const lastMonth = revenue.length ? revenue[revenue.length - 1].month : null;

  // Calculate min month for 18-month range
  let minMonthStr = "2025-01-01";
  if (lastMonth) {
    const d18 = new Date(lastMonth);
    d18.setMonth(d18.getMonth() - 17);
    minMonthStr = d18.toISOString().slice(0, 7) + "-01";
  }

  // Calculate min week_start for 12-week range
  const minWeekStr = weekly.length ? weekly[0].week_start : "2026-04-01";

  // Fetch detailed monthly and weekly sales for dynamic filtering
  try {
    const [smRes, swRes] = await Promise.allSettled([
      sbAll(`sales_monthly?select=sku_name,month,qty_delivered&month=gte.${minMonthStr}`),
      sbAll(`sales_weekly?select=sku_name,week_start,qty,iso_week&week_start=gte.${minWeekStr}`),
    ]);
    salesMonthly18 = getVal(smRes);
    salesWeekly12 = getVal(swRes);
  } catch (e) {
    console.error("Failed to load filtered sales details:", e);
  }

  return (
    <DemandAnalyticsClient
      productMaster={productMaster}
      skuValue={skuValue}
      skuSegmentation={seg}
      recentSales={recent}
      trendWatch={watch}
      revenueMonthly={revenue}
      weeklyTrend={weekly}
      salesMonthly18={salesMonthly18}
      salesWeekly12={salesWeekly12}
      lastMonth={lastMonth}
    />
  );
}
