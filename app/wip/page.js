import { sb } from "../../lib/supabase";
import WipClient from "./WipClient";

export const dynamic = "force-dynamic";

export default async function WipMonitoring() {
  let wipRows = [], materialMaster = [], mrpData = [];

  const maxDateResult = await sb("mo_wip?select=snapshot_date&order=snapshot_date.desc&limit=1");
  const maxDate = maxDateResult?.[0]?.snapshot_date || "";

  const results = await Promise.allSettled([
    maxDate
      ? sb(`mo_wip?select=*&snapshot_date=eq.${maxDate}&order=wip_qty.desc`)
      : sb("mo_wip?select=*&order=wip_qty.desc"),
    sb("material_master?select=*"),
    sb("v_mrp?select=component,weeks_cover,status,weekly_consumption,total_position"),
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  wipRows = getVal(results[0]);
  materialMaster = getVal(results[1]);
  mrpData = getVal(results[2]);

  const vendorMap = {};
  for (const m of materialMaster) {
    vendorMap[m.material_name.toUpperCase()] = m.vendor_name || "";
  }

  const mrpMap = {};
  for (const r of mrpData) {
    mrpMap[r.component.toUpperCase()] = r;
  }

  const enriched = wipRows.map((r) => ({
    component: r.component,
    wip_qty: Number(r.wip_qty) || 0,
    snapshot_date: r.snapshot_date,
    vendor: vendorMap[r.component.toUpperCase()] || "—",
    mrp_status: mrpMap[r.component.toUpperCase()]?.status || null,
    weeks_cover: mrpMap[r.component.toUpperCase()]?.weeks_cover || null,
    weekly_consumption: mrpMap[r.component.toUpperCase()]?.weekly_consumption || null,
    total_position: mrpMap[r.component.toUpperCase()]?.total_position || null,
  })).sort((a, b) => b.wip_qty - a.wip_qty);

  const totalWip = enriched.reduce((s, r) => s + r.wip_qty, 0);
  const criticalCount = enriched.filter((r) => r.mrp_status === "Critical").length;
  const belowMinCount = enriched.filter((r) => r.mrp_status === "Below Min").length;

  return (
    <WipClient
      rows={enriched}
      kpi={{
        totalWip,
        componentCount: enriched.length,
        criticalCount,
        belowMinCount,
        snapshotDate: maxDate,
      }}
    />
  );
}
