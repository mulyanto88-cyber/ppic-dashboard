// =============================================================================
// PPIC — Forecast engine (client-safe, no deps).
// Dihitung di sisi klien dari deret bulanan v_sku_monthly_series (bulan LENGKAP,
// 0-fill). Dipakai bersama oleh tab Forecast: Overview, Accuracy, Model Lab.
//
// Metode: naive · MA-3 · WMA(0.6/0.3/0.1) · Linear Trend · Seasonal(trend×index)
// Champion = metode dgn wMAPE backtest terendah (1-step rolling) per SKU.
// Horizon = 3 bulan LENGKAP berikutnya (bulan berjalan yg parsial dilewati).
// =============================================================================

const isNum = (x) => typeof x === "number" && isFinite(x);
const clamp0 = (x) => (isNum(x) && x > 0 ? x : 0);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const qtyArr = (series) => series.map((p) => Number(p.q) || 0);

// ---- fit y = a + b*x, x = 0..n-1 (ordinary least squares) --------------------
function linregCoef(y) {
  const n = y.length;
  if (n < 2) return { a: n ? y[0] : 0, b: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxx += i * i; sxy += i * y[i]; }
  const denom = n * sxx - sx * sx;
  const b = denom ? (n * sxy - sx * sy) / denom : 0;
  const a = (sy - b * sx) / n;
  return { a, b };
}

// ---- METHODS: fn(series, h) -> array panjang h (nilai forward step 1..h) -----
function fcNaive(series, h) {
  const q = qtyArr(series);
  const last = q.length ? q[q.length - 1] : 0;
  return Array(h).fill(clamp0(last));
}
function fcMA3(series, h) {
  const v = clamp0(mean(qtyArr(series).slice(-3)));
  return Array(h).fill(v);
}
function fcWMA(series, h) {
  const w = qtyArr(series).slice(-3);                 // [M-3, M-2, M-1]
  const weights = [0.1, 0.3, 0.6].slice(3 - w.length); // sejajarkan ke ekor bila <3
  const wn = weights.reduce((a, b) => a + b, 0);
  let v = 0;
  for (let i = 0; i < w.length; i++) v += w[i] * weights[i];
  return Array(h).fill(clamp0(wn ? v / wn : 0));
}
function fcTrend(series, h) {
  const y = qtyArr(series).slice(-6);                 // garis tren 6 bln terakhir
  const { a, b } = linregCoef(y);
  const n = y.length;
  const out = [];
  for (let k = 1; k <= h; k++) out.push(clamp0(a + b * (n - 1 + k)));
  return out;
}
function fcSeasonal(series, h) {
  const q = qtyArr(series);
  if (q.length < 12) return fcTrend(series, h);       // butuh ≥1 tahun; jika tidak → tren
  const overall = mean(q);
  if (overall <= 0) return Array(h).fill(0);
  const byMon = {};                                   // 0..11 -> nilai per bulan kalender
  series.forEach((p) => {
    const mo = new Date(p.ym).getUTCMonth();
    (byMon[mo] = byMon[mo] || []).push(Number(p.q) || 0);
  });
  const factor = {};
  for (let mo = 0; mo < 12; mo++) factor[mo] = byMon[mo] ? mean(byMon[mo]) / overall : 1;
  const { a, b } = linregCoef(q.slice(-12));           // level+tren dari 12 bln terakhir
  const n = Math.min(12, q.length);
  const lastMon = new Date(series[series.length - 1].ym).getUTCMonth();
  const out = [];
  for (let k = 1; k <= h; k++) {
    const base = clamp0(a + b * (n - 1 + k));
    const mo = (lastMon + k) % 12;
    out.push(clamp0(base * (factor[mo] || 1)));
  }
  return out;
}

export const METHODS = {
  naive:    { label: "Naive",        fn: fcNaive },
  ma3:      { label: "MA-3",         fn: fcMA3 },
  wma:      { label: "WMA",          fn: fcWMA },
  trend:    { label: "Linear Trend", fn: fcTrend },
  seasonal: { label: "Seasonal",     fn: fcSeasonal },
};
export const METHOD_KEYS = ["naive", "ma3", "wma", "trend", "seasonal"];

// ---- Per-prediction 1-step-ahead holdout: [{ym, f, a}] -----------------------
export function predictions(series, method, minHist = 6) {
  const fn = METHODS[method].fn;
  const out = [];
  for (let t = minHist; t < series.length; t++) {
    out.push({ ym: series[t].ym, f: fn(series.slice(0, t), 1)[0], a: Number(series[t].q) || 0 });
  }
  return out;
}

// ---- Backtest -> wMAPE (%). Return raw ae/tot utk agregasi volume-weighted ----
export function backtest(series, method, minHist = 6) {
  const preds = predictions(series, method, minHist);
  let ae = 0, tot = 0;
  for (const p of preds) { ae += Math.abs(p.f - p.a); tot += Math.abs(p.a); }
  return { wmape: tot > 0 ? (ae / tot) * 100 : null, nPred: preds.length, ae, tot };
}

// ---- Champion: wMAPE backtest terendah (fallback WMA jika data tipis) --------
export function champion(series, methods = METHOD_KEYS) {
  const scored = methods
    .map((m) => ({ method: m, ...backtest(series, m) }))
    .filter((x) => x.wmape !== null && x.nPred >= 3);
  if (!scored.length) return { method: "wma", wmape: null, nPred: 0 };
  scored.sort((a, b) => a.wmape - b.wmape);
  return scored[0];
}

// ---- Forward forecast utk horizon; lewati bulan berjalan yg parsial ----------
// Deret berakhir di bulan LENGKAP terakhir (mis. Jun). skipCurrent=true melewati
// bulan berjalan (Jul) -> mengembalikan Aug/Sep/Oct.
export function forecastForward(series, method, { h = 3, skipCurrent = true } = {}) {
  if (!series || !series.length) return [];
  const fn = METHODS[method].fn;
  const skip = skipCurrent ? 1 : 0;
  const raw = fn(series, h + skip);
  const last = new Date(series[series.length - 1].ym);
  const out = [];
  for (let i = 0; i < h; i++) {
    const step = skip + i + 1;
    const d = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + step, 1));
    out.push({ ym: d.toISOString().slice(0, 10), q: Math.round(raw[step - 1]) });
  }
  return out;
}

// ---- Fitted (in-sample) utk garis chart Model Lab: 1-step di tiap titik ------
export function fitted(series, method, minHist = 3) {
  const fn = METHODS[method].fn;
  return series.map((p, t) =>
    t < minHist ? null : Math.round(fn(series.slice(0, t), 1)[0])
  );
}

// ---- Grouping helper: baris flat -> { sku_name: [{ym,q}] terurut } -----------
export function groupSeries(rows) {
  const map = {};
  for (const r of rows) {
    (map[r.sku_name] = map[r.sku_name] || []).push({ ym: r.month, q: Number(r.qty) || 0 });
  }
  for (const k in map) map[k].sort((a, b) => (a.ym < b.ym ? -1 : 1));
  return map;
}

// ---- Matrix helper: {sku_name, start_month, qtys[]} -> { sku_name: [{ym,q}] }
// v_sku_monthly_matrix = 1 baris per SKU (deret di-array) supaya seluruh SKU
// terangkut sekali fetch — deret flat kena limit 1000 baris PostgREST.
export function seriesFromMatrix(rows) {
  const map = {};
  for (const r of rows) {
    const st = new Date(r.start_month);
    const y0 = st.getUTCFullYear(), m0 = st.getUTCMonth();
    map[r.sku_name] = (r.qtys || []).map((q, i) => {
      const d = new Date(Date.UTC(y0, m0 + i, 1));
      return { ym: d.toISOString().slice(0, 10), q: Number(q) || 0 };
    });
  }
  return map;
}
