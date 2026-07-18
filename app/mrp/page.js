import { sb } from "../../lib/supabase";
import MRPClient from "./MRPClient";
import { updateSupplyMode } from "./actions";

export const dynamic = "force-dynamic";

export default async function MRP() {
  let kpi = {}, rows = [], poCalendar = [];

  const results = await Promise.allSettled([
    sb("v_mrp_kpi?select=*"),
    sb("v_mrp?select=*&order=net_requirement.desc"), // fetch all rows without limit so the client component filters, searches, and paginates them properly.
    sb("v_po_calendar?select=*&order=release_in_weeks.asc"), // time-phased: kapan PO harus terbit (0042)
  ]);

  const getVal = (res) => res.status === "fulfilled" ? res.value || [] : [];
  kpi = getVal(results[0])[0] || {};
  rows = getVal(results[1]);
  poCalendar = getVal(results[2]);

  const hasData = results.some(r => r.status === "fulfilled");
  if (!hasData) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>Database connection failed or returned no data.</pre>
        <p>Make sure migration 0018/0019 has been run in Supabase (needs BOM, stock position &amp; demand).</p>
      </div>
    );
  }

  return (
    <MRPClient
      initialRows={rows}
      kpi={kpi}
      poCalendar={poCalendar}
      updateSupplyModeAction={updateSupplyMode}
    />
  );
}
