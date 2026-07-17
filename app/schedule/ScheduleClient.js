"use client";
import { useMemo, useState } from "react";
import { fmt, dmon, pct } from "../../lib/format";

// ---- Parameter (tunable) -----------------------------------------------------
const HORIZON = 8;   // minggu ke depan (mode Weekly)
const LOT = 500;     // pembulatan produksi ke atas
// s = titik pesan-ulang (14 hari) · S = pesan-sampai (30 hari, target_stock_30d)
const REORDER_WEEKS = 2;

// ---- Parameter mode Daily ----------------------------------------------------
const DAILY_WEEKS = 2;                       // horizon harian: 2 minggu
const DAY_SHIFTS = [0, 3, 3, 3, 3, 3, 1.5];  // Min..Sab (index getUTCDay): Minggu libur, Sabtu ½
const WEEK_SHIFTS = 16.5;                    // 5×3 + 1.5
const MAX_SKU_PER_LINE_DAY = 5;              // batas changeover: maks 4–5 SKU per line per hari
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const mondayOf = (d) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();                 // 0 Sun .. 6 Sat
  x.setUTCDate(x.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return x;
};

const IconCalendar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
const IconLayers = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>;
const IconTrendingUp = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;
const IconAlertCircle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;

const heatStyle = (util) => {
  if (util == null) return { color: "var(--muted)" };
  if (util > 100) return { background: "var(--red-soft)", color: "var(--red)", fontWeight: 700 };
  if (util > 85) return { background: "var(--amber-soft)", color: "var(--amber)", fontWeight: 600 };
  if (util > 0) return { background: "var(--green-soft)", color: "var(--green)" };
  return { color: "var(--muted)" };
};

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCSV(head, body, name) {
  const csv = "﻿" + [head, ...body].map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function ScheduleClient({ plan, pattern, capacity, meta }) {
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState("weekly");     // "weekly" | "daily"

  const patternMap = useMemo(() => {
    const m = {}; for (const r of pattern) m[Number(r.week_of_month)] = Number(r.factor); return m;
  }, [pattern]);
  const capMap = useMemo(() => {
    const m = {}; for (const r of capacity) m[r.prod_line] = r.weekly_capacity == null ? null : Number(r.weekly_capacity); return m;
  }, [capacity]);

  // Horizon minggu (mulai Senin minggu berjalan)
  const weeks = useMemo(() => {
    const start = mondayOf(new Date());
    return Array.from({ length: HORIZON }, (_, i) => {
      const ws = new Date(start); ws.setUTCDate(start.getUTCDate() + i * 7);
      const wom = Math.min(5, Math.max(1, Math.ceil(ws.getUTCDate() / 7)));
      return { iso: ws.toISOString().slice(0, 10), wom, factor: patternMap[wom] ?? 1 };
    });
  }, [patternMap]);

  // Simulasi (s,S) per SKU + agregasi beban per line (mingguan)
  const { rows, lineLoad, kpi } = useMemo(() => {
    const rows = [];
    const lineLoad = {};                       // line -> [w]: unit produksi
    for (const p of plan) {
      const wd = Number(p.weekly_demand) || 0;
      const s = REORDER_WEEKS * wd;
      const S = Math.max(Number(p.target_stock_30d) || 0, s);
      let stock = Number(p.soh) || 0;
      let total = 0;
      const cells = weeks.map((w) => {
        const demand = wd * w.factor;
        const projAfter = stock - demand;
        let prod = 0;
        if (projAfter < s) prod = Math.ceil((S - projAfter) / LOT) * LOT;
        stock = projAfter + prod;
        total += prod;
        return { demand: Math.round(demand), prod, closing: Math.round(stock) };
      });
      rows.push({ ...p, cells, total });
      if (total > 0) {
        const L = (lineLoad[p.prod_line] = lineLoad[p.prod_line] || Array(HORIZON).fill(0));
        cells.forEach((c, i) => { L[i] += c.prod; });
      }
    }
    rows.sort((a, b) => b.total - a.total);

    let overCells = 0;
    for (const L in lineLoad) {
      const cap = capMap[L];
      if (cap) lineLoad[L].forEach((u) => { if (u / cap > 1) overCells++; });
    }
    const needCount = rows.filter((r) => r.total > 0).length;
    const totalProd = rows.reduce((s2, r) => s2 + r.total, 0);
    return { rows, lineLoad, kpi: { needCount, totalProd, overCells } };
  }, [plan, weeks, capMap]);

  const lines = useMemo(() => {
    const set = new Set(plan.map((p) => p.prod_line));
    return [...set].sort();
  }, [plan]);

  // ---- MODE DAILY: hari kerja 2 minggu (Sen–Sab, Minggu libur) ----------------
  const days = useMemo(() => {
    const start = mondayOf(new Date());
    const out = [];
    for (let i = 0; i < DAILY_WEEKS * 7; i++) {
      const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
      const dow = d.getUTCDay();
      if (dow === 0) continue;                 // Minggu libur
      out.push({
        iso: d.toISOString().slice(0, 10),
        dow, shifts: DAY_SHIFTS[dow],
        week: i < 7 ? 0 : 1,
        lbl: DOW[dow] + " " + d.getUTCDate(),
      });
    }
    return out;
  }, []);

  // Leveling finite-capacity: sebar produksi W1+W2 ke hari kerja.
  // Prioritas = cover terendah (paling dekat stockout) dijadwalkan paling awal.
  // Line ber-kapasitas: front-load, patuh cap harian (mingguan × shift ÷ 16.5)
  // dan maks 5 SKU/line/hari (changeover). W1 yang tak muat tumpah ke W2 (spill).
  // Line tanpa kapasitas (Assembly/Other): disebar rata di minggunya.
  const daily = useMemo(() => {
    const nD = days.length;
    const w2start = days.findIndex((d) => d.week === 1);
    const load = {}; const skusOnDay = {};
    for (const L of lines) {
      load[L] = Array(nD).fill(0);
      skusOnDay[L] = Array.from({ length: nD }, () => new Set());
    }

    const prio = rows
      .map((r) => ({ r, req1: r.cells[0]?.prod || 0, req2: r.cells[1]?.prod || 0 }))
      .filter((x) => x.req1 + x.req2 > 0)
      .map((x) => ({
        ...x,
        cover: Number(x.r.weekly_demand) > 0 ? (Number(x.r.soh) || 0) / Number(x.r.weekly_demand) : Infinity,
      }))
      .sort((a, b) => a.cover - b.cover || (b.req1 + b.req2) - (a.req1 + a.req2));

    const list = [];
    let unfitTotal = 0;

    for (const x of prio) {
      const line = x.r.prod_line;
      const wcap = capMap[line];
      const alloc = Array(nD).fill(0);
      let spill = 0, unfit = 0;

      if (!wcap) {
        const spread = (req, from, to) => {
          if (req <= 0) return;
          const per = req / (to - from + 1);
          for (let i = from; i <= to; i++) { alloc[i] += per; load[line][i] += per; }
        };
        spread(x.req1, 0, w2start - 1);
        spread(x.req2, w2start, nD - 1);
      } else {
        const place = (reqIn, from, isW1) => {
          let req = reqIn;
          for (let i = from; i < nD && req > 0.5; i++) {
            const cap = (wcap * days[i].shifts) / WEEK_SHIFTS;
            const free = cap - load[line][i];
            if (free <= 0) continue;
            if (!skusOnDay[line][i].has(x.r.sku_name) && skusOnDay[line][i].size >= MAX_SKU_PER_LINE_DAY) continue;
            const take = Math.min(req, free);
            alloc[i] += take; load[line][i] += take;
            skusOnDay[line][i].add(x.r.sku_name);
            if (isW1 && days[i].week === 1) spill += take;
            req -= take;
          }
          return req;
        };
        unfit += place(x.req1, 0, true);
        unfit += place(x.req2, w2start, false);
      }

      unfitTotal += unfit;
      list.push({
        ...x.r,
        alloc: alloc.map((v) => Math.round(v)),
        total2: Math.round(alloc.reduce((s, v) => s + v, 0)),
        spill: Math.round(spill),
        unfit: Math.round(unfit),
      });
    }
    list.sort((a, b) => b.total2 - a.total2);

    const total = list.reduce((s, r) => s + r.total2, 0);
    const spillSkus = list.filter((r) => r.spill > 0).length;
    return { list, load, w2start, kpi: { skus: list.length, total, unfit: Math.round(unfitTotal), spillSkus } };
  }, [rows, days, capMap, lines]);

  // ---- pagination (dipakai dua mode) -----------------------------------------
  const tableRows = mode === "daily" ? daily.list : rows;
  const PER = 25;
  const pages = Math.max(1, Math.ceil(tableRows.length / PER));
  const cur = Math.min(page, pages - 1);
  const pageRows = tableRows.slice(cur * PER, cur * PER + PER);
  const src = plan[0]?.demand_source || "—";

  function exportCSV() {
    const stamp = new Date().toISOString().slice(0, 10);
    if (mode === "daily") {
      downloadCSV(
        ["SKU", "Line", "ABC", ...days.map((d) => d.iso), "Total", "W1_shifted_to_W2", "Unscheduled"],
        daily.list.map((r) => [r.sku_name, r.prod_line, r.abc_tier || "", ...r.alloc, r.total2, r.spill, r.unfit]),
        `production_schedule_daily_${stamp}.csv`
      );
    } else {
      downloadCSV(
        ["SKU", "Line", "ABC", ...weeks.map((w) => dmon(w.iso)), "Total"],
        rows.map((r) => [r.sku_name, r.prod_line, r.abc_tier || "", ...r.cells.map((c) => c.prod), r.total]),
        `production_schedule_${stamp}.csv`
      );
    }
  }

  const weekRange = (wIdx) => {
    const ds = days.filter((d) => d.week === wIdx);
    return ds.length ? dmon(ds[0].iso) + " – " + dmon(ds[ds.length - 1].iso) : "";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Production Schedule</h1>
          <div className="page-sub">
            {mode === "daily"
              ? `day-by-day plan · next ${DAILY_WEEKS} weeks · finite-capacity leveling · Mon–Fri 3 shifts · Sat ½ · Sun off · max ${MAX_SKU_PER_LINE_DAY} SKUs/line/day`
              : `time-phased weekly plan · next ${HORIZON} weeks · (s,S) policy: reorder at ${REORDER_WEEKS}-wk, up to 30-day · lot ${fmt(LOT)} · payday-aware`}
          </div>
        </div>
        <button className="btn-export" onClick={exportCSV}>↓ Export CSV</button>
      </div>

      <div className="gloss-tabs">
        <button className={"gloss-pill" + (mode === "weekly" ? " active" : "")}
          onClick={() => { setMode("weekly"); setPage(0); }}>Weekly · {HORIZON} wk</button>
        <button className={"gloss-pill" + (mode === "daily" ? " active" : "")}
          onClick={() => { setMode("daily"); setPage(0); }}>Daily · {DAILY_WEEKS} wk</button>
      </div>

      <div className="note-banner">
        <span className="ic">{src === "Forecast baseline" ? "🎯" : "📊"}</span>
        <div>
          <b>Demand source: {src}.</b>{" "}
          {src === "Forecast baseline"
            ? `Driven by the published forecast baseline${meta && meta.run_date ? " (" + meta.run_date + ")" : ""}, shaped into weekly buckets by the payday curve.`
            : "Using the 12-week run-rate — publish a forecast baseline to drive this from the official forecast."}
          {" "}
          {mode === "daily"
            ? "Daily view levels PRODUCTION across working days within capacity — lowest-cover SKUs get the earliest slots; week-1 overflow shifts into week 2."
            : "Assumes production is available within its week (FG lead ≤ 1 week)."}
        </div>
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon accent"><IconCalendar /></div>
          <div>
            <div className="kpi-label">Horizon</div>
            <div className="kpi-value" style={{ fontSize: 18 }}>
              {mode === "daily"
                ? dmon(days[0].iso) + " – " + dmon(days[days.length - 1].iso)
                : dmon(weeks[0].iso) + " – " + dmon(weeks[HORIZON - 1].iso)}
            </div>
            <div className="kpi-sub">{mode === "daily" ? days.length + " working days" : HORIZON + " weeks ahead"}</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon green"><IconLayers /></div>
          <div>
            <div className="kpi-label">{mode === "daily" ? "SKUs Scheduled" : "SKUs to Produce"}</div>
            <div className="kpi-value">{fmt(mode === "daily" ? daily.kpi.skus : kpi.needCount)}</div>
            <div className="kpi-sub">of {fmt(rows.length)} active</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon amber"><IconTrendingUp /></div>
          <div>
            <div className="kpi-label">Total Production</div>
            <div className="kpi-value">{fmt(mode === "daily" ? daily.kpi.total : kpi.totalProd)}</div>
            <div className="kpi-sub">units · {mode === "daily" ? DAILY_WEEKS + "-week plan" : HORIZON + "-week plan"}</div>
          </div>
        </div>
        {mode === "daily" ? (
          <div className="card kpi-card" style={{ borderColor: daily.kpi.unfit > 0 ? "var(--red)" : undefined }}>
            <div className={"kpi-icon " + (daily.kpi.unfit > 0 ? "red" : "green")}><IconAlertCircle /></div>
            <div>
              <div className="kpi-label">Unscheduled Units</div>
              <div className="kpi-value" style={{ color: daily.kpi.unfit ? "var(--red)" : "var(--green)" }}>{fmt(daily.kpi.unfit)}</div>
              <div className="kpi-sub">
                {daily.kpi.unfit > 0 ? "no capacity left in 2 weeks — add shifts" : daily.kpi.spillSkus + " SKUs shifted W1 → W2"}
              </div>
            </div>
          </div>
        ) : (
          <div className="card kpi-card" style={{ borderColor: kpi.overCells > 0 ? "var(--red)" : undefined }}>
            <div className={"kpi-icon " + (kpi.overCells > 0 ? "red" : "green")}><IconAlertCircle /></div>
            <div>
              <div className="kpi-label">Over-capacity Slots</div>
              <div className="kpi-value" style={{ color: kpi.overCells ? "var(--red)" : "var(--green)" }}>{fmt(kpi.overCells)}</div>
              <div className="kpi-sub">line × week above capacity · switch to Daily to level</div>
            </div>
          </div>
        )}
      </section>

      {mode === "weekly" && (
        <div className="card">
          <h2 className="card-title">Line Capacity Load</h2>
          <div className="card-note">weekly production load ÷ line capacity · green ok · amber tight (&gt;85%) · red over (&gt;100%)</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Production Line</th>
                  <th className="num">Capacity/wk</th>
                  {weeks.map((w) => (
                    <th className="num" key={w.iso}>{dmon(w.iso)}{w.factor >= 1.05 ? " 💰" : ""}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((L) => {
                  const cap = capMap[L];
                  const load = lineLoad[L] || Array(HORIZON).fill(0);
                  return (
                    <tr key={L}>
                      <td className="name">{L}</td>
                      <td className="num">{cap == null ? "—" : fmt(cap)}</td>
                      {load.map((u, i) => {
                        const util = cap ? (u / cap) * 100 : null;
                        return (
                          <td className="num" key={i} style={heatStyle(util)}
                            title={fmt(u) + " units" + (cap ? " · " + pct(util) : "")}>
                            {u === 0 ? "—" : cap ? pct(util) : fmt(u)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === "daily" && (
        <div className="card">
          <h2 className="card-title">Line Load — Day by Day</h2>
          <div className="card-note">
            daily capacity = weekly ÷ 16.5 shifts × day shifts (Mon–Fri 3 · Sat 1.5) · leveled, so capped lines never exceed 100%
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th rowSpan={2}>Production Line</th>
                  <th rowSpan={2} className="num">Cap/day</th>
                  <th colSpan={daily.w2start} style={{ textAlign: "center" }}>Week 1 · {weekRange(0)}</th>
                  <th colSpan={days.length - daily.w2start} style={{ textAlign: "center" }}>Week 2 · {weekRange(1)}</th>
                </tr>
                <tr>
                  {days.map((d) => (
                    <th className="num" key={d.iso}>{d.lbl}{d.shifts === 1.5 ? " ½" : ""}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((L) => {
                  const wcap = capMap[L];
                  const load = daily.load[L] || Array(days.length).fill(0);
                  return (
                    <tr key={L}>
                      <td className="name">{L}</td>
                      <td className="num">{wcap == null ? "—" : fmt((wcap * 3) / WEEK_SHIFTS)}</td>
                      {load.map((u, i) => {
                        const capD = wcap ? (wcap * days[i].shifts) / WEEK_SHIFTS : null;
                        const util = capD ? (u / capD) * 100 : null;
                        return (
                          <td className="num" key={i} style={heatStyle(util)}
                            title={fmt(u) + " units" + (capD ? " · " + pct(util) + " of " + fmt(capD) : "")}>
                            {u < 1 ? "—" : capD ? pct(util) : fmt(u)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">
          {mode === "daily"
            ? `Daily Production Plan — by SKU (${fmt(daily.list.length)})`
            : `Weekly Production Plan — by SKU (${fmt(rows.length)})`}
        </h2>
        <div className="card-note">
          {mode === "daily"
            ? `units per day · earliest slots go to lowest stock cover · ⚠ = part of week-1 need shifted to week 2 · ${PER} rows per page`
            : `units to produce each week to hold 30-day cover · 💰 = payday week (higher demand) · ${PER} rows per page`}
        </div>
        <div className="table-wrap">
          <table className="table">
            {mode === "daily" ? (
              <thead>
                <tr>
                  <th rowSpan={2}>#</th><th rowSpan={2}>SKU</th><th rowSpan={2}>Line</th><th rowSpan={2}>ABC</th>
                  <th colSpan={daily.w2start} style={{ textAlign: "center" }}>Week 1 · {weekRange(0)}</th>
                  <th colSpan={days.length - daily.w2start} style={{ textAlign: "center" }}>Week 2 · {weekRange(1)}</th>
                  <th rowSpan={2} className="num">Total</th>
                </tr>
                <tr>
                  {days.map((d) => <th className="num" key={d.iso}>{d.lbl}{d.shifts === 1.5 ? " ½" : ""}</th>)}
                </tr>
              </thead>
            ) : (
              <thead>
                <tr>
                  <th>#</th><th>SKU</th><th>Line</th><th>ABC</th>
                  {weeks.map((w) => <th className="num" key={w.iso}>{dmon(w.iso)}{w.factor >= 1.05 ? " 💰" : ""}</th>)}
                  <th className="num">Total</th>
                </tr>
              </thead>
            )}
            <tbody>
              {mode === "daily"
                ? pageRows.map((r, i) => (
                    <tr key={r.sku_name}>
                      <td className="num" style={{ color: "var(--muted)" }}>{cur * PER + i + 1}</td>
                      <td className="name">{r.sku_name}</td>
                      <td>{r.prod_line}</td>
                      <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier || "—"}</span></td>
                      {r.alloc.map((v, j) => (
                        <td className="num" key={j} style={v === 0 ? { color: "var(--muted)" } : { fontWeight: 650 }}>
                          {v === 0 ? "—" : fmt(v)}
                        </td>
                      ))}
                      <td className="num" style={{ fontWeight: 700 }}
                        title={r.spill > 0 ? fmt(r.spill) + " units of week-1 need shifted to week 2 (capacity)" : undefined}>
                        {fmt(r.total2)}{r.spill > 0 ? " ⚠" : ""}{r.unfit > 0 ? " ⛔" : ""}
                      </td>
                    </tr>
                  ))
                : pageRows.map((r, i) => (
                    <tr key={r.sku_name}>
                      <td className="num" style={{ color: "var(--muted)" }}>{cur * PER + i + 1}</td>
                      <td className="name">{r.sku_name}</td>
                      <td>{r.prod_line}</td>
                      <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier || "—"}</span></td>
                      {r.cells.map((c, j) => (
                        <td className="num" key={j} style={c.prod === 0 ? { color: "var(--muted)" } : { fontWeight: 650 }}
                          title={"demand " + fmt(c.demand) + " · closing " + fmt(c.closing)}>
                          {c.prod === 0 ? "—" : fmt(c.prod)}
                        </td>
                      ))}
                      <td className="num" style={{ fontWeight: 700 }}>{fmt(r.total)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="pager">
            <span className="pager-info">{cur * PER + 1}–{Math.min(tableRows.length, cur * PER + PER)} of {fmt(tableRows.length)}</span>
            <button className="gloss-pill" disabled={cur === 0} onClick={() => setPage(cur - 1)}>‹ Prev</button>
            <button className="gloss-pill" disabled={cur === pages - 1} onClick={() => setPage(cur + 1)}>Next ›</button>
          </div>
        )}
      </div>
    </>
  );
}
