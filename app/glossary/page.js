export const metadata = { title: "Glossary — PPIC Dashboard" };

const SECTIONS = [
  {
    title: "Segmentation & Classification",
    items: [
      { term: "ABC (by Value)", tag: "Pareto", def: "Classifies SKUs by their 12-month sales value. Tier A = top 80% of cumulative value, B = next 15%, C = the remaining tail. Used to focus planning effort where the money is.", formula: "cumulative value %: A ≤ 80% · B ≤ 95% · C = rest" },
      { term: "ABC (by Quantity)", tag: "Pareto", def: "Same Pareto logic but based on units delivered instead of value." },
      { term: "Category Contribution Tier", tag: "FOOM method", def: "Cumulative contribution ranked within each Product Type. Fast = top SKUs up to 50% of the type's volume, Medium = up to 80%, Slow = the bottom tail.", formula: "cumulative % within Type: Fast ≤ 50% · Medium ≤ 80% · Slow = rest" },
      { term: "Movement / Velocity", tag: "FSN", def: "How often a SKU sells over the last 12 months. Fast = sold in ≥ 10 months, Medium = 5–9, Slow = 1–4, Dead = no sales in 12 months (obsolescence risk).", formula: "months active out of 12: Fast ≥ 10 · Medium 5–9 · Slow 1–4 · Dead 0" },
      { term: "XYZ (Demand Variability)", tag: "forecastability", def: "Coefficient of Variation of monthly demand. X = stable & predictable, Y = moderate, Z = erratic / intermittent. Drives which forecast method fits a SKU.", formula: "CoV = std dev ÷ mean · X < 0.5 · Y 0.5–1.0 · Z > 1.0" },
      { term: "Trend / Momentum", tag: "3 vs 9 mo", def: "Compares the recent 3-month run-rate against the prior 9 months. Growing / Stable / Declining (±20% threshold). Flags rising or fading SKUs early.", formula: "recent-3mo avg vs prior-9mo avg · ±20%" },
    ],
  },
  {
    title: "Forecasting",
    items: [
      { term: "WMA — Weighted Moving Average", tag: "default model", def: "The locked default forecast model. Weights the last three months, emphasizing the most recent to capture momentum.", formula: "forecast = 0.6·(M-1) + 0.3·(M-2) + 0.1·(M-3)" },
      { term: "MAPE", tag: "error", def: "Mean Absolute Percentage Error — the average of |forecast − actual| ÷ actual. Simple MAPE is distorted by tiny SKUs, so we rely on wMAPE." },
      { term: "wMAPE (volume-weighted)", tag: "KPI", def: "Volume-weighted MAPE — the reliable accuracy metric, since it weights SKUs by how much they matter. Forecast Accuracy = 100 − wMAPE. Target ≥ 80%.", formula: "Forecast Accuracy = 100 − wMAPE" },
      { term: "Backtest", tag: "validation", def: "Testing a method on past periods where the actual result is already known, to judge accuracy objectively (not by eyeballing)." },
    ],
  },
  {
    title: "Inventory & Planning",
    items: [
      { term: "SOH — Stock on Hand", def: "Physical units available in stock (FG warehouses; virtual/adjustment/customer locations are excluded)." },
      { term: "DOI — Days of Inventory", tag: "coverage", def: "How many days current stock will last.", formula: "DOI = SOH ÷ average daily demand" },
      { term: "Weeks of Cover", tag: "coverage", def: "Same idea at weekly grain — used for the weekly MPS cadence.", formula: "SOH ÷ weekly demand run-rate" },
      { term: "Safety / Minimum Stock", tag: "policy", def: "Target buffer to absorb demand & supply variability.", formula: "FG = 30 days · RMPM = 45 days" },
      { term: "Lead Time", def: "Time from ordering to availability. FG production ≤ 1 week; RMPM supplier 14 days to 1 month depending on supplier SLA." },
      { term: "MOQ — Minimum Order Quantity", def: "Minimum production/purchase lot size (to be completed in master data)." },
      { term: "Net Requirement", tag: "MRP", def: "What actually needs to be produced or ordered.", formula: "Net = SOH + incoming (open PO) − demand" },
      { term: "MPS — Master Production Schedule", def: "The weekly finished-goods production plan derived from demand vs stock." },
      { term: "MRP — Material Requirements Planning", def: "Explodes FG demand through the BOM into raw-material & packaging requirements, then into purchase orders." },
      { term: "Payday Pattern", def: "Sales concentration across the week-of-month. Payday from the 25th drives an end-of-month demand spike — factored into weekly safety stock." },
    ],
  },
  {
    title: "Terms",
    items: [
      { term: "FG / SFG / RMPM", def: "Finished Goods · Semi-Finished Goods · Raw Material & Packaging Material." },
      { term: "BOM — Bill of Materials", def: "The recipe: which components (and quantities) make up each finished good." },
      { term: "Continue vs Discontinued", def: "Product status. Only Continue (active) SKUs are in scope for demand & forecast." },
      { term: "Open PO", def: "Purchase orders not yet fully received — the incoming supply pipeline." },
      { term: "OTIF", def: "On Time In Full — a supplier/delivery performance measure." },
    ],
  },
];

export default function Glossary() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Glossary</h1>
        <div className="page-sub">Definitions of the metrics & terms used across this dashboard</div>
      </div>

      {SECTIONS.map((sec, i) => (
        <div className="card" key={i}>
          <h2 className="card-title">{sec.title}</h2>
          <div>
            {sec.items.map((it, j) => (
              <div className="gloss-item" key={j}>
                <div>
                  <span className="gloss-term">{it.term}</span>
                  {it.tag && <span className="gloss-tag">· {it.tag}</span>}
                </div>
                <div className="gloss-def">{it.def}</div>
                {it.formula && <div className="gloss-formula">{it.formula}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
