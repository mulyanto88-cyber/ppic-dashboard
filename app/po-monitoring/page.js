import { sb } from "../../lib/supabase";
import POMonitoringClient from "./POMonitoringClient";

export const dynamic = "force-dynamic";

export default async function POMonitoring() {
  const results = await Promise.allSettled([
    sb("v_po_monitoring_kpi?select=*"),
    sb("v_po_pipeline?select=*"),
    sb("v_po_gap?select=*"),
    sb("v_po_vendor_summary?select=*&limit=20"),
    sb("v_po_forceclosed?select=*&limit=15"),
    sb("purchase_order_line?select=snapshot_date&order=snapshot_date.desc&limit=1"),
  ]);

  const getVal = (res) => (res.status === "fulfilled" ? res.value || [] : []);
  const kpi = getVal(results[0])[0] || {};
  const pipeline = getVal(results[1]);
  const gap = getVal(results[2]);
  const vendors = getVal(results[3]);
  const forceclosed = getVal(results[4]);
  const snapshotDate = getVal(results[5])[0]?.snapshot_date || null;

  const hasData = results.some((r) => r.status === "fulfilled");
  if (!hasData) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>Database connection failed or returned no data.</pre>
        <p>Make sure migration 0043 has been run and the PO ETL loaded purchase_order_line.</p>
      </div>
    );
  }
  if (results[1].status === "rejected") {
    return (
      <div className="card error">
        <h2>PO Monitoring v2 views missing</h2>
        <pre>{results[1].reason?.message || "v_po_pipeline not found"}</pre>
        <p>Run migration 0043 (v_po_pipeline, v_po_gap, v_po_forceclosed) in Supabase SQL Editor.</p>
      </div>
    );
  }

  return (
    <POMonitoringClient
      kpi={kpi}
      pipeline={pipeline}
      gap={gap}
      vendors={vendors}
      forceclosed={forceclosed}
      snapshotDate={snapshotDate}
    />
  );
}
