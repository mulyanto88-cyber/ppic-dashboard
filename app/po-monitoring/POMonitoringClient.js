"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { fmt, rp } from "../../lib/format";
import Pager from "../Pager";

const IconClock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const IconAlertCircle = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;
const IconCheckCircle = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;

function outDisp(r) {
  if (r.uom === "g" && r.outstanding_kg != null) return fmt(r.outstanding_kg) + " kg";
  return fmt(r.outstanding_qty) + (r.uom ? " " + r.uom : "");
}

export default function POMonitoringClient({ initialLines, initialKpi, initialVendors }) {
  const [search, setSearch] = useState("");
  const [tabFilter, setTabFilter] = useState("ALL"); // ALL | EXPEDITE | STALE | IMPORT | LOCAL
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState("expected_date");
  const [sortOrder, setSortOrder] = useState("asc");

  const PER = 25;

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder(key === "expected_date" ? "asc" : "desc");
    }
    setPage(0);
  };

  const sortInd = (key) => {
    if (sortKey !== key) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  const cleanLines = useMemo(() => {
    return initialLines.map(r => {
      const isOverdue = r.days_past_expected != null && Number(r.days_past_expected) > 0;
      const vUpper = String(r.vendor || "").toUpperCase();
      const isImport = vUpper.includes("JWEI") || vUpper.includes("TRIMS") || vUpper.includes("SMOORE") || vUpper.includes("YOUTAI") || vUpper.includes("SKILLMATE") || vUpper.includes("ALD") || vUpper.includes("VOZOL") || vUpper.includes("CO. LTD") || vUpper.includes("LIMITED");
      return {
        ...r,
        isOverdue,
        isImport
      };
    });
  }, [initialLines]);

  // Filtered rows
  const filteredLines = useMemo(() => {
    return cleanLines.filter((r) => {
      const text = (r.order_reference || "") + " " + (r.vendor || "") + " " + (r.product || "");
      const matchSearch = text.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      if (tabFilter === "EXPEDITE") return r.action === "Expedite" || r.isOverdue;
      if (tabFilter === "STALE") return r.action === "Stale";
      if (tabFilter === "IMPORT") return r.isImport;
      if (tabFilter === "LOCAL") return !r.isImport;
      return true;
    });
  }, [cleanLines, search, tabFilter]);

  // Sorted rows
  const sortedLines = useMemo(() => {
    const list = [...filteredLines];
    list.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (valA == null && valB == null) return 0;
      if (valA == null) return sortOrder === "asc" ? 1 : -1;
      if (valB == null) return sortOrder === "asc" ? -1 : 1;

      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortOrder === "asc" ? numA - numB : numB - numA;
      }

      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredLines, sortKey, sortOrder]);

  const pages = Math.max(1, Math.ceil(sortedLines.length / PER));
  const curPage = Math.min(page, pages - 1);
  const pageRows = sortedLines.slice(curPage * PER, curPage * PER + PER);

  // Dynamic summary cards for the filtered view
  const currentTotalVal = useMemo(() => {
    return filteredLines.reduce((s, r) => s + (Number(r.outstanding_value_idr) || 0), 0);
  }, [filteredLines]);

  const currentOverdueCount = useMemo(() => {
    return filteredLines.filter(r => r.isOverdue).length;
  }, [filteredLines]);

  const fmtDate = (isoStr) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    return d.toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "bold" }}>Total Outstanding Value (Current Filter)</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "var(--accent)", marginTop: "4px" }}>
              {rp(currentTotalVal)}
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>Value of all open lines in the active list</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "bold" }}>Overdue Shipments</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: currentOverdueCount > 0 ? "var(--red)" : "var(--green)", marginTop: "4px" }}>
              {currentOverdueCount} lines
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>Expected delivery date has already passed</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "bold" }}>Open lines in filter</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "var(--text)", marginTop: "4px" }}>
              {filteredLines.length} lines
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>Purchase order lines currently shown</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="gloss-filter-row" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div className="search-box" style={{ position: "relative", flex: 1, minWidth: "240px" }}>
            <span className="search-icon" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>🔍</span>
            <input
              type="text"
              className="input-search"
              placeholder="Search PO reference, vendor, or product..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ width: "100%", padding: "10px 10px 10px 35px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>
          <div className="gloss-tabs" style={{ margin: 0 }}>
            <button className={"gloss-pill" + (tabFilter === "ALL" ? " active" : "")} onClick={() => { setTabFilter("ALL"); setPage(0); }}>All Open ({cleanLines.length})</button>
            <button className={"gloss-pill declining" + (tabFilter === "EXPEDITE" ? " active" : "")} onClick={() => { setTabFilter("EXPEDITE"); setPage(0); }}>🚨 Expedite ({cleanLines.filter(r => r.action === "Expedite" || r.isOverdue).length})</button>
            <button className={"gloss-pill warning" + (tabFilter === "STALE" ? " active" : "")} onClick={() => { setTabFilter("STALE"); setPage(0); }}>⏳ Stale ({cleanLines.filter(r => r.action === "Stale").length})</button>
            <button className={"gloss-pill method" + (tabFilter === "IMPORT" ? " active" : "")} onClick={() => { setTabFilter("IMPORT"); setPage(0); }}>✈️ Import ({cleanLines.filter(r => r.isImport).length})</button>
            <button className={"gloss-pill growing" + (tabFilter === "LOCAL" ? " active" : "")} onClick={() => { setTabFilter("LOCAL"); setPage(0); }}>🏡 Local ({cleanLines.filter(r => !r.isImport).length})</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h2 className="card-title" style={{ margin: 0 }}>Outstanding Purchase Order Lines</h2>
          <div className="card-note" style={{ margin: 0 }}>
            Showing {curPage * PER + 1}–{Math.min(filteredLines.length, curPage * PER + PER)} of {fmt(filteredLines.length)} lines
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => handleSort("order_reference")} style={{ cursor: "pointer", userSelect: "none" }}>PO Ref{sortInd("order_reference")}</th>
                <th onClick={() => handleSort("vendor")} style={{ cursor: "pointer", userSelect: "none" }}>Vendor{sortInd("vendor")}</th>
                <th onClick={() => handleSort("product")} style={{ cursor: "pointer", userSelect: "none" }}>Product{sortInd("product")}</th>
                <th className="num" onClick={() => handleSort("qty")} style={{ cursor: "pointer", userSelect: "none" }}>Ordered{sortInd("qty")}</th>
                <th className="num" onClick={() => handleSort("outstanding_qty")} style={{ cursor: "pointer", userSelect: "none" }}>Outstanding{sortInd("outstanding_qty")}</th>
                <th className="num" onClick={() => handleSort("outstanding_value_idr")} style={{ cursor: "pointer", userSelect: "none" }}>Value (IDR){sortInd("outstanding_value_idr")}</th>
                <th onClick={() => handleSort("order_date")} style={{ cursor: "pointer", userSelect: "none" }}>Order Date{sortInd("order_date")}</th>
                <th onClick={() => handleSort("expected_date")} style={{ cursor: "pointer", userSelect: "none" }}>ETA (Expected){sortInd("expected_date")}</th>
                <th className="num" onClick={() => handleSort("pct_received")} style={{ cursor: "pointer", userSelect: "none" }}>% Received{sortInd("pct_received")}</th>
                <th>Action Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={i} style={r.isOverdue ? { background: "rgba(220, 53, 69, 0.03)" } : r.action === "Stale" ? { background: "rgba(255, 193, 7, 0.02)" } : {}}>
                  <td style={{ fontWeight: 600 }}>
                    {r.order_reference}
                    {r.po_status === "draft" && (
                      <span className="badge stable" style={{ marginLeft: 6, fontSize: 9.5 }} title="RFQ / Draft di Odoo — order berjalan, belum dikonfirmasi">Draft</span>
                    )}
                  </td>
                  <td className="name">{r.vendor}</td>
                  <td className="name">
                    {r.in_bom ? (
                      <Link href={`/deep-dive?sku=${encodeURIComponent(r.product_key)}`} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: "bold" }}>
                        {r.product}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--text)" }}>{r.product}</span>
                    )}
                  </td>
                  <td className="num">{fmt(r.qty)}{r.uom ? " " + r.uom : ""}</td>
                  <td className="num" style={{ fontWeight: "bold" }}>{outDisp(r)}</td>
                  <td className="num" style={{ color: "var(--muted)" }}>{r.outstanding_value_idr > 0 ? rp(r.outstanding_value_idr) : "—"}</td>
                  <td>{fmtDate(r.order_date)}</td>
                  <td style={{ color: r.isOverdue ? "var(--red)" : "var(--text)", fontWeight: r.isOverdue ? "bold" : "normal" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {r.isOverdue && <span>⚠️</span>}
                      {fmtDate(r.expected_date)}
                    </div>
                  </td>
                  <td className="num">
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                      <span style={{ color: Number(r.pct_received) >= 80 ? "var(--green)" : Number(r.pct_received) > 0 ? "var(--amber)" : "var(--red)", fontWeight: "bold" }}>
                        {r.pct_received == null ? "0%" : r.pct_received + "%"}
                      </span>
                      <div style={{ width: "60px", height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ width: `${r.pct_received || 0}%`, height: "100%", background: Number(r.pct_received) >= 80 ? "var(--green)" : Number(r.pct_received) > 0 ? "var(--amber)" : "var(--red)" }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    {r.action === "Expedite" ? (
                      <span className="badge declining" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <IconClock /> Expedite
                      </span>
                    ) : r.action === "Stale" ? (
                      <span className="badge warning" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <IconAlertCircle /> Stale PO
                      </span>
                    ) : r.action === "Almost Done" ? (
                      <span className="badge growing" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <IconCheckCircle /> Almost Done
                      </span>
                    ) : (
                      <span className="badge growing">Monitor</span>
                    )}
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "var(--muted)", padding: "3rem" }}>
                    No purchase orders match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={curPage} pages={pages} total={filteredLines.length} perPage={PER} onPage={setPage} />
      </div>
    </>
  );
}
