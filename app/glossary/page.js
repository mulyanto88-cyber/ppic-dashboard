"use client";
import { useState } from "react";

// group = dashboard tab tempat istilah dipakai
const TERMS = [
  // ---------- Demand Analytics ----------
  { group: "Demand", term: "ABC (by Value)", tag: "Pareto", def: "Classifies SKUs by 12-month sales value. Tier A = top 80% of cumulative value, B = next 15%, C = the tail. Focuses effort where the money is.", formula: "cumulative value %: A ≤ 80% · B ≤ 95% · C = rest" },
  { group: "Demand", term: "ABC (by Quantity)", tag: "Pareto", def: "Same Pareto logic but based on units delivered instead of value." },
  { group: "Demand", term: "Category Contribution Tier", tag: "FOOM method", def: "Cumulative contribution ranked within each Product Type. Fast = top SKUs up to 50% of the type's volume, Medium = up to 80%, Slow = the tail.", formula: "cumulative % within Type: Fast ≤ 50% · Medium ≤ 80% · Slow = rest" },
  { group: "Demand", term: "Movement / Velocity", tag: "FSN", def: "How often a SKU sells over the last 12 months. Fast ≥ 10 active months, Medium 5–9, Slow 1–4, Dead = none. Note: velocity lags a recent decline — pair it with Trend.", formula: "months active out of 12: Fast ≥ 10 · Medium 5–9 · Slow 1–4 · Dead 0" },
  { group: "Demand", term: "XYZ (Demand Variability)", tag: "forecastability", def: "Coefficient of Variation of monthly demand. X = stable, Y = moderate, Z = erratic / intermittent. Drives which forecast method fits a SKU.", formula: "CoV = std dev ÷ mean · X < 0.5 · Y 0.5–1.0 · Z > 1.0" },
  { group: "Demand", term: "Trend / Momentum", tag: "6-mo slope", def: "Direction of the last 6 complete months — the slope of a linear trend line fit through them (mimics reading the SKU's line chart). De-seasonalized by using recent months only; not year-over-year, so it isn't inflated by overall business growth.", formula: "slope ÷ avg · Growing ≥ +5%/mo · Stable · Declining ≤ −5%/mo" },
  { group: "Demand", term: "Sales L3M & Avg/mo", tag: "recent", def: "Sales L3M shows the last calendar months individually (the current month is partial, marked *). Avg/mo is the clean monthly run-rate derived from the last 12 complete weeks — not distorted by the partial month.", formula: "Avg/mo = (last 12 weeks ÷ 12) × 4.345" },
  { group: "Demand", term: "Weekly Pattern", tag: "seasonality", def: "Units delivered per ISO week over the last 12 weeks. Reveals intra-month rhythm — e.g. payday from the 25th tends to lift end-of-month weeks, informing weekly safety stock." },

  // ---------- Forecast ----------
  { group: "Forecast", term: "Forecast Methods", tag: "model library", def: "Five methods are computed per SKU and compared: Naive (repeat last month), MA-3 (3-month average), WMA (weighted, recency-biased), Linear Trend (projects the 6-month slope forward — captures growth/decline), and Seasonal (trend × per-month seasonal index). Compare them in the Model Lab sub-tab." },
  { group: "Forecast", term: "WMA — Weighted Moving Average", tag: "baseline", def: "The validated baseline method. Weights the last three months, emphasizing the most recent to capture momentum. Also the safe fallback when a SKU has too little history to backtest.", formula: "forecast = 0.6·(M-1) + 0.3·(M-2) + 0.1·(M-3)" },
  { group: "Forecast", term: "Linear Trend", tag: "method", def: "Fits a straight line through the last 6 complete months and projects it forward, so a growing SKU forecasts up and a declining one forecasts down (clamped at 0). Replaces the old flat forecast for trending SKUs.", formula: "forecast(k) = intercept + slope · k" },
  { group: "Forecast", term: "Seasonal", tag: "method", def: "Multiplies a trend level by a per-calendar-month seasonal index (avg of that month ÷ overall avg). Needs ≥ 12 months of history; falls back to Linear Trend otherwise. Captures repeating patterns like end-of-month payday lift.", formula: "forecast = trend · (month avg ÷ overall avg)" },
  { group: "Forecast", term: "Champion Model", tag: "auto-select", def: "Per SKU, the method with the lowest backtest wMAPE is chosen automatically as the champion and drives that SKU's forecast — so each SKU gets the model that fits its own behaviour (stable, trending, or erratic).", formula: "champion = argmin(wMAPE) over all methods" },
  { group: "Forecast", term: "Forecast Horizon", tag: "window", def: "The forecast covers the next 3 complete calendar months. The current in-progress month is partial, so it is skipped — e.g. mid-July forecasts Aug / Sep / Oct, not the half-finished July." },
  { group: "Forecast", term: "Best Estimate (BE) — current month", tag: "projection", def: "Projection of the in-progress month, shown with a * (e.g. Jul*). Month-to-date sales are grossed up by how far through the month the SKU should be, where the progress % mirrors that SKU's own weekly sales curve last month (day-weighted) — so back-loaded SKUs (payday lift from the 25th, end-of-month distributor orders) are projected on their own rhythm. SKUs with thin history fall back to the global curve. Display context only — it does not feed the forecast engine, the published baseline, or MPS/MRP.", formula: "BE = month-to-date ÷ progress% · progress% = SKU's share of last month's sales through the same day (fallback: global curve)" },
  { group: "Forecast", term: "MAPE", tag: "error", def: "Mean Absolute Percentage Error — average of |forecast − actual| ÷ actual. Simple MAPE is distorted by tiny SKUs, so we rely on wMAPE." },
  { group: "Forecast", term: "wMAPE (volume-weighted)", tag: "KPI", def: "Volume-weighted MAPE — the reliable accuracy metric, weighting SKUs by how much they matter. Forecast Accuracy = 100 − wMAPE. Target ≥ 80%.", formula: "Forecast Accuracy = 100 − wMAPE" },
  { group: "Forecast", term: "Backtest", tag: "validation", def: "Tests a method on past months where the actual is already known — a 1-step-ahead rolling holdout — to judge accuracy objectively rather than by eye. Basis for picking each SKU's champion.", formula: "at each month t: forecast from months 0..t-1, compare to actual t" },
  { group: "Forecast", term: "Forecast Baseline (published)", tag: "official", def: "A dated snapshot of the champion forecast, locked via the Publish button. It becomes the single official demand figure feeding MPS & MRP, and the reference against which next month's actuals are scored for live accuracy. Re-publishing the same day overwrites that run; a new day is a new run.", formula: "run_date · forecast_month · SKU · qty · method" },
  { group: "Forecast", term: "Live Performance (published vs actual)", tag: "real accuracy", def: "The true test of the forecast: once a forecast month completes, the locked baseline (the last one published before that month began) is compared against actual sales. Fills in automatically each month — no action needed. Under/Accurate/Over uses a ±10% band per SKU.", formula: "accuracy = 100 − wMAPE of locked baseline vs actual" },
  { group: "Forecast", term: "Forecast Bias", tag: "direction", def: "Whether the forecast systematically runs high or low. Positive = over-forecasting (excess stock risk), negative = under-forecasting (stock-out risk). Persistent bias in one direction means the model or assumptions need adjusting.", formula: "bias = (Σforecast − Σactual) ÷ Σactual × 100%" },

  // ---------- Inventory Health ----------
  { group: "Inventory", term: "SOH — Stock on Hand", def: "Physical units available in stock (finished-goods warehouses)." },
  { group: "Inventory", term: "DOI — Days of Inventory", tag: "coverage", def: "How many days current stock will last.", formula: "DOI = SOH ÷ average daily demand" },
  { group: "Inventory", term: "Weeks of Cover", tag: "coverage", def: "Same idea at weekly grain, for the weekly MPS cadence. Critical < 1 week (below production lead time), Below Min < 30 days.", formula: "SOH ÷ weekly demand run-rate" },
  { group: "Inventory", term: "Safety / Minimum Stock", tag: "policy", def: "Target buffer to absorb variability.", formula: "FG = 30 days · RMPM = 45 days" },
  { group: "Inventory", term: "Slow / Dead Stock", def: "SKUs holding stock but with Slow or Dead velocity — capital tied up, obsolescence risk." },
  { group: "Inventory", term: "Inventory Value (est.)", def: "Estimated value = SOH × average sales price. It is a retail-value estimate; will be replaced by cost/HPP when available." },

  // ---------- Planning & MRP ----------
  { group: "Planning & MRP", term: "Demand Source", tag: "MPS/MRP input", def: "Where planning demand comes from. When a forecast baseline is published, MPS & MRP use it (monthly baseline ÷ 4.345 = weekly rate); otherwise they fall back to the 12-week sales run-rate. Shown per SKU in the MPS table.", formula: "weekly demand = avg(baseline horizon months) ÷ 4.345" },
  { group: "Planning & MRP", term: "Net Requirement", tag: "MRP", def: "What actually needs to be produced or ordered.", formula: "Net = SOH + incoming (open PO) + WIP − demand" },
  { group: "Planning & MRP", term: "MPS — Master Production Schedule", def: "The weekly finished-goods production plan derived from demand vs stock." },
  { group: "Planning & MRP", term: "MRP — Material Requirements Planning", def: "Explodes FG demand through the BOM into raw-material & packaging requirements, then into purchase orders." },
  { group: "Planning & MRP", term: "Lead Time", def: "Time from ordering to availability. FG production ≤ 1 week; RMPM supplier 14 days to 1 month depending on supplier SLA." },
  { group: "Planning & MRP", term: "MOQ — Minimum Order Quantity", def: "Minimum production/purchase lot size (to be completed in master data)." },
  { group: "Planning & MRP", term: "PO Incoming / Outstanding", def: "Purchase order quantity ordered but not yet received — the incoming supply pipeline.", formula: "outstanding = ordered − received" },
  { group: "Planning & MRP", term: "MO WIP", def: "Components tied up in Manufacturing Orders that are not yet Done (work in progress). Their RMPM is still counted in stock." },
  { group: "Planning & MRP", term: "Stock Position", def: "Total material availability per item.", formula: "position = SOH + PO incoming + MO WIP" },
  { group: "Planning & MRP", term: "Consignment / Daily supply", def: "Materials whose supply is assured — consignment stock held in the warehouse (not yet in Odoo) or delivered daily (e.g. VG, PG). MRP treats them as always available: net requirement = 0, never flagged to order." },

  // ---------- General ----------
  { group: "General", term: "FG / SFG / RMPM", def: "Finished Goods · Semi-Finished Goods · Raw Material & Packaging Material." },
  { group: "General", term: "BOM — Bill of Materials", def: "The recipe: which components (and quantities) make up each finished good." },
  { group: "General", term: "Continue vs Discontinued", def: "Product status. Only Continue (active) SKUs are in scope for demand & forecast." },
  { group: "General", term: "Open PO", def: "Purchase orders not yet fully received." },
  { group: "General", term: "OTIF", def: "On Time In Full — a supplier/delivery performance measure." },
  { group: "General", term: "SKU", def: "Stock Keeping Unit — a uniquely identified sellable product." },
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
        <div className="page-sub">Definitions of the metrics & terms used across the dashboard</div>
      </div>

      <input
        className="gloss-search"
        placeholder="Search a term or definition…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

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
