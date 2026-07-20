"use client";
import { useMemo, useState } from "react";
import { fmt, dmon, pct } from "../../lib/format";
import Pager from "../Pager";

// ---- Parameter (tunable) -----------------------------------------------------
const HORIZON = 8;   // minggu ke depan (mode Weekly)
const REORDER_WEEKS = 2;

// ---- Parameter mode Daily ----------------------------------------------------
const DAILY_WEEKS = 2;                       // horizon harian: 2 minggu
const DAY_SHIFTS = [0, 3, 3, 3, 3, 3, 0.5];  // Min..Sab (index getUTCDay): Minggu libur, Sabtu 1/2
const WEEK_SHIFTS = 15.5;                    // 5x3 + 1.5
const MAX_SKU_PER_LINE_DAY = 5;              // batas changeover: maks 4-5 SKU per line per hari
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

export default function ScheduleClient({ plan, pattern, capacity, meta, bomMatrix = [], config = {}, latestSohDate }) {
  const LOT = config.batch_rounding || 500;
  const TARGET_DAYS = config.fg_target_days || 30;
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState("weekly");     // "weekly" | "daily"
  const [strategy, setStrategy] = useState("level"); // daily: "level" (rata harian) | "front" (urgensi)
  const [lotDays, setLotDays] = useState(14);        // lot replenishment target: 7, 14, 30 hari (default 14 hari / 2 minggu)
  const [filterRmpm, setFilterRmpm] = useState(true);
  const [dayFilter, setDayFilter] = useState(-1);    // daily: -1=all, 0=day1, 1=day2, ...

  const patternMap = useMemo(() => {
    const m = {}; for (const r of pattern) m[Number(r.week_of_month)] = Number(r.factor); return m;
  }, [pattern]);
  const capMap = useMemo(() => {
    const m = {}; for (const r of capacity) m[r.prod_line] = r.weekly_capacity == null ? null : Number(r.weekly_capacity); return m;
  }, [capacity]);

  // Material (RMPM) pool utk gate produksi: SOH per komponen.
  // Consignment/Daily/Consumables/Cukai (Cukai, Plastik shrink, tape, sticker, label, dll) = pasokan terjamin (Infinity).
  // Komponen TANPA baris stok (soh null) atau consumable/cukai TIDAK di-gate — hindari false-block.
  const mat = useMemo(() => {
    const pool = {}; const bomMap = {};
    for (const row of bomMatrix) {
      const pk = String(row.product || "").toUpperCase().trim();
      const arr = [];
      for (const c of row.comps || []) {
        const k = String(c.c || "").toUpperCase().trim();
        const isConsumable = c.mode || 
          k.includes("CUKAI") ||
          k.includes("PLASTIK") || 
          k.includes("SHRINK") || 
          k.includes("PVC") ||
          k.includes("CONSUMABLE") || 
          k.includes("LABEL") || 
          k.includes("STIKER") || 
          k.includes("STICKER") ||
          k.includes("LAMINASI") ||
          k.includes("LAKBAN");

        if (!(k in pool)) {
          pool[k] = {
            avail: isConsumable ? Infinity : c.soh == null ? null : Number(c.soh),
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

  // Horizon minggu (mulai Senin depan / Senin minggu ini)
  const weeks = useMemo(() => {
    const today = new Date();
    const thisMonday = mondayOf(today);
    // If today >= Thursday, use next Monday (current week almost done)
    const start = today.getUTCDay() >= 4
      ? new Date(thisMonday.getTime() + 7 * 86400000)
      : thisMonday;
    return Array.from({ length: HORIZON }, (_, i) => {
      const ws = new Date(start); ws.setUTCDate(start.getUTCDate() + i * 7);
      const wom = Math.min(5, Math.max(1, Math.ceil(ws.getUTCDate() / 7)));
      return { iso: ws.toISOString().slice(0, 10), wom, factor: patternMap[wom] ?? 1 };
    });
  }, [patternMap]);

  // Simulasi (s,S) per SKU + agregasi beban per line (mingguan)
  // Diurutkan berdasarkan cover terkecil (priority tertinggi)
  const { rows, lineLoad, kpi } = useMemo(() => {
    const rows = [];
    const lineLoad = {};                       // line -> [w]: unit produksi
    for (const p of plan) {
      const wd = Number(p.weekly_demand) || 0;
      const s = REORDER_WEEKS * wd;
      // Gunakan target replenishment (lotDays): 14 hari default (bisa di-toggle 7, 14, 30 hari)
      const targetStock = Math.round(wd * (lotDays / 7.0));
      const S = Math.max(targetStock, s);
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
  }, [plan, weeks, capMap, lotDays, LOT]);

  const lines = useMemo(() => {
    const set = new Set(plan.map((p) => p.prod_line));
    return [...set].sort();
  }, [plan]);

  // ---- MODE DAILY: 2 minggu kerja ke depan (Sen–Sab) --------------------------
  const days = useMemo(() => {
    const out = [];
    const today = new Date();
    const thisMonday = mondayOf(today);
    // Start from next Monday if today >= Thursday
    const startDate = today.getUTCDay() >= 4
      ? new Date(thisMonday.getTime() + 7 * 86400000)
      : new Date(today.getTime() + 86400000);  // tomorrow

    // Base week = Monday of the horizon's first day; weekIdx counts from here (0,1,2…)
    const baseMonday = mondayOf(startDate);

    let current = new Date(startDate);
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

  const weekGroups = useMemo(() => {
    const groups = {};
    days.forEach((d, idx) => {
      groups[d.week] = groups[d.week] || { count: 0, first: idx };
      groups[d.week].count++;
    });
    return Object.keys(groups).map(wKey => {
      const wVal = Number(wKey);
      const ds = days.filter((d) => d.week === wVal);
      const range = ds.length ? dmon(ds[0].iso) + " – " + dmon(ds[ds.length - 1].iso) : "";
      return {
        week: wVal,
        colSpan: groups[wVal].count,
        range
      };
    });
  }, [days]);

  // Jadwal harian 2 minggu
  const daily = useMemo(() => {
    const nD = days.length;
    const w2start = days.findIndex((d) => d.week === 1);
    const w2idx = w2start >= 0 ? w2start : nD;
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

    // Helper hitung kapasitas harian dinamis berbasis changeover SKU
    const getDailyCap = (line, dayIdx, numSkus) => {
      const rules = getRulesForLine(line);
      const isSat = days[dayIdx].shifts === 0.5; // Saturday 1/2 day shift vs Weekday 3 shifts
      if (rules) {
        const n = Math.min(4, Math.max(1, numSkus));
        return isSat ? rules[n].half : 3 * rules[n].full;
      }
      const wcap = capMap[line];
      return wcap ? (wcap * (isSat ? 1 : 3)) / WEEK_SHIFTS : Infinity;
    };

    // ---- PASS A: material gate (urut prioritas — material langka ke SKU kritis)
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

    const levelCapMap = {};
    if (strategy === "level") {
      const lineReq1 = {};
      const lineReq2 = {};
      for (const g of gated) {
        const L = g.x.r.prod_line;
        lineReq1[L] = (lineReq1[L] || 0) + g.req1;
        lineReq2[L] = (lineReq2[L] || 0) + g.req2;
      }
      
      const w1Days = [];
      const w2Days = [];
      days.forEach((d, idx) => {
        if (d.week === 0) w1Days.push(idx);
        else w2Days.push(idx);
      });
      const shiftW1 = w1Days.reduce((s, idx) => s + days[idx].shifts, 0);
      const shiftW2 = w2Days.reduce((s, idx) => s + days[idx].shifts, 0);

      for (const L of lines) {
        const arr = Array(nD).fill(0);
        
        // Week 1 leveling
        const tot1 = lineReq1[L] || 0;
        if (tot1 > 0 && shiftW1 > 0) {
          let cum = 0, given = 0;
          w1Days.forEach((idx) => {
            cum += (tot1 * days[idx].shifts) / shiftW1;
            const want = Math.round(cum / LOT) * LOT;
            arr[idx] = Math.max(0, want - given);
            given += arr[idx];
          });
          if (given < tot1 && w1Days.length > 0) {
            arr[w1Days[w1Days.length - 1]] += tot1 - given;
          }
        }
        
        // Week 2+ leveling
        const tot2 = lineReq2[L] || 0;
        if (tot2 > 0 && shiftW2 > 0) {
          let cum = 0, given = 0;
          w2Days.forEach((idx) => {
            cum += (tot2 * days[idx].shifts) / shiftW2;
            const want = Math.round(cum / LOT) * LOT;
            arr[idx] = Math.max(0, want - given);
            given += arr[idx];
          });
          if (given < tot2 && w2Days.length > 0) {
            arr[w2Days[w2Days.length - 1]] += tot2 - given;
          }
        }
        levelCapMap[L] = arr;
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
          const w1Days = [];
          const w2Days = [];
          days.forEach((d, idx) => {
            if (d.week === 0) w1Days.push(idx);
            else w2Days.push(idx);
          });
          const shiftW1 = w1Days.reduce((s, idx) => s + days[idx].shifts, 0);
          const shiftW2 = w2Days.reduce((s, idx) => s + days[idx].shifts, 0);

          // Spread req1 across Week 1
          if (req1 > 0 && shiftW1 > 0) {
            let cum = 0, given = 0;
            w1Days.forEach((idx) => {
              cum += (req1 * days[idx].shifts) / shiftW1;
              const want = Math.round(cum / LOT) * LOT;
              const v = Math.max(0, want - given); given += v;
              alloc[idx] += v; load[line][idx] += v;
            });
            if (given < req1) {
              const lastIdx = w1Days[w1Days.length - 1];
              alloc[lastIdx] += req1 - given; load[line][lastIdx] += req1 - given;
            }
          }

          // Spread req2 across Week 2+
          if (req2 > 0 && shiftW2 > 0) {
            let cum = 0, given = 0;
            w2Days.forEach((idx) => {
              cum += (req2 * days[idx].shifts) / shiftW2;
              const want = Math.round(cum / LOT) * LOT;
              const v = Math.max(0, want - given); given += v;
              alloc[idx] += v; load[line][idx] += v;
            });
            if (given < req2) {
              const lastIdx = w2Days[w2Days.length - 1];
              alloc[lastIdx] += req2 - given; load[line][lastIdx] += req2 - given;
            }
          }
        } else {
          const weekIndices = {};
          days.forEach((d, idx) => {
            weekIndices[d.week] = weekIndices[d.week] || [];
            weekIndices[d.week].push(idx);
          });
          const spreadForWeek = (req, weekVal) => {
            const idxs = weekIndices[weekVal];
            if (!idxs || idxs.length === 0 || req <= 0) return 0;
            let remaining = Math.round(req / LOT);
            for (let idx = 0; idx < idxs.length && remaining > 0; idx++) {
              const i = idxs[idx];
              const cap = getDailyCap(line, i, 1);
              const free = Math.max(0, Math.floor((cap - load[line][i]) / LOT));
              const v = Math.min(remaining, free) * LOT;
              if (v <= 0) continue;
              alloc[i] += v; load[line][i] += v;
              remaining -= v / LOT;
            }
            return remaining * LOT; // unfilled
          };
          let left1 = spreadForWeek(req1, 0);
          let left2 = spreadForWeek(req2, 1);
          // Push unfilled to any day with spare capacity
          if ((left1 + left2) > 0) {
            const allDays = [...(weekIndices[0] || []), ...(weekIndices[1] || [])];
            for (const i of allDays) {
              if (left1 + left2 <= 0) break;
              const cap = getDailyCap(line, i, 1);
              const free = Math.max(0, Math.floor((cap - load[line][i]) / LOT)) * LOT;
              if (free <= 0) continue;
              if (left1 > 0) { const take = Math.min(left1, free); alloc[i] += take; load[line][i] += take; left1 -= take; }
              if (left2 > 0) { const take = Math.min(left2, free); alloc[i] += take; load[line][i] += take; left2 -= take; }
            }
            unfit += left1 + left2;
          }
        }
      } else {
        const place = (reqIn, from, to, useLevel, weekVal) => {
          let req = reqIn;
          for (let i = from; i <= to && req > 0; i++) {
            const isNewSku = !skusOnDay[line][i].has(x.r.sku_name);
            if (isNewSku && skusOnDay[line][i].size >= MAX_SKU_PER_LINE_DAY) continue;
            const nextSkuCount = skusOnDay[line][i].size + (isNewSku ? 1 : 0);

            const cap = getDailyCap(line, i, nextSkuCount);
            let free = cap - load[line][i];
            if (useLevel && levelCapMap[line]) {
              free = Math.min(free, levelCapMap[line][i] - load[line][i]);
            }
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
          // Week 1: strict target, then relaxed target in Week 1, then spill to Week 2
          let left1 = place(req1, 0, w2idx - 1, true, 0);
          if (left1 > 0) left1 = place(left1, 0, w2idx - 1, false, 0);
          if (left1 > 0) left1 = place(left1, w2idx, nD - 1, false, 0);
          
          // Week 2: strict target, then relaxed target in Week 2
          let left2 = place(req2, w2idx, nD - 1, true, 1);
          if (left2 > 0) left2 = place(left2, w2idx, nD - 1, false, 1);
          
          unfit += left1 + left2;
        } else {
          const weekStarts = {};
          days.forEach((d, idx) => { if (!(d.week in weekStarts)) weekStarts[d.week] = idx; });
          unfit += place(req1, weekStarts[0] ?? 0, nD - 1, false, 0);
          if (weekStarts[1] != null) unfit += place(req2, weekStarts[1], nD - 1, false, 1);
        }
      }

      unfitTotal += unfit; matShortTotal += matShort;
      list.push({ ...x.r, cover: x.cover, alloc: alloc.map((v) => Math.round(v)), total2: Math.round(alloc.reduce((s, v) => s + v, 0)), spill: Math.round(spill), unfit: Math.round(unfit), matShort: Math.round(matShort), need2: x.req1 + x.req2, limComp, limSoh, limInc });
    }

    const dayTotals = Array(nD).fill(0);
    for (const L of Object.keys(load)) load[L].forEach((v, i) => { dayTotals[i] += v; });

    // Pull-forward pass: fill idle capacity on earlier days by pulling from later days
    // ensures machines never idle if there's future work to do
    for (const L of lines) {
      const hasCap = !!(getRulesForLine(L) || capMap[L]);
      if (!hasCap || strategy !== "level") continue;
      const capArr = load[L];
      // For each day, compute spare capacity and pull from future days
      for (let d = 0; d < nD - 1; d++) {
        const cap = getDailyCap(L, d, skusOnDay[L][d].size + 1);
        const used = capArr[d];
        let free = Math.floor((cap - used) / LOT) * LOT;
        if (free <= 0) continue;
        // Look ahead for days with load that can be pulled forward
        for (let f = d + 1; f < nD && free > 0; f++) {
          const pullable = Math.min(free, Math.floor(capArr[f] / LOT) * LOT);
          if (pullable <= 0) continue;
          // Find SKUs with allocation on day f and move to day d
          for (const item of list) {
            if (free <= 0) break;
            if (!item.alloc[f] || item.alloc[f] <= 0) continue;
            const isNew = !skusOnDay[L][d].has(item.sku_name);
            if (isNew && skusOnDay[L][d].size >= MAX_SKU_PER_LINE_DAY) continue;
            const move = Math.min(free, Math.floor(item.alloc[f] / LOT) * LOT);
            if (move <= 0) continue;
            item.alloc[d] = (item.alloc[d] || 0) + move;
            item.alloc[f] -= move;
            capArr[d] += move;
            capArr[f] -= move;
            free -= move;
            if (isNew) skusOnDay[L][d].add(item.sku_name);
          }
        }
      }
    }

    // Pass 3: Class A & Fast-Moving Buffer Leveling Pass
    // Fill remaining empty shift capacity on early/middle days up to optimal capacity (85-95%)
    // prioritizing Class A / High-demand SKUs while respecting MAX_SKU_PER_LINE_DAY limit & material availability
    if (strategy === "level") {
      for (const L of lines) {
        const hasCap = !!(getRulesForLine(L) || capMap[L]);
        if (!hasCap) continue;
        const lineItems = list.filter((r) => r.prod_line === L);
        if (lineItems.length === 0) continue;

        // Sort candidates: Class A first, then Class B, lowest cover first
        const candidateSkus = [...lineItems].sort((a, b) => {
          const tierRank = { A: 1, B: 2, C: 3 };
          const tA = tierRank[a.abc_tier] || 4;
          const tB = tierRank[b.abc_tier] || 4;
          if (tA !== tB) return tA - tB;
          return a.cover - b.cover;
        });

        for (let d = 0; d < nD; d++) {
          const cap = getDailyCap(L, d, Math.max(1, skusOnDay[L][d].size));
          let free = cap - load[L][d];
          if (free < LOT) continue;

          let progress = true;
          while (free >= LOT && progress) {
            progress = false;
            for (const item of candidateSkus) {
              if (free < LOT) break;
              const isNew = !skusOnDay[L][d].has(item.sku_name);
              if (isNew && skusOnDay[L][d].size >= MAX_SKU_PER_LINE_DAY) continue;

              // Material check for adding 1 LOT
              const comps = mat.bomMap[String(item.sku_name).toUpperCase().trim()] || [];
              let canBuild = true;
              for (const c of comps) {
                if (c.p > 0 && avail[c.k] != null && avail[c.k] !== Infinity) {
                  if (avail[c.k] < c.p * LOT) { canBuild = false; break; }
                }
              }
              if (!canBuild && filterRmpm) continue;

              const add = LOT;
              item.alloc[d] = (item.alloc[d] || 0) + add;
              load[L][d] += add;
              free -= add;
              if (isNew) skusOnDay[L][d].add(item.sku_name);
              progress = true;

              // Deduct material
              for (const c of comps) {
                if (avail[c.k] != null && avail[c.k] !== Infinity) {
                  avail[c.k] -= add * c.p;
                }
              }
            }
          }
        }
      }
    }

    // Recompute day totals after pull-forward & leveling
    for (let i = 0; i < nD; i++) {
      dayTotals[i] = 0;
      for (const L of Object.keys(load)) dayTotals[i] += load[L][i];
    }

    // Recompute item totals after pull-forward & leveling
    for (const item of list) {
      item.total2 = Math.round(item.alloc.reduce((s, v) => s + v, 0));
      item.spill = 0; // reset spill after pull-forward
      for (let d = 0; d < nD; d++) {
        if (item.alloc[d] > 0 && days[d].week > 0) item.spill += item.alloc[d];
      }
    }

    const total = list.reduce((s, r) => s + r.total2, 0);
    return { list, load, dayTotals, skusOnDay, kpi: { skus: list.filter(r => r.total2 > 0).length, total, unfit: Math.round(unfitTotal), matShort: Math.round(matShortTotal), spillSkus: list.filter((r) => r.spill > 0).length } };
  }, [rows, days, capMap, lines, mat, strategy, filterRmpm]);

  const tableRows = useMemo(() => {
    if (mode === "daily") {
      if (dayFilter >= 0) {
        return daily.list.filter(r => (r.alloc[dayFilter] || 0) > 0);
      }
      return daily.list;
    }
    return rows;
  }, [mode, daily.list, rows, dayFilter]);
  const PER = 25;
  const pages = Math.max(1, Math.ceil(tableRows.length / PER));
  const cur = Math.min(page, pages - 1);
  const pageRows = tableRows.slice(cur * PER, cur * PER + PER);
  const src = plan[0]?.demand_source || "—";

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

  // Total per shift per hari (semua line): Sen–Jum dibagi 3 shift kelipatan 500 (LOT);
  // Sabtu 1/2 hari kerja = Shift 1 (target 1/2 shift), tanpa shift 2 & 3.
  const shiftVal = (i, s) => {
    const t = Math.round(daily.dayTotals[i]);
    if (days[i].shifts === 0.5) {
      if (s !== 0) return null;
      return t;
    }
    if (t <= 0) return 0;
    const totalLots = Math.round(t / LOT);
    const baseLots = Math.floor(totalLots / 3);
    const remLots = totalLots % 3;
    
    let shiftLots = baseLots;
    if (s === 0 && remLots >= 1) shiftLots += 1;
    if (s === 1 && remLots >= 2) shiftLots += 1;
    return shiftLots * LOT;
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

      <div className="gloss-tabs" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
        <button className={"gloss-pill" + (mode === "weekly" ? " active" : "")}
          onClick={() => { setMode("weekly"); setPage(0); }}>Weekly · {HORIZON} wk</button>
        <button className={"gloss-pill" + (mode === "daily" ? " active" : "")}
          onClick={() => { setMode("daily"); setPage(0); }}>Daily · {DAILY_WEEKS} wk</button>

        <span style={{ alignSelf: "center", color: "var(--muted)", fontSize: 12, marginLeft: 10, fontWeight: 600 }}>Lot Target:</span>
        <button className={"gloss-pill" + (lotDays === 7 ? " active" : "")}
          onClick={() => { setLotDays(7); setPage(0); }}
          title="Lot Size 7 Hari (1 Minggu demand)">⚡ 7 Hari (1 Wk)</button>
        <button className={"gloss-pill" + (lotDays === 14 ? " active" : "")}
          onClick={() => { setLotDays(14); setPage(0); }}
          title="Lot Size 14 Hari (2 Minggu demand - Ideal)">⚖ 14 Hari (2 Wk)</button>
        <button className={"gloss-pill" + (lotDays === 30 ? " active" : "")}
          onClick={() => { setLotDays(30); setPage(0); }}
          title="Lot Size 30 Hari (1 Bulan demand)">📦 30 Hari (1 Mo)</button>

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

      {mode === "daily" && (
        <div className="card">
          <h2 className="card-title">Production Capacity — Daily Reference</h2>
          <div className="card-note">
            per-shift capacity × shifts per day · Weekday=3 shifts (Mon–Fri) · Saturday=0.5 shifts · Sunday off
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th className="num">Per Shift</th>
                  <th className="num">Sat (0.5)</th>
                  <th className="num">Weekday (3)</th>
                  <th className="num">Weekly</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((L) => {
                  const wcap = capMap[L];
                  const rules = getRulesForLine(L);
                  let perShift = null, satCap = null, dayCap = null;
                  if (rules) {
                    perShift = rules[1].full || null;
                    dayCap = perShift ? perShift * 3 : null;
                    satCap = rules[1].half || null;
                  } else if (wcap) {
                    perShift = Math.round(wcap / WEEK_SHIFTS);
                    dayCap = Math.round((wcap / WEEK_SHIFTS) * 3);
                    satCap = Math.round(wcap / WEEK_SHIFTS);
                  }
                  return (
                    <tr key={L}>
                      <td className="name">{L}</td>
                      <td className="num">{perShift ? fmt(perShift) : "—"}</td>
                      <td className="num" style={{ fontWeight: 600, color: "var(--accent)" }}>{satCap ? fmt(satCap) : "—"}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{dayCap ? fmt(dayCap) : "—"}</td>
                      <td className="num">{wcap ? fmt(wcap) : "—"}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{L === "Assembly/Other" ? "No dedicated line" : L === "Liquid 15ml" ? "2 teams (ABC+D)" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                ? `LEVEL strategy: production is spread EVENLY across working days (Lot Target: ${lotDays} Hari) — steady qty per day & 3 shifts; Class A fast-movers fill empty capacity up to optimal 85-95% utilization.`
                : "FRONT-LOAD strategy: earliest days are filled to capacity first (max urgency); later days stay free.") +
              (hasMatGate
                ? " Production is GATED by material (RMPM) on-hand — consignment/daily supplies count as always available."
                : " Material gate inactive — run migration 0039 (v_bom_matrix) to block production when RMPM is empty.")
            : `Assumes production is available within its week (FG lead ≤ 1 week, Lot Target: ${lotDays} Hari).`}
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
            <div className="kpi-sub">of {fmt(rows.length)} active (Lot: {lotDays}d)</div>
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
              daily capacity = weekly ÷ 15.5 shifts × day shifts (Mon–Fri 3 · Sat 0.5) · units shown | green OK · amber tight (&gt;85%) · red over (&gt;100%)
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
                  {days.map((d, i) => {
                    const totalCapForDay = lines.reduce((acc, L) => {
                      const wcap = capMap[L];
                      const rules = getRulesForLine(L);
                      const numSkus = daily.skusOnDay[L][i].size;
                      const isSat = d.shifts === 0.5;
                      if (rules) {
                        const n = Math.min(4, Math.max(1, numSkus || 1));
                        return acc + (isSat ? rules[n].half : 3 * rules[n].full);
                      }
                      return acc + (wcap ? (wcap * (isSat ? 1 : 3)) / WEEK_SHIFTS : 0);
                    }, 0);
                    const util = totalCapForDay > 0 ? (daily.dayTotals[i] / totalCapForDay) * 100 : 0;
                    let badge = null;
                    if (util > 100) badge = <span style={{ fontSize: 9, color: "var(--red)", fontWeight: 700, display: "block" }}>Over</span>;
                    else if (util >= 75) badge = <span style={{ fontSize: 9, color: "var(--green)", fontWeight: 700, display: "block" }}>{d.shifts === 0.5 ? "Sat Opt" : "3 Shift Opt"}</span>;
                    else if (daily.dayTotals[i] > 0) badge = <span style={{ fontSize: 9, color: "var(--amber)", display: "block" }}>Under Cap</span>;
                    return (
                      <th className="num" key={d.iso} style={{ whiteSpace: "nowrap" }}>
                        {d.lbl}{d.shifts === 0.5 ? " ½" : ""}
                        {badge}
                      </th>
                    );
                  })}
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
                        const isSat = days[i].shifts === 0.5;
                        let capD = null;
                        if (rules) {
                          const n = Math.min(4, Math.max(1, numSkus || 1));
                          capD = isSat ? rules[n].half : 3 * rules[n].full;
                        } else if (wcap) {
                          capD = (wcap * (isSat ? 1 : 3)) / WEEK_SHIFTS;
                        }
                        const util = capD ? (u / capD) * 100 : null;
                        return (
                          <td className="num" key={i} style={heatStyle(util)}
                            title={fmt(u) + " / cap " + (capD ? fmt(capD) : "—") + " · " + numSkus + " SKUs"}>
                            {u < 1 ? "—" : fmt(u)}
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
                  {days.map((d) => <th className="num" key={d.iso}>{d.lbl}{d.shifts === 0.5 ? " ½" : ""}</th>)}
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
                        const isSat = d.shifts === 0.5;
                        let capD = null;
                        if (rules) {
                          const n = Math.min(4, Math.max(1, numSkus || 1));
                          capD = isSat ? rules[n].half : 3 * rules[n].full;
                        } else if (capMap[L]) {
                          capD = (capMap[L] * (isSat ? 1 : 3)) / WEEK_SHIFTS;
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
                              : pct(capD ? (freeV / capD) * 100 : 0) + " free · ≈ " + fmt(freeV / (isSat ? 1 : 3)) + "/shift"}>
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
                  {days.map((d) => <th className="num" key={d.iso}>{d.lbl}{d.shifts === 0.5 ? " ½" : ""}</th>)}
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
            ? `Daily Production Plan${dayFilter >= 0 ? " — " + days[dayFilter].lbl + " " + days[dayFilter].iso.slice(8) : ""} (${fmt(dayFilter >= 0 ? tableRows.filter(r => (r.alloc[dayFilter] || 0) > 0).length : tableRows.length)})`
            : `Weekly Production Plan — by SKU (${fmt(rows.length)})`}
        </h2>
        <div className="card-note">
          {mode === "daily" ? (
            <>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                sorted by PRIORITY · lot {fmt(LOT)} ·&nbsp;
                <button className={"gloss-pill" + (dayFilter === -1 ? " active" : "")} onClick={() => { setDayFilter(-1); setPage(0); }}>All Days</button>
                {days.map((d, idx) => (
                  <button key={idx} className={"gloss-pill" + (dayFilter === idx ? " active" : "")} onClick={() => { setDayFilter(idx); setPage(0); }}>
                    {d.lbl} {d.iso.slice(8)}
                  </button>
                ))}
              </span>
            </>
          ) : (
            `units to produce each week to hold 30-day cover · 💰 = payday week (higher demand) · ${PER} rows per page`
          )}
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
                  {days.map((d) => <th className="num" key={d.iso}>{d.lbl}{d.shifts === 0.5 ? " ½" : ""}</th>)}
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
              {mode === "daily" && dayFilter === -1 && (
                <>
                  {(() => {
                    const lineAgg = {};
                    for (const r of tableRows) {
                      const L = r.prod_line || "Other";
                      if (!lineAgg[L]) lineAgg[L] = { total: 0, days: Array(days.length).fill(0) };
                      lineAgg[L].total += r.total2 || 0;
                      (r.alloc || []).forEach((v, j) => { lineAgg[L].days[j] += v || 0; });
                    }
                    return Object.entries(lineAgg).sort((a, b) => b[1].total - a[1].total).map(([L, agg]) => (
                      <tr key={"sub-" + L} style={{ background: "var(--panel-2)", fontWeight: 700 }}>
                        <td colSpan={5} className="name" style={{ color: "var(--accent)" }}>
                          {L} · {fmt(Object.values(lineAgg).filter(x => x === agg).length || tableRows.filter(r => r.prod_line === L).length)} SKUs
                        </td>
                        {agg.days.map((v, j) => (
                          <td className="num" key={j}>{v > 0 ? fmt(v) : "—"}</td>
                        ))}
                        <td className="num">{fmt(agg.total)}</td>
                      </tr>
                    ));
                  })()}
                  <tr style={{ background: "var(--panel)", fontWeight: 700, borderTop: "2px solid var(--accent)" }}>
                    <td colSpan={5} className="name">TOTAL ALL LINES</td>
                    {days.map((d, i) => {
                      const t = tableRows.reduce((s, r) => s + (r.alloc ? (r.alloc[i] || 0) : 0), 0);
                      return <td className="num" key={i}>{t > 0 ? fmt(t) : "—"}</td>;
                    })}
                    <td className="num">{fmt(tableRows.reduce((s, r) => s + (r.total2 || 0), 0))}</td>
                  </tr>
                </>
              )}
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
          <Pager page={cur} pages={pages} total={tableRows.length} perPage={PER} onPage={setPage} />
        )}
      </div>

      {mode === "daily" && daily.list.some((r) => r.matShort > 0) && (
        <div className="card" style={{ borderColor: "var(--red)", marginTop: "1rem" }}>
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
    </>
  );
}
