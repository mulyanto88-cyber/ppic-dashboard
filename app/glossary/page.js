"use client";

import { useState } from "react";

// group = dashboard tab tempat istilah dipakai
const TERMS = [
  // ---------- Demand Analytics ----------
  {
    group: "Demand",
    term: "ABC (by Value)",
    tag: "Pareto",
    def: "Classifies SKUs by 12-month sales value. Tier A = top 80% of cumulative value, B = next 15%, C = the tail. Focuses effort where the money is.",
    formula: "cumulative value %: A ≤ 80% · B ≤ 95% · C = rest"
  },
  {
    group: "Demand",
    term: "ABC (by Quantity)",
    tag: "Pareto",
    def: "Same Pareto logic but based on units delivered instead of value."
  },
  {
    group: "Demand",
    term: "Category Contribution Tier",
    tag: "FOOM method",
    def: "Cumulative contribution ranked within each Product Type. Fast = top SKUs up to 80% of the type's volume, Medium = up to 95%, Slow = the tail.",
    formula: "cumulative % within Type: Fast ≤ 80% · Medium ≤ 95% · Slow = rest"
  },
  {
    group: "Demand",
    term: "Movement / Velocity (FSN + New Launch)",
    tag: "Quantile & Age",
    def: "Evaluates product sales velocity using quantile volume contribution within each Product Type (Liquid, Cartridge, Device) for established products, while isolating newly launched SKUs (< 3 months active) into 'New Launch' to eliminate launch bias.",
    formula: "🚀 New Launch (age < 3mo) · ⚡ Fast (top 80% volume of Type) · 📦 Medium (80–95% volume) · 🐢 Slow (bottom 5%) · ❄️ Non-Moving (0 sales in L3M)"
  },
  {
    group: "Demand",
    term: "Demand Analytics Interactive Filters",
    tag: "Multi-Dimensional",
    def: "Dynamic dropdown filters for Brand / Group (FOOM, FLOOID, OEM), Sub Category (Liquid, Cartridge, SFG, Merchandise, etc.), and Type (30ML, 15ML, Cartridge, Capsule, etc.). Reactively recalculates all 8 dashboard sections including KPI Cards, 18-Month Combo Chart, 12-Week Bars, Velocity Table, and Pareto ABC.",
    formula: "Filters: Brand / Group × Sub Category × Type → Real-time Reactive Dashboard recalculation"
  },
  {
    group: "Demand",
    term: "XYZ (Demand Variability)",
    tag: "forecastability",
    def: "Coefficient of Variation of monthly demand. X = stable, Y = moderate, Z = erratic / intermittent. Drives which forecast method fits a SKU.",
    formula: "CoV = std dev ÷ mean · X < 0.5 · Y 0.5–1.0 · Z > 1.0"
  },
  {
    group: "Demand",
    term: "Trend / Momentum",
    tag: "6-mo slope",
    def: "Direction of the last 6 complete months — the slope of a linear trend line fit through them (mimics reading the SKU's line chart). De-seasonalized by using recent months only; not year-over-year, so it isn't inflated by overall business growth.",
    formula: "slope ÷ avg · Growing ≥ +5%/mo · Stable · Declining ≤ −5%/mo"
  },
  {
    group: "Demand",
    term: "Sales L3M & Avg/mo",
    tag: "recent",
    def: "Sales L3M shows the last calendar months individually. Avg/mo is the clean monthly run-rate derived from recent live sales history — not distorted by static view caches.",
    formula: "Avg/mo = recent 3-month sales ÷ 3"
  },
  {
    group: "Demand",
    term: "Weekly Pattern",
    tag: "seasonality",
    def: "Units delivered per ISO week over the last 12 weeks. Reveals intra-month rhythm — e.g. payday from the 25th tends to lift end-of-month weeks, informing weekly safety stock."
  },

  // ---------- Forecast ----------
  {
    group: "Forecast",
    term: "Forecast Methods",
    tag: "model library",
    def: "Six methods are computed per SKU and compared: Naive (repeat last month), MA-3 (3-month average), WMA (weighted, recency-biased), Linear Trend (projects 6-month slope), Seasonal (trend × per-month seasonal index), and New SKU (+10% growth for products < 3mo old). Compare them in the Model Lab sub-tab."
  },
  {
    group: "Forecast",
    term: "New SKU Forecast (+10% Growth)",
    tag: "short history",
    def: "For newly launched SKUs with less than 3 months of sales history, WMA or Linear Trend can be diluted by initial launch samples or steep single-month spikes. The forecast engine automatically selects the New SKU (+10%) method, applying a clean 10% monthly growth over the last actual sales volume.",
    formula: "forecast = Math.round(last_actual_month_sales × 1.10) for short history SKUs (< 3mo)"
  },
  {
    group: "Forecast",
    term: "WMA — Weighted Moving Average",
    tag: "baseline",
    def: "The validated baseline method. Weights the last three months, emphasizing the most recent to capture momentum. Also the safe fallback when a SKU has too little history to backtest.",
    formula: "forecast = 0.6·(M-1) + 0.3·(M-2) + 0.1·(M-3)"
  },
  {
    group: "Forecast",
    term: "Linear Trend",
    tag: "method",
    def: "Fits a straight line through the last 6 complete months and projects it forward, so a growing SKU forecasts up and a declining one forecasts down (clamped at 0). Replaces the old flat forecast for trending SKUs.",
    formula: "forecast(k) = intercept + slope · k"
  },
  {
    group: "Forecast",
    term: "Seasonal",
    tag: "method",
    def: "Multiplies a trend level by a per-calendar-month seasonal index (avg of that month ÷ overall avg). Needs ≥ 12 months of history; falls back to Linear Trend otherwise.",
    formula: "forecast = trend · (month avg ÷ overall avg)"
  },
  {
    group: "Forecast",
    term: "Champion Model",
    tag: "auto-select",
    def: "Per SKU, the method with the lowest backtest wMAPE (or New SKU +10% for short history) is chosen automatically as the champion and drives that SKU's forecast.",
    formula: "champion = argmin(wMAPE) over all methods (fallback: New SKU +10% for < 3mo history)"
  },
  {
    group: "Forecast",
    term: "Forecast Horizon",
    tag: "window",
    def: "The forecast covers the next 3 complete calendar months. Evaluated directly from live monthly sales transactions."
  },
  {
    group: "Forecast",
    term: "Best Estimate (BE) — current month",
    tag: "projection",
    def: "Projection of the in-progress month, shown with a * (e.g. Jul*). Month-to-date sales are grossed up by how far through the month the SKU should be, where the progress % mirrors that SKU's own weekly sales curve last month (day-weighted). Context display only.",
    formula: "BE = month-to-date ÷ progress%"
  },
  {
    group: "Forecast",
    term: "wMAPE (volume-weighted)",
    tag: "KPI",
    def: "Volume-weighted MAPE — the reliable accuracy metric, weighting SKUs by how much they matter. Forecast Accuracy = 100 − wMAPE. Target ≥ 80%.",
    formula: "Forecast Accuracy = 100 − wMAPE"
  },
  {
    group: "Forecast",
    term: "Forecast Baseline (published)",
    tag: "official",
    def: "A dated snapshot of the champion forecast, locked via the Publish button. It becomes the single official demand figure feeding MPS & MRP.",
    formula: "run_date · forecast_month · SKU · qty · method"
  },
  {
    group: "Forecast",
    term: "Forecast Bias",
    tag: "direction",
    def: "Whether the forecast systematically runs high or low. Positive = over-forecasting, negative = under-forecasting.",
    formula: "bias = (Σforecast − Σactual) ÷ Σactual × 100%"
  },

  // ---------- Inventory Health ----------
  {
    group: "Inventory",
    term: "SOH — Stock on Hand",
    def: "Physical units available in stock (finished-goods warehouses)."
  },
  {
    group: "Inventory",
    term: "Stock Cover (Weeks Cover)",
    tag: "KPI Card",
    def: "Calculates how many weeks of demand current physical SOH can cover based on recent 3-month sales run-rate. Placed prominently between SOH and Forecast cards in Deep Dive with dynamic status badges.",
    formula: "Weeks Cover = SOH ÷ (recent 3-month monthly sales ÷ 4.345) · Status: 🔴 Critical Stock (< LT) · ⚠️ Below Min (< LT+SS) · 🟢 Stock Healthy"
  },
  {
    group: "Inventory",
    term: "DOI — Days of Inventory",
    tag: "coverage",
    def: "How many days current stock will last.",
    formula: "DOI = SOH ÷ average daily demand"
  },
  {
    group: "Inventory",
    term: "Safety / Minimum Stock",
    tag: "policy",
    def: "Target buffer to absorb variability.",
    formula: "FG = 30 days · RMPM = (lead_time + safety_stock + 7d review) days"
  },
  {
    group: "Inventory",
    term: "Slow / Non-Moving Stock",
    def: "SKUs holding stock but with Slow or Non-Moving velocity — capital tied up, obsolescence risk."
  },

  // ---------- Planning & MRP ----------
  {
    group: "Planning & MRP",
    term: "Weekly Vendor PO Plan (Senin Cut-off)",
    tag: "Procurement Plan",
    def: "Consolidates purchase order requirements by Vendor for a fixed weekly release schedule every Monday. Includes a 7-day Review Cycle Buffer to prevent stockouts between weekly ordering windows, enforcing MOQ per material.",
    formula: "Order Cut-Off: Every Monday · Target Stock Days = Lead Time + Safety Stock + 7-Day Review Buffer"
  },
  {
    group: "Planning & MRP",
    term: "Batch Size Rounding (Simulator)",
    tag: "Production Scheduling",
    def: "Rounds recommended production batch quantities in Deep Dive & MPS simulator to realistic lot sizes. Set to default 500 pcs.",
    formula: "Batch Qty = Math.ceil(Requirement ÷ 500) × 500 (default lot: 500 pcs)"
  },
  {
    group: "Planning & MRP",
    term: "Net Requirement",
    tag: "MRP",
    def: "What actually needs to be produced or ordered. For materials, the target adapts per material including lead time, safety stock, and 7-day weekly review cycle.",
    formula: "net = (lead time + safety days + 7d review) × weekly use ÷ 7 − stock position"
  },
  {
    group: "Planning & MRP",
    term: "PO Release Calendar / Time-Phased",
    tag: "PO Calendar",
    def: "Time-phased view showing WHEN each purchase order must be released over an 8-week horizon so stock never dips below safety level.",
    formula: "release_date = (week stock hits safety) − lead_time"
  },
  {
    group: "Planning & MRP",
    term: "MPS — Master Production Schedule",
    def: "The weekly finished-goods production plan derived from demand vs stock."
  },
  {
    group: "Planning & MRP",
    term: "Material Master (RMPM)",
    tag: "editable",
    def: "Per-material planning parameters maintained in the dashboard (Deep Dive → Material Master): vendor, lead time, MOQ, safety-stock days, local/import source, RM/PM class, active status.",
    formula: "MRP target = (lead time + safety stock + 7-day review) of consumption"
  },
  {
    group: "Planning & MRP",
    term: "Lead Time",
    tag: "per material",
    def: "Time from ordering to availability. Local suppliers ≈ 14 days, import vendors ≈ 45 days."
  },
  {
    group: "Planning & MRP",
    term: "MOQ — Minimum Order Quantity",
    def: "Minimum purchase lot size per material, maintained in the Material Master. Enforced automatically in MRP net requirement and PO Calendar.",
    formula: "order qty = max(requirement, MOQ)"
  },
  {
    group: "Planning & MRP",
    term: "Stock Position",
    def: "Total material availability per item.",
    formula: "position = SOH + PO incoming + MO WIP"
  },
  {
    group: "Planning & MRP",
    term: "Consignment / Daily supply",
    def: "Materials whose supply is assured — consignment stock held in warehouse or delivered daily. Net requirement = 0."
  },

  // ---------- Deep Dive & UX ----------
  {
    group: "General",
    term: "Deep Dive SKU & RMPM Drill-Down",
    tag: "UX & Master Data",
    def: "Interactive 360° view of single FG SKU or RMPM material repository. Search supports instant paste + Enter auto-navigation. Incorporates live sales series, stock cover indicators, batch rounding simulator (default 500 pcs), and Master Data editor."
  },
  {
    group: "General",
    term: "FG / SFG / RMPM",
    def: "Finished Goods · Semi-Finished Goods · Raw Material & Packaging Material."
  },
  {
    group: "General",
    term: "BOM — Bill of Materials",
    def: "The recipe: which components (and quantities) make up each finished good."
  },
  {
    group: "General",
    term: "Continue vs Discontinued",
    def: "Product status. Discontinued SKUs with remaining SOH are still displayed with full analytics."
  },
  {
    group: "General",
    term: "SKU",
    def: "Stock Keeping Unit — a uniquely identified sellable product."
  }
];

const GROUPS = ["All", "Demand", "Forecast", "Inventory", "Planning & MRP", "General"];

export default function Glossary() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const ql = q.trim().toLowerCase();

  const filtered = TERMS.filter(
    (t) =>
      (group === "All" || t.group === group) &&
      (ql === "" ||
        t.term.toLowerCase().includes(ql) ||
        t.def.toLowerCase().includes(ql) ||
        (t.tag || "").toLowerCase().includes(ql))
  );

  const count = (g) => (g === "All" ? TERMS.length : TERMS.filter((t) => t.group === g).length);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Glossary</h1>
        <div className="page-sub">Definitions of the metrics, formulas &amp; operational logic used across the dashboard</div>
      </div>

      <div style={{ position: "relative", marginBottom: "20px" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position: 'absolute', left: '16px', top: '16px', color: 'var(--muted)'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input
          className="gloss-search"
          placeholder="Search a term, formula or definition…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ paddingLeft: "46px" }}
        />
      </div>

      <div className="gloss-tabs">
        {GROUPS.map((g) => (
          <button
            key={g}
            className={"gloss-pill" + (group === g ? " active" : "")}
            onClick={() => setGroup(g)}
          >
            {g}
            <span className="gloss-count">{count(g)}</span>
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="gloss-empty">No terms match “{q}”.</div>
        ) : (
          filtered.map((it, j) => (
            <div className="gloss-item" key={j}>
              <div>
                <span className="gloss-term">{it.term}</span>
                {it.tag && <span className="gloss-tag">· {it.tag}</span>}
                {group === "All" && <span className="gloss-tag">· {it.group}</span>}
              </div>
              <div className="gloss-def">{it.def}</div>
              {it.formula && <div className="gloss-formula">{it.formula}</div>}
            </div>
          ))
        )}
      </div>
    </>
  );
}
