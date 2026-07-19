import { sb, sbWrite } from "../../../../lib/supabase";
import { seriesFromMatrix, champion, forecastForward, METHODS } from "../../../../lib/forecast";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const publishSecret = process.env.PUBLISH_SECRET;
    if (publishSecret) {
      const auth = req.headers.get("x-publish-key") || req.headers.get("authorization")?.replace("Bearer ", "");
      if (auth !== publishSecret) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const rows = await sb("v_sku_monthly_matrix?select=sku_name,start_month,qtys");
    const map = seriesFromMatrix(rows);
    const runDate = new Date().toISOString().slice(0, 10);

    const out = [];
    for (const sku in map) {
      const s = map[sku];
      const total12 = s.slice(-12).reduce((a, b) => a + b.q, 0);
      if (s.length < 4 || total12 <= 0) continue;
      const champ = champion(s);
      const fwd = forecastForward(s, champ.method, { h: 3, skipCurrent: true });
      const acc = champ.wmape === null ? null : Math.round((100 - champ.wmape) * 10) / 10;
      for (const p of fwd) {
        out.push({
          run_date: runDate,
          forecast_month: p.ym,
          sku_name: sku,
          method: METHODS[champ.method].label,
          forecast_qty: p.q,
          accuracy: acc,
        });
      }
    }

    await sbWrite(`forecast_log?run_date=eq.${runDate}`, null, { method: "DELETE" });
    if (out.length) await sbWrite("forecast_log", out, { prefer: "return=minimal" });

    // Baseline drives v_fg_weekly_demand -> v_mrp (matview). Refresh so MRP/Schedule
    // reflect the new baseline immediately. Non-fatal: baseline is already saved.
    let refreshed = false;
    try {
      await sbWrite("rpc/refresh_all_materialized_views", {}, { prefer: "return=minimal" });
      refreshed = true;
    } catch (e) {
      // matviews will still be refreshed by the next ETL run
    }

    return Response.json({ ok: true, run_date: runDate, skus: out.length / 3, rows: out.length, refreshed });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
