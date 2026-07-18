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

const CAPACITY_RULES = {
  "Liquid 30ml": {
    1: { full: 28000, half: 20000 },
    2: { full: 27000, half: 19500 },
    3: { full: 26000, half: 18500 },
    4: { full: 25000, half: 17500 },
  },
  "Liquid 15ml": {
    1: { full: 33000, half: 22000 },
    2: { full: 32000, half: 21000 },
    3: { full: 31000, half: 20000 },
    4: { full: 30000, half: 19000 },
  },
  "Liquid 15ml ABC": {
    1: { full: 19000, half: 12000 },
    2: { full: 18500, half: 11500 },
    3: { full: 18000, half: 11000 },
    4: { full: 17500, half: 10500 },
  },
  "Liquid 15ml D": {
    1: { full: 14000, half: 10000 },
    2: { full: 13500, half: 9500 },
    3: { full: 13000, half: 9000 },
    4: { full: 12500, half: 8500 },
  },
  "Cartridge": {
    1: { full: 15000, half: 10000 },
    2: { full: 15000, half: 10000 },
    3: { full: 15000, half: 10000 },
    4: { full: 15000, half: 10000 },
  },
  "Device": {
    1: { full: 7000, half: 5000 },
    2: { full: 6500, half: 4500 },
    3: { full: 6000, half: 4000 },
    4: { full: 5500, half: 3500 },
  },
  "Capsule": {
    1: { full: 1500, half: 1000 },
    2: { full: 1500, half: 1000 },
    3: { full: 1500, half: 1000 },
    4: { full: 1500, half: 1000 },
  }
};

const getRulesForLine = (line) => {
  const l = String(line || "").toLowerCase();
  if (l.includes("30ml")) return CAPACITY_RULES["Liquid 30ml"];
  if (l.includes("15ml")) {
    if (l.includes("abc") || l.includes("19 mp") || l.includes("19mp")) return CAPACITY_RULES["Liquid 15ml ABC"];
    if (l.includes(" d") || l.includes("13 mp") || l.includes("13mp")) return CAPACITY_RULES["Liquid 15ml D"];
    return CAPACITY_RULES["Liquid 15ml"];
  }
  if (l.includes("cartridge")) return CAPACITY_RULES["Cartridge"];
  if (l.includes("device")) return CAPACITY_RULES["Device"];
  if (l.includes("capsule")) return CAPACITY_RULES["Capsule"];
  return null;
};

const formatCapRange = (line, wcap) => {
  const rules = getRulesForLine(line);
  if (rules) {
    const min = 3 * rules[4].full;
    const max = 3 * rules[1].full;
    return `${fmt(min)} – ${fmt(max)}`;
  }
  return wcap ? fmt((wcap * 3) / WEEK_SHIFTS) : "—";
};

export default function ScheduleClient({ plan, pattern, capacity, meta, bomMatrix = [], latestSohDate }) {
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState("weekly");     // "weekly" | "daily"
  const [strategy, setStrategy] = useState("level"); // daily: "level" (rata harian) | "front" (urgensi)
  const [filterRmpm, setFilterRmpm] = useState(true);

  const patternMap = useMemo(() => {
    const m = {}; for (const r of pattern) m[Number(r.week_of_month)] = Number(r.factor); return m;
  }, [pattern]);
  const capMap = useMemo(() => {
    const m = {}; for (const r of capacity) m[r.prod_line] = r.weekly_capacity == null ? null : Number(r.weekly_capacity); return m;
  }, [capacity]);

  // Material (RMPM) pool utk gate produksi: SOH per komponen.
  // Consignment/Daily = pasokan terjamin (Infinity). Komponen TANPA baris stok
  // (soh null) TIDAK di-gate — hindari false-block karena beda penamaan.
  const mat = useMemo(() => {
    const pool = {}; const bomMap = {};
    for (const row of bomMatrix) {
      const pk = String(row.product || "").toUpperCase().trim();
      const arr = [];
      for (const c of row.comps || []) {
        const k = String(c.c || "").toUpperCase().trim();
        if (!(k in pool)) {
          pool[k] = {
            avail: c.mode ? Infinity : c.soh == null ? null : Number(c.soh),
            inc: Number(c.inc || 0),
            name: c.c,
          };
        }
        arr.push({ k, p: Number(c.p) || 0 });
      }
      bomMap[pk] = arr;
    }
    return { pool, bomMap };
  }, [bomMatrix]);
  const hasMatGate = bomMatrix.length > 0;

  // Horizon minggu (mulai Senin minggu SOH terakhir)
  const weeks = useMemo(() => {
    const start = mondayOf(new Date(latestSohDate || new Date()));
    return Array.from({ length: HORIZON }, (_, i) => {
      const ws = new Date(start); ws.setUTCDate(start.getUTCDate() + i * 7);
      const wom = Math.min(5, Math.max(1, Math.ceil(ws.getUTCDate() / 7)));
      return { iso: ws.toISOString().slice(0, 10), wom, factor: patternMap[wom] ?? 1 };
    });
  }, [patternMap, latestSohDate]);

  // Simulasi (s,S) per SKU + agregasi beban per line (mingguan)
  // Diurutkan berdasarkan cover terkecil (priority tertinggi)
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
    rows.sort((a, b) => {
      const coverA = Number(a.weekly_demand) > 0 ? (Number(a.soh) || 0) / Number(a.weekly_demand) : Infinity;
      const coverB = Number(b.weekly_demand) > 0 ? (Number(b.soh) || 0) / Number(b.weekly_demand) : Infinity;
      return coverA - coverB || b.total - a.total;
    });

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
  // Dimulai dari hari setelah tanggal SOH terakhir
  const days = useMemo(() => {
    if (!latestSohDate) return [];
    const out = [];
    const baseMonday = mondayOf(new Date(latestSohDate)); // Monday of SOH week
    
    // Start production on the day after SOH date
    const startProd = new Date(latestSohDate);
    startProd.setUTCDate(startProd.getUTCDate() + 1);
    
    let current = new Date(startProd);
    let workingDaysFound = 0;
    
    // Generate exactly 12 working days (2 weeks of production)
    while (workingDaysFound < 12) {
      const dow = current.getUTCDay();
      if (dow !== 0) { // skip Sunday
        const dayMonday = mondayOf(current);
        const diffMs = dayMonday.getTime() - baseMonday.getTime();
        const weekIdx = Math.floor(diffMs / (7 * 24 * 3600 * 1000));
        
        out.push({
          iso: current.toISOString().slice(0, 10),
          dow,
          shifts: DAY_SHIFTS[dow],
          week: weekIdx, // week index for bucket mapping (0, 1, 2)
          lbl: DOW[dow] + " " + current.getUTCDate(),
        });
        workingDaysFound++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return out;
  }, [latestSohDate]);

  // Jadwal harian 2 minggu — DUA strategi:
  const daily = useMemo(() => {
    const nD = days.length;
    const w2start = days.findIndex((d) => d.week === 1);
    const totalShiftW = days.reduce((s, d) => s + d.shifts, 0);
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

    const avail = {};
    for (const k in mat.pool) avail[k] = mat.pool[k].avail;

    const getDailyCap = (line, dayIdx, numSkus) => {
      const rules = getRulesForLine(line);
      const shifts = days[dayIdx].shifts;
      if (rules) {
        const n = Math.min(4, Math.max(1, numSkus));
        const target = shifts === 1.5 ? rules[n].half : rules[n].full;
        return 3 * target;
      }
      const wcap = capMap[line];
      return wcap ? (wcap * shifts) / WEEK_SHIFTS : Infinity;
    };

    const gated = prio.map((x) => {
      const comps = mat.bomMap[String(x.r.sku_name).toUpperCase().trim()] || [];
      let req1 = x.req1, req2 = x.req2, matShort = 0, limComp = null, limSoh = null, limInc = null;
      let mx = Infinity, lim = null;
      for (const c of comps) {
        if (c.p > 0) {
          const a = avail[c.k];
          if (a != null && a !== Infinity) {
            const u = Math.floor(a / c.p);
            if (u < mx) { mx = u; lim = c; }
          }
        }
      }
      const buildable = mx === Infinity ? Infinity : Math.max(0, Math.floor(mx / LOT) * LOT);
      if (filterRmpm && buildable < req1 + req2) {
        matShort = req1 + req2;
        limComp = lim ? mat.pool[lim.k].name : null;
        limSoh = lim ? Math.max(0, Math.round(avail[lim.k])) : null;
        limInc = lim ? mat.pool[lim.k].inc : null;
        req1 = 0; req2 = 0;
      } else if (buildable < req1 + req2) {
        matShort = req1 + req2 - buildable;
        limComp = lim ? mat.pool[lim.k].name : null;
        limSoh = lim ? Math.max(0, Math.round(avail[lim.k])) : null;
        limInc = lim ? mat.pool[lim.k].inc : null;
        const cut2 = Math.min(req2, matShort);
        req2 -= cut2; req1 -= matShort - cut2;
      }
      const sched = req1 + req2;
      for (const c of comps) {
        const a = avail[c.k];
        if (a != null && a !== Infinity) avail[c.k] = a - sched * c.p;
      }
      return { x, req1, req2, matShort, limComp, limSoh, limInc };
    });

    const levelCap = {};
    if (strategy === "level") {
      const lineReq = {};
      for (const g of gated) {
        const L = g.x.r.prod_line;
        lineReq[L] = (lineReq[L] || 0) + g.req1 + g.req2;
      }
      for (const L in lineReq) {
        const tot = lineReq[L];
        const arr = Array(nD).fill(0);
        let cum = 0, given = 0;
        for (let i = 0; i < nD; i++) {
          cum += (tot * days[i].shifts) / totalShiftW;
          const want = Math.round(cum / LOT) * LOT;
          arr[i] = Math.max(0, want - given);
          given += arr[i];
        }
        if (given < tot) arr[nD - 1] += tot - given;
        levelCap[L] = arr;
      }
    }

    const list = [];
    let unfitTotal = 0, matShortTotal = 0;

    for (const g of gated) {
      const { x, req1, req2, matShort, limComp, limSoh, limInc } = g;
      const line = x.r.prod_line;
      const hasCapModel = !!(getRulesForLine(line) || capMap[line]);
      const alloc = Array(nD).fill(0);
      let unfit = 0, spill = 0;

      if (req1 + req2 === 0) {
        unfitTotal += (x.req1 + x.req2);
        matShortTotal += matShort;
        list.push({ ...x.r, cover: x.cover, alloc: alloc.map((v) => Math.round(v)), total2: 0, spill: 0, unfit: x.req1 + x.req2, matShort, need2: x.req1 + x.req2, limComp, limSoh, limInc });
        continue;
      }

      if (!hasCapModel) {
        if (strategy === "level") {
          const req = req1 + req2;
          let cum = 0, given = 0;
          for (let i = 0; i < nD; i++) {
            cum += (req * days[i].shifts) / totalShiftW;
            const want = Math.round(cum / LOT) * LOT;
            const v = Math.max(0, want - given); given += v;
            alloc[i] += v; load[line][i] += v;
          }
          if (given < req) { alloc[nD - 1] += req - given; load[line][nD - 1] += req - given; }
        } else {
          const weekIndices = {};
          days.forEach((d, idx) => {
            weekIndices[d.week] = weekIndices[d.week] || [];
            weekIndices[d.week].push(idx);
          });
          const spreadForWeek = (req, weekVal) => {
            const idxs = weekIndices[weekVal];
            if (!idxs || idxs.length === 0 || req <= 0) return;
            const n = idxs.length;
            const lots = Math.round(req / LOT);
            const base = Math.floor(lots / n), extra = lots % n;
            for (let idx = 0; idx < n; idx++) {
              const i = idxs[idx];
              const v = (base + (idx < extra ? 1 : 0)) * LOT;
              alloc[i] += v; load[line][i] += v;
            }
          };
          spreadForWeek(req1, 0); spreadForWeek(req2, 1);
        }
      } else {
        const place = (reqIn, from, weekVal) => {
          let req = reqIn;
          for (let i = from; i < nD && req > 0; i++) {
            const isNewSku = !skusOnDay[line][i].has(x.r.sku_name);
            if (isNewSku && skusOnDay[line][i].size >= MAX_SKU_PER_LINE_DAY) continue;
            const nextSkuCount = skusOnDay[line][i].size + (isNewSku ? 1 : 0);
            const cap = getDailyCap(line, i, nextSkuCount);
            let free = cap - load[line][i];
            if (strategy === "level" && levelCap[line]) free = Math.min(free, levelCap[line][i] - load[line][i]);
            const take = Math.min(req, Math.floor(free / LOT) * LOT);
            if (take <= 0) continue;
            alloc[i] += take; load[line][i] += take;
            if (isNewSku) skusOnDay[line][i].add(x.r.sku_name);
            if (days[i].week > weekVal) spill += take;
            req -= take;
          }
          return req;
        };
        if (strategy === "level") {
          let left = place(req1 + req2, 0, 0);
          if (left > 0) left = place(left, 0, 1);
          unfit += left;
        } else {
          const weekStarts = {};
          days.forEach((d, idx) => { if (!(d.week in weekStarts)) weekStarts[d.week] = idx; });
          unfit += place(req1, weekStarts[0] ?? 0, 0);
          if (weekStarts[1] != null) unfit += place(req2, weekStarts[1], 1);
        }
      }
      unfitTotal += unfit; matShortTotal += matShort;
      list.push({ ...x.r, cover: x.cover, alloc: alloc.map((v) => Math.round(v)), total2: Math.round(alloc.reduce((s, v) => s + v, 0)), spill: Math.round(spill), unfit: Math.round(unfit), matShort: Math.round(matShort), need2: x.req1 + x.req2, limComp, limSoh, limInc });
    }
    const dayTotals = Array(nD).fill(0);
    for (const L of Object.keys(load)) load[L].forEach((v, i) => { dayTotals[i] += v; });
    const total = list.reduce((s, r) => s + r.total2, 0);
    return { list, load, dayTotals, skusOnDay, kpi: { skus: list.filter(r => r.total2 > 0).length, total, unfit: Math.round(unfitTotal), matShort: Math.round(matShortTotal), spillSkus: list.filter((r) => r.spill > 0).length } };
  }, [rows, days, capMap, lines, mat, strategy, filterRmpm]);

  const tableRows = mode === "daily" ? daily.list : rows;
  const PER = 25;
  const pages = Math.max(1, Math.ceil(tableRows.length / PER));
  const cur = Math.min(page, pages - 1);
  const pageRows = tableRows.slice(cur * PER, cur * PER + PER);
  const src = plan[0]?.demand_source || "—";

  const weekGroups = useMemo(() => {
    const groups = {};
    days.forEach((d, idx) => {
      groups[d.week] = groups[d.week] || { count: 0, first: idx };
      groups[d.week].count++;
    });
    return Object.keys(groups).map(wKey => {
      const wVal = Number(wKey);
      return {
        week: wVal,
        colSpan: groups[wVal].count,
        range: weekRange(wVal)
      };
    });
  }, [days]);

  function exportCSV() {
    const stamp = new Date().toISOString().slice(0, 10);
    if (mode === "daily") {
      downloadCSV(
        ["Priority", "SKU", "Line", "ABC", "Cover_wk", ...days.map((d) => d.iso), "Total",
          "W1_shifted_to_W2", "Unscheduled_capacity", "Blocked_material", "Limiting_material"],
        daily.list.map((r, i) => [i + 1, r.sku_name, r.prod_line, r.abc_tier || "",
          isFinite(r.cover) ? Math.round(r.cover * 10) / 10 : "", ...r.alloc, r.total2,
          r.spill, r.unfit, r.matShort, r.matShort > 0 ? r.limComp || "" : ""]),
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

  // Total per shift per hari (semua line): Sen–Jum dibagi 3 shift rata;
  // Sabtu ½ hari = shift 1 penuh + shift 2 setengah, tanpa shift 3.
  const shiftVal = (i, s) => {
    const t = Math.round(daily.dayTotals[i]);
    if (days[i].shifts === 1.5) {
      if (s === 2) return null;
      const s1 = Math.round((t * 2) / 3);
      return s === 0 ? s1 : t - s1;
    }
    const third = Math.round(t / 3);
    return s === 2 ? t - 2 * third : third;
  };

  const coverColor = (c) => (c < 1 ? "var(--red)" : c < 4.3 ? "var(--amber)" : "var(--green)");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Production Schedule</h1>
          <div className="page-sub">
            {mode === "daily"
              ? `day-by-day plan · next ${DAILY_WEEKS} weeks · ${strategy === "level" ? "LEVEL (steady daily qty)" : "FRONT-LOAD (urgency)"} · Mon–Fri 3 shifts · Sat ½ · Sun off · max ${MAX_SKU_PER_LINE_DAY} SKUs/line/day`
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
        {mode === "daily" && (
          <>
            <span style={{ alignSelf: "center", color: "var(--muted)", fontSize: 12, marginLeft: 10 }}>Strategy:</span>
            <button className={"gloss-pill" + (strategy === "level" ? " active" : "")}
              onClick={() => { setStrategy("level"); setPage(0); }}
              title="Heijunka: qty rata & stabil per hari/shift — kapasitas sisa per hari jelas (jendela OEM)">
              ⚖ Level · steady daily
            </button>
            <button className={"gloss-pill" + (strategy === "front" ? " active" : "")}
              onClick={() => { setStrategy("front"); setPage(0); }}
              title="Urgensi maksimum: hari paling awal diisi penuh dulu">
              ⚡ Front-load · urgency
            </button>
            
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginLeft: "15px", cursor: "pointer", color: filterRmpm ? "var(--accent)" : "var(--text-muted)", fontWeight: filterRmpm ? "bold" : "normal" }}>
              <input
                type="checkbox"
                checked={filterRmpm}
                onChange={(e) => { setFilterRmpm(e.target.checked); setPage(0); }}
                style={{ cursor: "pointer" }}
              />
              🔒 Hanya SKU dengan RMPM Cukup (100%)
            </label>
          </>
        )}
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
            ? (strategy === "level"
                ? "LEVEL strategy: production is spread EVENLY across working days — steady qty per day & shift; most-critical SKUs still get the earliest slots; remaining capacity per day = OEM window (card below)."
                : "FRONT-LOAD strategy: earliest days are filled to capacity first (max urgency); later days stay free.") +
              (hasMatGate
                ? " Production is GATED by material (RMPM) on-hand — consignment/daily supplies count as always available."
                : " Material gate inactive — run migration 0039 (v_bom_matrix) to block production when RMPM is empty.")
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
          <div className="card kpi-card" style={{ borderColor: daily.kpi.unfit + daily.kpi.matShort > 0 ? "var(--red)" : undefined }}>
            <div className={"kpi-icon " + (daily.kpi.unfit + daily.kpi.matShort > 0 ? "red" : "green")}><IconAlertCircle /></div>
            <div>
              <div className="kpi-label">Unscheduled Units</div>
              <div className="kpi-value" style={{ color: daily.kpi.unfit + daily.kpi.matShort ? "var(--red)" : "var(--green)" }}>
                {fmt(daily.kpi.unfit + daily.kpi.matShort)}
              </div>
              <div className="kpi-sub">
                {daily.kpi.unfit + daily.kpi.matShort > 0
                  ? fmt(daily.kpi.unfit) + " capacity · " + fmt(daily.kpi.matShort) + " material short"
                  : daily.kpi.spillSkus + " SKUs shifted W1 → W2"}
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
                  {weekGroups.map((g, idx) => (
                    <th key={g.week} colSpan={g.colSpan} style={{ textAlign: "center" }}>
                      Week {idx + 1} · {g.range}
                    </th>
                  ))}
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
                      <td className="num" style={{ fontSize: "11px", whiteSpace: "nowrap" }}>
                        {formatCapRange(L, wcap)}
                      </td>
                      {load.map((u, i) => {
                        const numSkus = daily.skusOnDay[L][i].size;
                        const rules = getRulesForLine(L);
                        let capD = null;
                        if (rules) {
                          const n = Math.min(4, Math.max(1, numSkus || 1));
                          const target = days[i].shifts === 1.5 ? rules[n].half : rules[n].full;
                          capD = 3 * target;
                        } else if (wcap) {
                          capD = (wcap * days[i].shifts) / WEEK_SHIFTS;
                        }
                        const util = capD ? (u / capD) * 100 : null;
                        return (
                          <td className="num" key={i} style={heatStyle(util)}
                            title={fmt(u) + " units" + (capD ? " · " + pct(util) + " of " + fmt(capD) + " (" + numSkus + " SKUs)" : "")}>
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

      {mode === "daily" && (
        <div className="card">
          <h2 className="card-title">Free Capacity — OEM Window</h2>
          <div className="card-note">
            remaining units per line per day AFTER the own-product plan · sellable window for OEM / toll manufacturing ·
            green = whole day idle (best for OEM: full single-run capacity, no changeover) · hover ≈ per-shift
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th rowSpan={2}>Production Line</th>
                  {weekGroups.map((g, idx) => (
                    <th key={g.week} colSpan={g.colSpan} style={{ textAlign: "center" }}>
                      Week {idx + 1} · {g.range}
                    </th>
                  ))}
                </tr>
                <tr>
                  {days.map((d) => <th className="num" key={d.iso}>{d.lbl}{d.shifts === 1.5 ? " ½" : ""}</th>)}
                </tr>
              </thead>
              <tbody>
                {lines.filter((L) => getRulesForLine(L) || capMap[L]).map((L) => {
                  const load = daily.load[L] || Array(days.length).fill(0);
                  return (
                    <tr key={L}>
                      <td className="name">{L}</td>
                      {days.map((d, i) => {
                        const numSkus = daily.skusOnDay[L][i].size;
                        const rules = getRulesForLine(L);
                        let capD = null;
                        if (rules) {
                          const n = Math.min(4, Math.max(1, numSkus || 1));
                          const target = d.shifts === 1.5 ? rules[n].half : rules[n].full;
                          capD = 3 * target;
                        } else if (capMap[L]) {
                          capD = (capMap[L] * d.shifts) / WEEK_SHIFTS;
                        }
                        const freeV = capD == null ? null : Math.max(0, capD - (load[i] || 0));
                        const idle = (load[i] || 0) < 1;
                        return (
                          <td className="num" key={i}
                            style={
                              freeV == null || freeV < 1
                                ? { color: "var(--muted)" }
                                : idle
                                ? { color: "var(--green)", fontWeight: 650 }
                                : {}
                            }
                            title={freeV == null ? undefined
                              : pct(capD ? (freeV / capD) * 100 : 0) + " free · ≈ " + fmt(freeV / 3) + "/shift"}>
                            {freeV == null ? "—" : freeV < 1 ? "0" : fmt(freeV)}
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

      {mode === "daily" && daily.list.some((r) => r.matShort > 0) && (
        <div className="card" style={{ borderColor: "var(--red)" }}>
          <h2 className="card-title">Material Shortages — RMPM blocking production</h2>
          <div className="card-note">
            SKUs whose 2-week plan is cut because a material is short · scarce materials go to the most critical SKUs first ·
            follow up in the MRP tab / with purchasing
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Priority #</th><th>SKU</th><th className="num">Needed 2-wk</th><th className="num">Schedulable</th>
                  <th className="num">Short (FG)</th><th>Limiting Material</th><th className="num">Mat SOH</th><th className="num">PO Incoming</th>
                </tr>
              </thead>
              <tbody>
                {daily.list.map((r, i) => r.matShort > 0 ? (
                  <tr key={r.sku_name}>
                    <td className="num" style={{ color: "var(--muted)" }}>{i + 1}</td>
                    <td className="name">{r.sku_name}</td>
                    <td className="num">{fmt(r.need2)}</td>
                    <td className="num">{fmt(r.need2 - r.matShort)}</td>
                    <td className="num" style={{ color: "var(--red)", fontWeight: 700 }}>{fmt(r.matShort)}</td>
                    <td className="name">{r.limComp || "—"}</td>
                    <td className="num">{r.limSoh == null ? "—" : fmt(r.limSoh)}</td>
                    <td className="num" style={{ color: r.limInc > 0 ? "var(--green)" : "var(--muted)" }}>
                      {r.limInc > 0 ? fmt(r.limInc) : "—"}
                    </td>
                  </tr>
                ) : null)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === "daily" && (
        <div className="card">
          <h2 className="card-title">Shift Totals — All Lines</h2>
          <div className="card-note">
            total units per shift per day · Mon–Fri 3 shifts (even split) · Sat ½ day = shift 1 full + shift 2 half, no shift 3
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th rowSpan={2}>Shift</th>
                  {weekGroups.map((g, idx) => (
                    <th key={g.week} colSpan={g.colSpan} style={{ textAlign: "center" }}>
                      Week {idx + 1} · {g.range}
                    </th>
                  ))}
                </tr>
                <tr>
                  {days.map((d) => <th className="num" key={d.iso}>{d.lbl}{d.shifts === 1.5 ? " ½" : ""}</th>)}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2].map((s) => (
                  <tr key={s}>
                    <td className="name">Shift {s + 1}</td>
                    {days.map((d, i) => {
                      const v = shiftVal(i, s);
                      return (
                        <td className="num" key={i} style={v === null || v === 0 ? { color: "var(--muted)" } : {}}>
                          {v === null ? "—" : v === 0 ? "—" : fmt(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td className="name">Total / day</td>
                  {days.map((d, i) => (
                    <td className="num" key={i}>
                      {Math.round(daily.dayTotals[i]) === 0 ? "—" : fmt(daily.dayTotals[i])}
                    </td>
                  ))}
                </tr>
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
            ? `sorted by PRIORITY — lowest stock cover first (# = production order) · qty in lots of ${fmt(LOT)} · ⚠ = week-1 need shifted to week 2 · ${PER} rows per page`
            : `units to produce each week to hold 30-day cover · 💰 = payday week (higher demand) · ${PER} rows per page`}
        </div>
        <div className="table-wrap">
          <table className="table">
            {mode === "daily" ? (
              <thead>
                <tr>
                  <th rowSpan={2}>#</th><th rowSpan={2}>SKU</th><th rowSpan={2}>Line</th><th rowSpan={2}>ABC</th>
                  <th rowSpan={2} className="num">Cover</th>
                  {weekGroups.map((g, idx) => (
                    <th key={g.week} colSpan={g.colSpan} style={{ textAlign: "center" }}>
                      Week {idx + 1} · {g.range}
                    </th>
                  ))}
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
                      <td className="num" style={{ color: coverColor(r.cover), fontWeight: 600 }}
                        title={"SOH " + fmt(r.soh) + " ÷ demand " + fmt(r.weekly_demand) + "/wk"}>
                        {isFinite(r.cover) ? r.cover.toFixed(1) + " wk" : "—"}
                      </td>
                      {r.alloc.map((v, j) => (
                        <td className="num" key={j} style={v === 0 ? { color: "var(--muted)" } : { fontWeight: 650 }}>
                          {v === 0 ? "—" : fmt(v)}
                        </td>
                      ))}
                      <td className="num" style={{ fontWeight: 700 }}
                        title={[
                          r.spill > 0 ? fmt(r.spill) + " units of week-1 need shifted to week 2 (capacity)" : null,
                          r.unfit > 0 ? fmt(r.unfit) + " units unscheduled — no line capacity in 2 weeks" : null,
                          r.matShort > 0 ? fmt(r.matShort) + " units blocked — material short: " + (r.limComp || "?") : null,
                        ].filter(Boolean).join(" · ") || undefined}>
                        {fmt(r.total2)}{r.spill > 0 ? " ⚠" : ""}{r.unfit > 0 || r.matShort > 0 ? " ⛔" : ""}
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
