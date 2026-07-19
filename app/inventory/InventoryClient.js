"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { fmt, rp } from "../../lib/format";
import Pager from "../Pager";

const COVER_BADGE = {
  Critical: "declining",
  "Below Min": "stable",
  Healthy: "growing",
  Overstock: "na",
};

const IconDollarSign = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const IconLayers = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>;
const IconAlertTriangle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
const IconTrendingDown = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>;
const IconShoppingCart = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>;

const TABS = ["Finished Goods (FG)", "Raw Materials & Packaging (RMPM)"];
const PER_PAGE = 25;

export default function InventoryClient({ kpi, byMove, cover, inv, stockPosition, productMaster, skuValue }) {
  const [activeTab, setActiveTab] = useState("Finished Goods (FG)");
  
  // Map productMaster status
  const fgMasterMap = useMemo(() => {
    const m = {};
    for (const p of productMaster) m[p.sku_name] = p.status;
    return m;
  }, [productMaster]);

  // Map skuValue prices
  const priceMap = useMemo(() => {
    const m = {};
    for (const p of skuValue || []) m[p.sku_name] = Number(p.avg_price_idr) || 0;
    return m;
  }, [skuValue]);

  // separate stockPosition FG into Continue and Discontinued
  const fgStocks = useMemo(() => {
    const cont = [];
    const disc = [];
    const fgs = stockPosition.filter(r => r.item_type === "FG" && Number(r.soh) > 0);
    for (const r of fgs) {
      const status = fgMasterMap[r.product];
      if (status === "Discontinued") {
        disc.push({ ...r, val_est: (Number(r.soh) || 0) * (priceMap[r.product] || 0) });
      } else {
        cont.push(r);
      }
    }
    return { cont, disc };
  }, [stockPosition, fgMasterMap, priceMap]);

  const discontinuedValue = useMemo(() => {
    return fgStocks.disc.reduce((s, r) => s + r.val_est, 0);
  }, [fgStocks.disc]);

  // FG states
  const statusOrder = ["Critical", "Below Min", "Healthy", "Overstock"];
  const statusCount = useMemo(() => {
    const m = {};
    for (const r of cover) {
      if (r.cover_status) m[r.cover_status] = (m[r.cover_status] || 0) + 1;
    }
    return m;
  }, [cover]);

  const atRisk = useMemo(() => {
    return cover
      .filter((r) => r.cover_status === "Critical" || r.cover_status === "Below Min")
      .sort((x, y) => Number(y.wk_run_rate || 0) - Number(x.wk_run_rate || 0))
      .slice(0, 15);
  }, [cover]);

  const slowDead = useMemo(() => {
    return inv
      .filter((r) => (r.movement_class === "Slow" || r.movement_class === "Dead") && Number(r.soh_qty) > 0)
      .slice(0, 15);
  }, [inv]);

  const slowDeadValue = useMemo(() => {
    return inv
      .filter((r) => r.movement_class === "Slow" || r.movement_class === "Dead")
      .reduce((s, r) => s + Number(r.soh_value_est || 0), 0);
  }, [inv]);

  const turns = useMemo(() => {
    const totalQty12m = inv.reduce((s, r) => s + (Number(r.qty_12m) || 0), 0);
    const totalSoh = inv.reduce((s, r) => s + (Number(r.soh_qty) || 0), 0);
    if (!totalQty12m || !totalSoh) return null;
    return Math.round((totalQty12m / totalSoh) * 10) / 10;
  }, [inv]);

  // FG Search, Filter & Sort states
  const [fgSearch, setFgSearch] = useState("");
  const [fgStatusFilter, setFgStatusFilter] = useState("ALL");
  const [fgAbcFilter, setFgAbcFilter] = useState("ALL");
  const [fgPage, setFgPage] = useState(0);
  const [fgSortKey, setFgSortKey] = useState("soh_qty");
  const [fgSortOrder, setFgSortOrder] = useState("desc");

  const fgInventoryList = useMemo(() => {
    const coverMap = {};
    for (const c of cover) coverMap[c.sku_name] = c;
    return inv.map(item => ({
      ...item,
      weeks_cover: coverMap[item.sku_name]?.weeks_of_cover,
      cover_status: coverMap[item.sku_name]?.cover_status || "OK"
    }));
  }, [inv, cover]);

  const filteredFg = useMemo(() => {
    return fgInventoryList.filter((r) => {
      const nameMatch = (r.sku_name || "").toLowerCase().includes(fgSearch.toLowerCase()) ||
                        (r.type || "").toLowerCase().includes(fgSearch.toLowerCase());
      if (!nameMatch) return false;
      if (fgStatusFilter !== "ALL" && r.cover_status !== fgStatusFilter) return false;
      if (fgAbcFilter !== "ALL" && r.abc_tier !== fgAbcFilter) return false;
      return true;
    });
  }, [fgInventoryList, fgSearch, fgStatusFilter, fgAbcFilter]);

  const sortedFg = useMemo(() => {
    const list = [...filteredFg];
    list.sort((a, b) => {
      let valA = a[fgSortKey];
      let valB = b[fgSortKey];
      if (valA == null && valB == null) return 0;
      if (valA == null) return fgSortOrder === "asc" ? 1 : -1;
      if (valB == null) return fgSortOrder === "asc" ? -1 : 1;
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return fgSortOrder === "asc" ? numA - numB : numB - numA;
      }
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      if (valA < valB) return fgSortOrder === "asc" ? -1 : 1;
      if (valA > valB) return fgSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredFg, fgSortKey, fgSortOrder]);

  const fgPages = Math.max(1, Math.ceil(sortedFg.length / PER_PAGE));
  const curFgPage = Math.min(fgPage, fgPages - 1);
  const fgPageRows = useMemo(() => {
    return sortedFg.slice(curFgPage * PER_PAGE, curFgPage * PER_PAGE + PER_PAGE);
  }, [sortedFg, curFgPage]);

  const handleFgSort = (key) => {
    if (fgSortKey === key) {
      setFgSortOrder(fgSortOrder === "asc" ? "desc" : "asc");
    } else {
      setFgSortKey(key);
      setFgSortOrder("desc");
    }
    setFgPage(0);
  };

  // RMPM states
  const [rmpmSearch, setRmpmSearch] = useState("");
  const [showNegativeOnly, setShowNegativeOnly] = useState(false);
  const [rmpmPage, setRmpmPage] = useState(0);

  const rmpmList = useMemo(() => {
    return stockPosition.filter((r) => r.item_type === "RMPM/Other");
  }, [stockPosition]);

  const filteredRmpm = useMemo(() => {
    let list = rmpmList;
    if (showNegativeOnly) {
      list = list.filter(r => Number(r.soh) < 0);
    }
    const q = rmpmSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter((r) => (r.product || "").toLowerCase().includes(q));
  }, [rmpmList, rmpmSearch, showNegativeOnly]);

  const rmpmKPI = useMemo(() => {
    const activeRmpm = rmpmList.filter(r => Number(r.soh) !== 0 || Number(r.po_incoming) !== 0);
    // Convert gram values to kg equivalent for global KPI summing
    const totalSoh = rmpmList.reduce((s, r) => {
      const isG = r.uom === "g";
      return s + (Number(r.soh || 0) / (isG ? 1000 : 1));
    }, 0);
    const totalPO = rmpmList.reduce((s, r) => {
      const isG = r.uom === "g";
      return s + (Number(r.po_incoming || 0) / (isG ? 1000 : 1));
    }, 0);
    const negativeCount = rmpmList.filter(r => Number(r.soh) < 0).length;
    return {
      count: activeRmpm.length,
      totalSoh,
      totalPO,
      negativeCount
    };
  }, [rmpmList]);

  const rmpmPages = Math.max(1, Math.ceil(filteredRmpm.length / PER_PAGE));
  const curRmpmPage = Math.min(rmpmPage, rmpmPages - 1);
  const rmpmPageRows = useMemo(() => {
    return filteredRmpm.slice(curRmpmPage * PER_PAGE, curRmpmPage * PER_PAGE + PER_PAGE);
  }, [filteredRmpm, curRmpmPage]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Inventory Health</h1>
          <div className="page-sub">PPIC Inventory Monitoring · Finished Goods & Materials Position</div>
        </div>
        {activeTab === "Finished Goods (FG)" ? (
          <a className="btn-export" href="/api/export?view=v_inventory_fg">↓ Export FG CSV</a>
        ) : (
          <a className="btn-export" href="/api/export?view=v_stock_position">↓ Export All Stock CSV</a>
        )}
      </div>

      <div className="gloss-tabs">
        {TABS.map((t) => (
          <button key={t} className={"gloss-pill" + (activeTab === t ? " active" : "")} onClick={() => { setActiveTab(t); setRmpmPage(0); }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === "Finished Goods (FG)" && (
        <>
          <div className="note-banner">
            <span className="ic">📊</span>
            <div>
              <b>Cakupan Inventory:</b> Dashboard utama berfokus pada <b>{fmt(fgStocks.cont.length)} SKU Aktif (Continue)</b>. 
              {fgStocks.disc.length > 0 && (
                <> Terdapat <b>{fmt(fgStocks.disc.length)} SKU Discontinued</b> dengan sisa stok sebanyak <b>{fmt(fgStocks.disc.reduce((s, r) => s + Number(r.soh), 0))} unit</b> dengan taksiran nilai <b>{rp(discontinuedValue)}</b> yang mengendap di gudang (lihat tabel cuci gudang di bawah).</>
              )}
            </div>
          </div>

          <section className="kpi-grid">
            <div className="card kpi-card">
              <div className="kpi-icon accent"><IconDollarSign /></div>
              <div>
                <div className="kpi-label">Inventory Value (est.)</div>
                <div className="kpi-value">{rp(kpi.total_value_est)}</div>
                <div className="kpi-sub">{fmt(kpi.total_qty)} units on hand</div>
              </div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-icon green"><IconLayers /></div>
              <div>
                <div className="kpi-label">SKUs with Stock</div>
                <div className="kpi-value">{fmt(kpi.sku_with_stock)}</div>
                <div className="kpi-sub">of {fmt(kpi.sku_count)} active FG</div>
              </div>
            </div>
            <div className="card kpi-card" style={{ borderColor: kpi.stockout_sku > 0 ? "var(--red)" : undefined }}>
              <div className="kpi-icon red" style={{ background: kpi.stockout_sku > 0 ? "var(--red-soft)" : undefined, color: "var(--red)" }}><IconAlertTriangle /></div>
              <div>
                <div className="kpi-label">Stock-out SKUs</div>
                <div className="kpi-value" style={{ color: "var(--red)" }}>{fmt(kpi.stockout_sku)}</div>
                <div className="kpi-sub">zero on hand</div>
              </div>
            </div>
            <div className="card kpi-card" style={{ borderColor: slowDeadValue > 0 ? "var(--amber)" : undefined }}>
              <div className="kpi-icon amber"><IconTrendingDown /></div>
              <div>
                <div className="kpi-label">Slow / Dead Value</div>
                <div className="kpi-value" style={{ color: "var(--amber)" }}>{rp(slowDeadValue)}</div>
                <div className="kpi-sub">capital tied in slow/dead stock</div>
              </div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-icon accent">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div>
                <div className="kpi-label">Inventory Turns</div>
                <div className="kpi-value">{turns != null ? turns + "×" : "—"}</div>
                <div className="kpi-sub">12m sales / avg inventory</div>
              </div>
            </div>
          </section>

          <section className="grid-2">
            <div className="card">
              <h2 className="card-title">Weeks-of-Cover Status</h2>
              <div className="card-note">Critical &lt; 7 d · Below Min &lt; 30 d · Healthy 30–45 d · Overstock &gt; 45 d</div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Status</th><th className="num">SKUs</th></tr></thead>
                  <tbody>
                    {statusOrder.map((s) => (
                      <tr key={s}>
                        <td><span className={"badge " + (COVER_BADGE[s] || "na")}>{s}</span></td>
                        <td className="num">{fmt(statusCount[s] || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">Inventory by Velocity</h2>
              <div className="card-note">SOH & est. value per movement class</div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Class</th><th className="num">SKUs</th><th className="num">SOH</th><th className="num">Est. Value</th><th className="num">Avg DOI</th></tr></thead>
                  <tbody>
                    {byMove.map((m, i) => (
                      <tr key={i}>
                        <td><span className={"badge " + String(m.movement_class || "").toLowerCase()}>{m.movement_class}</span></td>
                        <td className="num">{fmt(m.sku_count)}</td>
                        <td className="num">{fmt(m.soh_qty)}</td>
                        <td className="num">{rp(m.soh_value_est)}</td>
                        <td className="num">{m.avg_doi_days == null ? "—" : m.avg_doi_days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <div className="card">
            <h2 className="card-title">At-Risk — Low Cover, High Demand</h2>
            <div className="card-note">Critical / Below Min, ranked by weekly demand (biggest exposure first)</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th><th>ABC</th><th className="num">SOH</th>
                    <th className="num">Demand/wk</th><th className="num">Weeks Cover</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((r, i) => (
                    <tr key={i}>
                      <td className="name"><Link href={`/deep-dive?sku=${encodeURIComponent(r.sku_name)}`} style={{color:"inherit",textDecoration:"none"}}>{r.sku_name}</Link></td>
                      <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier}</span></td>
                      <td className="num">{fmt(r.soh)}</td>
                      <td className="num">{fmt(r.wk_run_rate)}</td>
                      <td className="num">{r.weeks_of_cover}</td>
                      <td><span className={"badge " + (COVER_BADGE[r.cover_status] || "na")}>{r.cover_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Slow / Dead Stock — Capital Tied Up</h2>
            <div className="card-note">SKUs with stock but Slow/Dead velocity · ranked by est. value</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>SKU</th><th>Type</th><th className="num">SOH</th><th className="num">Est. Value</th><th>Velocity</th><th>Trend</th></tr>
                </thead>
                <tbody>
                  {slowDead.map((r, i) => (
                    <tr key={i}>
                      <td className="name"><Link href={`/deep-dive?sku=${encodeURIComponent(r.sku_name)}`} style={{color:"inherit",textDecoration:"none"}}>{r.sku_name}</Link></td>
                      <td>{r.type}</td>
                      <td className="num">{fmt(r.soh_qty)}</td>
                      <td className="num">{rp(r.soh_value_est)}</td>
                      <td><span className={"badge " + String(r.movement_class || "").toLowerCase()}>{r.movement_class}</span></td>
                      <td>{r.trend ? <span className={"badge " + String(r.trend).toLowerCase()}>{r.trend}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1rem" }}>
            <div className="gloss-filter-row" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h2 className="card-title" style={{ margin: 0 }}>Active FG Stock Inventory & Position ({fmt(filteredFg.length)})</h2>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
                <div className="search-box" style={{ position: "relative", width: "260px" }}>
                  <span className="search-icon" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>🔍</span>
                  <input
                    type="text"
                    className="input-search"
                    placeholder="Search SKU or Type..."
                    value={fgSearch}
                    onChange={(e) => { setFgSearch(e.target.value); setFgPage(0); }}
                    style={{ width: "100%", padding: "6px 10px 6px 35px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "13px" }}
                  />
                </div>
                <div className="gloss-tabs" style={{ margin: 0 }}>
                  <button className={"gloss-pill" + (fgStatusFilter === "ALL" ? " active" : "")} onClick={() => { setFgStatusFilter("ALL"); setFgPage(0); }}>All</button>
                  <button className={"gloss-pill declining" + (fgStatusFilter === "Critical" ? " active" : "")} onClick={() => { setFgStatusFilter("Critical"); setFgPage(0); }}>Critical</button>
                  <button className={"gloss-pill stable" + (fgStatusFilter === "Below Min" ? " active" : "")} onClick={() => { setFgStatusFilter("Below Min"); setFgPage(0); }}>Below Min</button>
                  <button className={"gloss-pill growing" + (fgStatusFilter === "Healthy" ? " active" : "")} onClick={() => { setFgStatusFilter("Healthy"); setFgPage(0); }}>Healthy</button>
                  <button className={"gloss-pill na" + (fgStatusFilter === "Overstock" ? " active" : "")} onClick={() => { setFgStatusFilter("Overstock"); setFgPage(0); }}>Overstock</button>
                </div>
                <div className="gloss-tabs" style={{ margin: 0 }}>
                  <button className={"gloss-pill" + (fgAbcFilter === "ALL" ? " active" : "")} onClick={() => { setFgAbcFilter("ALL"); setFgPage(0); }}>A+B+C</button>
                  <button className={"gloss-pill abc-a" + (fgAbcFilter === "A" ? " active" : "")} onClick={() => { setFgAbcFilter("A"); setFgPage(0); }}>A</button>
                  <button className={"gloss-pill abc-b" + (fgAbcFilter === "B" ? " active" : "")} onClick={() => { setFgAbcFilter("B"); setFgPage(0); }}>B</button>
                  <button className={"gloss-pill abc-c" + (fgAbcFilter === "C" ? " active" : "")} onClick={() => { setFgAbcFilter("C"); setFgPage(0); }}>C</button>
                </div>
              </div>
            </div>
            <div className="card-note">List of active finished goods items, their weeks of cover and DOI · click headers to sort</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th onClick={() => handleFgSort("sku_name")} style={{ cursor: "pointer", userSelect: "none" }}>SKU{fgSortKey === "sku_name" ? (fgSortOrder === "asc" ? " ▲" : " ▼") : ""}</th>
                    <th onClick={() => handleFgSort("type")} style={{ cursor: "pointer", userSelect: "none" }}>Type{fgSortKey === "type" ? (fgSortOrder === "asc" ? " ▲" : " ▼") : ""}</th>
                    <th onClick={() => handleFgSort("abc_tier")} style={{ cursor: "pointer", userSelect: "none" }}>ABC{fgSortKey === "abc_tier" ? (fgSortOrder === "asc" ? " ▲" : " ▼") : ""}</th>
                    <th className="num" onClick={() => handleFgSort("soh_qty")} style={{ cursor: "pointer", userSelect: "none" }}>SOH (pcs){fgSortKey === "soh_qty" ? (fgSortOrder === "asc" ? " ▲" : " ▼") : ""}</th>
                    <th className="num" onClick={() => handleFgSort("soh_value_est")} style={{ cursor: "pointer", userSelect: "none" }}>Est. Value{fgSortKey === "soh_value_est" ? (fgSortOrder === "asc" ? " ▲" : " ▼") : ""}</th>
                    <th className="num" onClick={() => handleFgSort("doi_days")} style={{ cursor: "pointer", userSelect: "none" }}>DOI (days){fgSortKey === "doi_days" ? (fgSortOrder === "asc" ? " ▲" : " ▼") : ""}</th>
                    <th className="num" onClick={() => handleFgSort("weeks_cover")} style={{ cursor: "pointer", userSelect: "none" }}>Weeks Cover{fgSortKey === "weeks_cover" ? (fgSortOrder === "asc" ? " ▲" : " ▼") : ""}</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fgPageRows.map((r, i) => (
                    <tr key={i}>
                      <td className="num" style={{ color: "var(--muted)" }}>{curFgPage * PER_PAGE + i + 1}</td>
                      <td className="name" style={{ fontWeight: 550 }}><Link href={`/deep-dive?sku=${encodeURIComponent(r.sku_name)}`} style={{color:"inherit",textDecoration:"none"}}>{r.sku_name}</Link></td>
                      <td>{r.type}</td>
                      <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier || "—"}</span></td>
                      <td className="num" style={{ fontWeight: 700 }}>{fmt(r.soh_qty)}</td>
                      <td className="num">{rp(r.soh_value_est)}</td>
                      <td className="num">{r.doi_days == null ? "—" : fmt(r.doi_days)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{r.weeks_cover == null ? "—" : r.weeks_cover.toFixed(1)}</td>
                      <td><span className={"badge " + (COVER_BADGE[r.cover_status] || "na")}>{r.cover_status}</span></td>
                    </tr>
                  ))}
                  {filteredFg.length === 0 && (
                    <tr>
                      <td colSpan={9} className="gloss-empty">No active FG SKUs match search criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={curFgPage} pages={fgPages} total={filteredFg.length} perPage={PER_PAGE} onPage={setFgPage} />
          </div>

          {fgStocks.disc.length > 0 && (
            <div className="card">
              <h2 className="card-title" style={{ color: "var(--amber)" }}>Discontinued FG Stock — Clearance Watchlist (Total: {rp(discontinuedValue)})</h2>
              <div className="card-note">SKUs with Discontinued status but still holding physical stock in warehouse · priced using historical average price</div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Discontinued SKU</th>
                      <th className="num">SOH (pcs)</th>
                      <th className="num">Avg Price</th>
                      <th className="num">Est. Value (Trapped)</th>
                      <th className="num">PO Incoming</th>
                      <th className="num">MO WIP</th>
                      <th className="num">Total Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fgStocks.disc.map((r, i) => (
                      <tr key={i}>
                        <td className="num" style={{ color: "var(--muted)" }}>{i + 1}</td>
                        <td className="name" style={{ fontWeight: 550 }}>{r.product}</td>
                        <td className="num" style={{ fontWeight: "700" }}>{fmt(r.soh)}</td>
                        <td className="num">{rp(priceMap[r.product] || 0)}</td>
                        <td className="num" style={{ fontWeight: "700", color: "var(--amber)" }}>{rp(r.val_est)}</td>
                        <td className="num">{fmt(r.po_incoming)}</td>
                        <td className="num">{fmt(r.mo_wip)}</td>
                        <td className="num">{fmt(r.total_position)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "Raw Materials & Packaging (RMPM)" && (
        <>
          <section className="kpi-grid">
            <div className="card kpi-card">
              <div className="kpi-icon accent"><IconLayers /></div>
              <div>
                <div className="kpi-label">Active Materials</div>
                <div className="kpi-value">{fmt(rmpmKPI.count)}</div>
                <div className="kpi-sub">with stock or pipeline</div>
              </div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-icon green"><IconLayers /></div>
              <div>
                <div className="kpi-label">Total SOH Qty (KG-equiv)</div>
                <div className="kpi-value">{fmt(Math.round(rmpmKPI.totalSoh))}</div>
                <div className="kpi-sub">materials in warehouse</div>
              </div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-icon accent"><IconShoppingCart /></div>
              <div>
                <div className="kpi-label">PO Pipeline (KG-equiv)</div>
                <div className="kpi-value">{fmt(Math.round(rmpmKPI.totalPO))}</div>
                <div className="kpi-sub">incoming outstanding qty</div>
              </div>
            </div>
            <div className="card kpi-card" style={{ borderColor: rmpmKPI.negativeCount > 0 ? "var(--red)" : undefined }}>
              <div className="kpi-icon red" style={{ background: rmpmKPI.negativeCount > 0 ? "var(--red-soft)" : undefined, color: "var(--red)" }}><IconAlertTriangle /></div>
              <div>
                <div className="kpi-label">Negative Stock Items</div>
                <div className="kpi-value" style={{ color: rmpmKPI.negativeCount > 0 ? "var(--red)" : "var(--green)" }}>{fmt(rmpmKPI.negativeCount)}</div>
                <div className="kpi-sub">unreconciled Odoo locations</div>
              </div>
            </div>
          </section>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "15px" }}>
              <h2 className="card-title" style={{ margin: 0 }}>Materials Inventory & Position ({fmt(filteredRmpm.length)})</h2>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", color: showNegativeOnly ? "var(--red)" : "var(--text-muted)", fontWeight: showNegativeOnly ? "bold" : "normal" }}>
                  <input
                    type="checkbox"
                    checked={showNegativeOnly}
                    onChange={(e) => { setShowNegativeOnly(e.target.checked); setRmpmPage(0); }}
                    style={{ cursor: "pointer" }}
                  />
                  ⚠ Show Negative Stock Only
                </label>
                <div style={{ position: "relative", width: "300px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position: 'absolute', left: '12px', top: '10px', color: 'var(--muted)'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input
                    className="gloss-search"
                    placeholder="Search material/packaging name…"
                    value={rmpmSearch}
                    onChange={(e) => { setRmpmSearch(e.target.value); setRmpmPage(0); }}
                    style={{ padding: "8px 12px 8px 36px", fontSize: "13px", margin: 0 }}
                  />
                </div>
              </div>
            </div>
            <div className="card-note">Includes raw materials, bottles, cartridges, stickers, boxes and manual books. Items not in FG Master.</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Material Component</th>
                    <th>Satuan</th>
                    <th className="num">Stock on Hand (SOH)</th>
                    <th className="num">PO Incoming</th>
                    <th className="num">MO WIP</th>
                    <th className="num">Total Position</th>
                  </tr>
                </thead>
                <tbody>
                  {rmpmPageRows.map((r, i) => {
                    const isNeg = Number(r.soh) < 0;
                    const isG = r.uom === "g";
                    const displayUom = isG ? "kg" : (r.uom || "—");
                    
                    const formatVal = (v) => {
                      const num = Number(v) || 0;
                      return isG ? (num / 1000).toFixed(1) : fmt(num);
                    };

                    return (
                      <tr key={i} style={isNeg ? { background: "rgba(242,98,111,0.05)" } : undefined}>
                        <td className="num" style={{ color: "var(--muted)" }}>{curRmpmPage * PER_PAGE + i + 1}</td>
                        <td className="name" style={{ fontWeight: isNeg ? "700" : "550" }}>
                          {r.product}
                          {isNeg && <span style={{ marginLeft: "8px", fontSize: "10px", color: "var(--red)", border: "1px solid var(--red)", padding: "1px 5px", borderRadius: "4px", textTransform: "uppercase" }}>Negative</span>}
                        </td>
                        <td><span className="badge method">{displayUom}</span></td>
                        <td className="num" style={{ color: isNeg ? "var(--red)" : "inherit", fontWeight: isNeg ? "700" : "normal" }}>
                          {formatVal(r.soh)}
                        </td>
                        <td className="num">{formatVal(r.po_incoming)}</td>
                        <td className="num">{formatVal(r.mo_wip)}</td>
                        <td className="num" style={{ fontWeight: "700" }}>{formatVal(r.total_position)}</td>
                      </tr>
                    );
                  })}
                  {filteredRmpm.length === 0 && (
                    <tr>
                      <td colSpan={7} className="gloss-empty">No materials match search criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={curRmpmPage} pages={rmpmPages} total={filteredRmpm.length} perPage={PER_PAGE} onPage={setRmpmPage} />
          </div>
        </>
      )}
    </>
  );
}
