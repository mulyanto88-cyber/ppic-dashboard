import { sb } from "../../lib/supabase";
import MoMonitoringClient from "./MoMonitoringClient";

export const dynamic = "force-dynamic";

export default async function MoMonitoring() {
  let moHeaders = [], moWip = [], materialMaster = [];

  const maxDateResult = await sb("mo_header?select=snapshot_date&order=snapshot_date.desc&limit=1");
  const maxDate = maxDateResult?.[0]?.snapshot_date || "";

  const results = await Promise.allSettled([
    maxDate
      ? sb(`mo_header?select=*&snapshot_date=eq.${maxDate}&order=mo_reference`)
      : sb("mo_header?select=*&order=mo_reference"),
    sb(`mo_wip?select=*&snapshot_date=eq.${maxDate}`),
    sb("material_master?select=*"),
    sb("product_master?select=sku_name,type,status"),
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  moHeaders = getVal(results[0]);
  moWip = getVal(results[1]);
  materialMaster = getVal(results[2]);
  const productMaster = getVal(results[3]);

  const wipMap = {};
  for (const w of moWip) {
    wipMap[w.component.toUpperCase()] = w;
  }

  const vendorMap = {};
  for (const m of materialMaster) {
    vendorMap[m.material_name.toUpperCase()] = m.vendor_name || "";
  }

  const fgMap = {};
  for (const p of productMaster) {
    fgMap[p.sku_name.toUpperCase()] = p;
  }

  const enriched = moHeaders.map((mo) => ({
    ...mo,
    product_type: fgMap[mo.product?.toUpperCase()]?.type || "",
    product_status: fgMap[mo.product?.toUpperCase()]?.status || "",
  }));

  const activeMos = enriched.filter((m) => m.state?.toLowerCase() !== "done").length;
  const doneMos = enriched.filter((m) => m.state?.toLowerCase() === "done").length;
  const totalPlanned = enriched.reduce((s, m) => s + (Number(m.total_planned_qty) || 0), 0);

  return (
    <MoMonitoringClient
      moHeaders={enriched}
      moWip={moWip}
      wipMap={wipMap}
      vendorMap={vendorMap}
      kpi={{ activeMos, doneMos, totalMos: enriched.length, totalPlanned, snapshotDate: maxDate }}
    />
  );
}
