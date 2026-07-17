import { sb, sbWrite } from "../../../../lib/supabase";
import { groupSeries, champion, forecastForward, METHODS } from "../../../../lib/forecast";

export const dynamic = "force-dynamic";

// Publish baseline forecast RESMI: hitung champion per SKU dgn engine yang sama
// spt tab Forecast, lalu simpan ke forecast_log bertanggal (run_date = hari ini).
// Re-publish di hari yang sama menimpa run itu.
export async function POST() {
  try {
    const rows = await sb("v_sku_monthly_series?select=sku_name,month,qty");
    const map = groupSeries(rows);
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

    // ganti run hari ini (idempotent), lalu insert
    await sbWrite(`forecast_log?run_date=eq.${runDate}`, null, { method: "DELETE" });
    if (out.length) await sbWrite("forecast_log", out, { prefer: "return=minimal" });

    return Response.json({ ok: true, run_date: runDate, skus: out.length / 3, rows: out.length });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
