import { sbAll } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

// whitelist view yang boleh diekspor (hindari akses view sembarangan)
const ALLOWED = {
  v_sku_segmentation: "sku_segmentation",
  v_sku_value: "sku_value",
  v_forecast_monthly: "forecast",
  v_inventory_fg: "inventory_fg",
  v_po_open_lines: "po_open_lines",
  v_mps_plan: "mps_plan",
  v_mrp: "mrp_materials",
  v_stock_position: "stock_position",
  v_po_calendar: "po_calendar",
  v_po_pipeline: "po_pipeline",
  v_po_gap: "po_gap_no_po",
  v_po_forceclosed: "po_forceclosed",
};

function toCsv(rows) {
  if (!rows || !rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(","));
  return lines.join("\r\n");
}

export async function GET(request) {
  const view = new URL(request.url).searchParams.get("view");
  if (!view || !ALLOWED[view]) {
    return new Response("Invalid or non-exportable view", { status: 400 });
  }
  try {
    const rows = await sbAll(`${view}?select=*`); // paginasi: view besar (v_stock_position 1.4rb baris) tak terpotong 1000
    const csv = "﻿" + toCsv(rows); // BOM supaya Excel baca UTF-8 dengan benar
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${ALLOWED[view]}_${stamp}.csv"`,
      },
    });
  } catch (e) {
    return new Response("Export failed: " + e.message, { status: 500 });
  }
}
