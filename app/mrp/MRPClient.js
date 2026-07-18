"use client";

import { useState, useMemo, useTransition } from "react";
import { fmt } from "../../lib/format";

const MRP_BADGE = {
  Critical: "declining",
  "Below Min": "stable",
  OK: "growing",
  Consignment: "method",
  Daily: "method"
};

function q(val, uom) {
  if (uom === "g") return fmt(Math.round(Number(val) / 1000)) + " kg";
  return fmt(val) + (uom ? " " + uom : "");
}

// PO Calendar helpers
const BUCKET_STYLE = {
  Overdue: { background: "var(--red-soft)", color: "var(--red)" },
  "This Week": { background: "var(--amber-soft)", color: "var(--amber)" },
  "Next Week": { background: "var(--accent-soft)", color: "var(--accent)" },
};
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dshort = (dstr) => {
  const d = new Date(dstr);
  if (isNaN(d)) return dstr || "—";
  return d.getUTCDate() + " " + MON3[d.getUTCMonth()];
};

export default function MRPClient({ initialRows, kpi, poCalendar = [], updateSupplyModeAction }) {
  const [viewMode, setViewMode] = useState("requirements"); // "requirements" | "calendar"
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState("net_requirement");
  const [sortOrder, setSortOrder] = useState("desc");
  const [editingComp, setEditingComp] = useState(null);
  const [isPending, startTransition] = useTransition();

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
    setPage(0);
  };

  // Filtered rows based on search and status
  const filteredRows = useMemo(() => {
    return initialRows.filter((r) => {
      const nameMatch = (r.component || "").toLowerCase().includes(search.toLowerCase()) ||
                        (r.vendor || "").toLowerCase().includes(search.toLowerCase());
      
      if (!nameMatch) return false;
      if (statusFilter === "ALL") return true;
      if (statusFilter === "CRITICAL") return r.status === "Critical";
      if (statusFilter === "BELOW_MIN") return r.status === "Below Min";
      if (statusFilter === "OK") return r.status === "OK";
      if (statusFilter === "SPECIAL") return r.status === "Consignment" || r.status === "Daily";
      return true;
    });
  }, [initialRows, search, statusFilter]);

  // Sorted rows based on sort key and direction
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      // Handle nulls (push to bottom)
      if (valA == null && valB == null) return 0;
      if (valA == null) return sortOrder === "asc" ? 1 : -1;
      if (valB == null) return sortOrder === "asc" ? -1 : 1;

      // Numeric comparison if both are numbers
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortOrder === "asc" ? numA - numB : numB - numA;
      }

      // String comparison
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRows, sortKey, sortOrder]);

  // Pagination parameters
  const PER = 25;
  const pages = Math.max(1, Math.ceil(sortedRows.length / PER));
  const curPage = Math.min(page, pages - 1);
  const pageRows = sortedRows.slice(curPage * PER, curPage * PER + PER);

  // PO Calendar pagination (urutan sudah by release_in_weeks dari view)
  const [calPage, setCalPage] = useState(0);
  const calPages = Math.max(1, Math.ceil(poCalendar.length / PER));
  const curCalPage = Math.min(calPage, calPages - 1);
  const calPageRows = poCalendar.slice(curCalPage * PER, curCalPage * PER + PER);

  const handleUpdateMode = async (component, newMode) => {
    setEditingComp(component);
    startTransition(async () => {
      const res = await updateSupplyModeAction(component, newMode);
      if (res && !res.success) {
        alert("Failed to update supply mode: " + res.error);
      }
      setEditingComp(null);
    });
  };

  const IconLayers = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>;
  const IconAlertTriangle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
  const IconArrowDownCircle = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 12 16 16 12"></polyline><line x1="12" y1="8" x2="12" y2="16"></line></svg>;
  const IconShoppingCart = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>;

  const sortInd = (key) => {
    if (sortKey !== key) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">MRP — Material Requirements</h1>
          <div className="page-sub">
            {viewMode === "calendar"
              ? "time-phased: WHEN each PO must be released · per-material lead time & safety stock (Material Master) · 8-week horizon"
              : "FG demand × BOM → weekly material consumption vs stock position · per-material target = lead time + safety stock days"}
          </div>
        </div>
        <a className="btn-export" href={viewMode === "calendar" ? "/api/export?view=v_po_calendar" : "/api/export?view=v_mrp"}>↓ Export CSV</a>
      </div>

      <div className="gloss-tabs">
        <button className={"gloss-pill" + (viewMode === "requirements" ? " active" : "")}
          onClick={() => setViewMode("requirements")}>📋 Order Requirements</button>
        <button className={"gloss-pill" + (viewMode === "calendar" ? " active" : "")}
          onClick={() => setViewMode("calendar")}>📅 PO Calendar{poCalendar.length ? ` (${poCalendar.length})` : ""}</button>
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon accent"><IconLayers /></div>
          <div>
            <div className="kpi-label">Materials Planned</div>
            <div className="kpi-value">{fmt(kpi.materials)}</div>
            <div className="kpi-sub">components with demand</div>
          </div>
        </div>
        <div className="card kpi-card" style={{ borderColor: kpi.critical > 0 ? "var(--red)" : undefined }}>
          <div className="kpi-icon red" style={{ background: kpi.critical > 0 ? "var(--red-soft)" : undefined, color: kpi.critical > 0 ? "var(--red)" : "var(--green)" }}><IconAlertTriangle /></div>
          <div>
            <div className="kpi-label">Critical</div>
            <div className="kpi-value" style={{ color: kpi.critical > 0 ? "var(--red)" : "var(--green)" }}>{fmt(kpi.critical)}</div>
            <div className="kpi-sub">cover &lt; lead time (per material)</div>
          </div>
        </div>
        <div className="card kpi-card" style={{ borderColor: kpi.below_min > 0 ? "var(--amber)" : undefined }}>
          <div className="kpi-icon amber"><IconArrowDownCircle /></div>
          <div>
            <div className="kpi-label">Below Min</div>
            <div className="kpi-value" style={{ color: "var(--amber)" }}>{fmt(kpi.below_min)}</div>
            <div className="kpi-sub">cover &lt; lead time + safety days</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon muted"><IconShoppingCart /></div>
          <div>
            <div className="kpi-label">Need to Order</div>
            <div className="kpi-value">{fmt(kpi.need_order)}</div>
            <div className="kpi-sub">net requirement &gt; 0</div>
          </div>
        </div>
      </section>

      {viewMode === "requirements" && (<>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="gloss-filter-row" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div className="search-box" style={{ position: "relative", flex: 1, minWidth: "240px" }}>
            <span className="search-icon" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>🔍</span>
            <input
              type="text"
              className="input-search"
              placeholder="Search by material or vendor..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ width: "100%", padding: "10px 10px 10px 35px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>
          <div className="gloss-tabs" style={{ margin: 0 }}>
            <button className={"gloss-pill" + (statusFilter === "ALL" ? " active" : "")} onClick={() => { setStatusFilter("ALL"); setPage(0); }}>All ({sortedRows.length})</button>
            <button className={"gloss-pill declining" + (statusFilter === "CRITICAL" ? " active" : "")} onClick={() => { setStatusFilter("CRITICAL"); setPage(0); }}>Critical</button>
            <button className={"gloss-pill stable" + (statusFilter === "BELOW_MIN" ? " active" : "")} onClick={() => { setStatusFilter("BELOW_MIN"); setPage(0); }}>Below Min</button>
            <button className={"gloss-pill growing" + (statusFilter === "OK" ? " active" : "")} onClick={() => { setStatusFilter("OK"); setPage(0); }}>OK</button>
            <button className={"gloss-pill method" + (statusFilter === "SPECIAL" ? " active" : "")} onClick={() => { setStatusFilter("SPECIAL"); setPage(0); }}>Consignment/Daily</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Material Requirements — Order Priority</h2>
        <div className="card-note">
          net requirement = (lead time + safety days) target − stock position (SOH + PO incoming + MO WIP), min MOQ · per-material params from Material Master · gram shown as kg · click headers to sort · change supply mode via dropdown
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => handleSort("component")} style={{ cursor: "pointer", userSelect: "none" }}>Material{sortInd("component")}</th>
                <th onClick={() => handleSort("vendor")} style={{ cursor: "pointer", userSelect: "none" }}>Vendor{sortInd("vendor")}</th>
                <th className="num" onClick={() => handleSort("weekly_consumption")} style={{ cursor: "pointer", userSelect: "none" }}>Use/wk{sortInd("weekly_consumption")}</th>
                <th className="num" onClick={() => handleSort("soh")} style={{ cursor: "pointer", userSelect: "none" }}>SOH{sortInd("soh")}</th>
                <th className="num" onClick={() => handleSort("po_incoming")} style={{ cursor: "pointer", userSelect: "none" }}>PO In{sortInd("po_incoming")}</th>
                <th className="num" onClick={() => handleSort("mo_wip")} style={{ cursor: "pointer", userSelect: "none" }}>WIP{sortInd("mo_wip")}</th>
                <th className="num" onClick={() => handleSort("total_position")} style={{ cursor: "pointer", userSelect: "none" }}>Position{sortInd("total_position")}</th>
                <th className="num" onClick={() => handleSort("weeks_cover")} style={{ cursor: "pointer", userSelect: "none" }}>Wks Cover{sortInd("weeks_cover")}</th>
                <th className="num" onClick={() => handleSort("net_requirement")} style={{ cursor: "pointer", userSelect: "none" }}>Net Req.{sortInd("net_requirement")}</th>
                <th>Status / Supply Mode</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const lt = Number(r.lead_time_days) || 14;
                const ss = Number(r.safety_stock_days) || 30;
                const limitCritical = lt / 7.0;
                const limitBelowMin = (lt + ss) / 7.0;

                const isEditing = editingComp === r.component;
                const weeklyConsumption = Number(r.weekly_consumption) || 0;
                const sohCover = weeklyConsumption > 0 ? (Number(r.soh) || 0) / weeklyConsumption : Infinity;
                const isSohCritical = sohCover < limitCritical && r.status !== "Consignment" && r.status !== "Daily";

                return (
                  <tr key={i} style={isEditing ? { opacity: 0.5 } : {}}>
                    <td className="name">
                      <div>{r.component}</div>
                      <div style={{ fontSize: "10.5px", color: "var(--muted)", fontWeight: "normal", marginTop: "2px" }}>
                        LT: {lt}d | SS: {ss}d{Number(r.moq) > 0 ? ` | MOQ: ${fmt(r.moq)}` : ""}
                      </div>
                    </td>
                    <td className="name">{r.vendor}</td>
                    <td className="num">{q(r.weekly_consumption, r.uom)}</td>
                    <td className="num">
                      {q(r.soh, r.uom)}
                      {isSohCritical && (
                        <span 
                          title={`Physical SOH cover is only ${sohCover.toFixed(1)} weeks! Expedite incoming POs.`} 
                          style={{ color: "var(--red)", marginLeft: "4px", cursor: "help", fontWeight: "bold" }}
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="num">{q(r.po_incoming, r.uom)}</td>
                    <td className="num">{q(r.mo_wip, r.uom)}</td>
                    <td className="num">{q(r.total_position, r.uom)}</td>
                    <td className="num" style={{ color: Number(r.weeks_cover) < limitCritical ? "var(--red)" : Number(r.weeks_cover) < limitBelowMin ? "var(--amber)" : "var(--green)" }}>
                      {r.weeks_cover == null ? "—" : r.weeks_cover}
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {r.uom === "g" ? (r.net_requirement_kg != null ? fmt(r.net_requirement_kg) + " kg" : "—") : fmt(r.net_requirement)}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span className={"badge " + (MRP_BADGE[r.status] || "na")}>
                          {r.status}
                        </span>
                        
                        <select
                          value={r.supply_mode || "Normal"}
                          onChange={(e) => handleUpdateMode(r.component, e.target.value)}
                          disabled={isEditing || isPending}
                          style={{
                            fontSize: "11px",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            border: "1px solid var(--border)",
                            background: "var(--bg)",
                            color: "var(--text-muted)",
                            cursor: "pointer"
                          }}
                        >
                          <option value="Normal">Normal</option>
                          <option value="Consignment">Consignment</option>
                          <option value="Daily">Daily</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "var(--muted)", padding: "2rem" }}>
                    No materials match the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="pager">
            <span className="pager-info">{curPage * PER + 1}–{Math.min(sortedRows.length, curPage * PER + PER)} of {fmt(sortedRows.length)}</span>
            <button className="gloss-pill" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>‹ Prev</button>
            <button className="gloss-pill" disabled={curPage === pages - 1} onClick={() => setPage(curPage + 1)}>Next ›</button>
          </div>
        )}
      </div>
      </>)}

      {viewMode === "calendar" && (
        <div className="card">
          <h2 className="card-title">PO Release Calendar — next 8 weeks</h2>
          <div className="card-note">
            WHEN each PO must be RELEASED so stock never dips below safety level · release = (week stock hits safety) − lead time ·
            Overdue = should already be on order · suggested qty respects MOQ · gram shown as kg
          </div>
          {poCalendar.length === 0 ? (
            <div className="gloss-empty">No releases due in the next 8 weeks — or run migration 0042 (v_po_calendar) in Supabase.</div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Release</th>
                      <th>Material</th>
                      <th>Vendor</th>
                      <th>Source</th>
                      <th className="num">Use/wk</th>
                      <th className="num">Cover</th>
                      <th className="num">Release Date</th>
                      <th className="num">Arrives ≈</th>
                      <th className="num">Suggested Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calPageRows.map((r, i) => (
                      <tr key={i}>
                        <td><span className="badge" style={BUCKET_STYLE[r.bucket] || {}}>{r.bucket}</span></td>
                        <td className="name">
                          <div>{r.component}</div>
                          <div style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "2px" }}>
                            LT: {r.lead_time_days}d{Number(r.moq) > 0 ? ` | MOQ: ${fmt(r.moq)}` : ""}
                          </div>
                        </td>
                        <td className="name">{r.vendor || "—"}</td>
                        <td><span className={"badge " + (r.source_type === "import" ? "declining" : "method")}>{r.source_type}</span></td>
                        <td className="num">{q(r.weekly_consumption, r.uom)}</td>
                        <td className="num" style={{ color: Number(r.release_in_weeks) < 0 ? "var(--red)" : undefined }}>
                          {r.weeks_cover} wk
                        </td>
                        <td className="num" style={Number(r.release_in_weeks) < 0 ? { color: "var(--red)", fontWeight: 700 } : {}}>
                          {Number(r.release_in_weeks) < 0 ? "NOW" : dshort(r.release_date)}
                        </td>
                        <td className="num">{dshort(r.arrival_date)}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{q(r.suggested_qty, r.uom)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {calPages > 1 && (
                <div className="pager">
                  <span className="pager-info">{curCalPage * PER + 1}–{Math.min(poCalendar.length, curCalPage * PER + PER)} of {fmt(poCalendar.length)}</span>
                  <button className="gloss-pill" disabled={curCalPage === 0} onClick={() => setCalPage(curCalPage - 1)}>‹ Prev</button>
                  <button className="gloss-pill" disabled={curCalPage === calPages - 1} onClick={() => setCalPage(curCalPage + 1)}>Next ›</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
