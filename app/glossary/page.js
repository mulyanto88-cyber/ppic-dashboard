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
  { group: "Demand", term: "Trend / Momentum", tag: "3 vs 9 mo", def: "Recent 3-month run-rate vs the prior 9 months. Growing / Stable / Declining (±20%). Flags rising or fading SKUs early — even those that still sell every month.", formula: "recent-3mo avg vs prior-9mo avg · ±20%" },
  { group: "Demand", term: "Payday Pattern", tag: "seasonality", def: "Sales concentration across the week-of-month. Payday from the 25th drives an end-of-month demand spike — factored into weekly safety stock." },

  // ---------- Forecast ----------
  { group: "Forecast", term: "WMA — Weighted Moving Average", tag: "default model", def: "The locked default forecast model. Weights the last three months, emphasizing the most recent to capture momentum.", formula: "forecast = 0.6·(M-1) + 0.3·(M-2) + 0.1·(M-3)" },
  { group: "Forecast", term: "MAPE", tag: "error", def: "Mean Absolute Percentage Error — average of |forecast − actual| ÷ actual. Simple MAPE is distorted by tiny SKUs, so we rely on wMAPE." },
  { group: "Forecast", term: "wMAPE (volume-weighted)", tag: "KPI", def: "Volume-weighted MAPE — the reliable accuracy metric, weighting SKUs by how much they matter. Forecast Accuracy = 100 − wMAPE. Target ≥ 80%.", formula: "Forecast Accuracy = 100 − wMAPE" },
  { group: "Forecast", term: "Backtest", tag: "validation", def: "Testing a method on past periods where the actual is already known, to judge accuracy objectively rather than by eye." },

  // ---------- Inventory Health ----------
  { group: "Inventory", term: "SOH — Stock on Hand", def: "Physical units available in stock (finished-goods warehouses)." },
  { group: "Inventory", term: "DOI — Days of Inventory", tag: "coverage", def: "How many days current stock will last.", formula: "DOI = SOH ÷ average daily demand" },
  { group: "Inventory", term: "Weeks of Cover", tag: "coverage", def: "Same idea at weekly grain, for the weekly MPS cadence. Critical < 1 week (below production lead time), Below Min < 30 days.", formula: "SOH ÷ weekly demand run-rate" },
  { group: "Inventory", term: "Safety / Minimum Stock", tag: "policy", def: "Target buffer to absorb variability.", formula: "FG = 30 days · RMPM = 45 days" },
  { group: "Inventory", term: "Slow / Dead Stock", def: "SKUs holding stock but with Slow or Dead velocity — capital tied up, obsolescence risk." },
  { group: "Inventory", term: "Inventory Value (est.)", def: "Estimated value = SOH × average sales price. It is a retail-value estimate; will be replaced by cost/HPP when available." },

  // ---------- Planning & MRP ----------
  { group: "Planning & MRP", term: "Net Requirement", tag: "MRP", def: "What actually needs to be produced or ordered.", formula: "Net = SOH + incoming (open PO) + WIP − demand" },
  { group: "Planning & MRP", term: "MPS — Master Production Schedule", def: "The weekly finished-goods production plan derived from demand vs stock." },
  { group: "Planning & MRP", term: "MRP — Material Requirements Planning", def: "Explodes FG demand through the BOM into raw-material & packaging requirements, then into purchase orders." },
  { group: "Planning & MRP", term: "Lead Time", def: "Time from ordering to availability. FG production ≤ 1 week; RMPM supplier 14 days to 1 month depending on supplier SLA." },
  { group: "Planning & MRP", term: "MOQ — Minimum Order Quantity", def: "Minimum production/purchase lot size (to be completed in master data)." },
  { group: "Planning & MRP", term: "PO Incoming / Outstanding", def: "Purchase order quantity ordered but not yet received — the incoming supply pipeline.", formula: "outstanding = ordered − received" },
  { group: "Planning & MRP", term: "MO WIP", def: "Components tied up in Manufacturing Orders that are not yet Done (work in progress). Their RMPM is still counted in stock." },
  { group: "Planning & MRP", term: "Stock Position", def: "Total material availability per item.", formula: "position = SOH + PO incoming + MO WIP" },

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
