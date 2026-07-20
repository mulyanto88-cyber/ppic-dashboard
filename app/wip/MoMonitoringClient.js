"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { fmt } from "../../lib/format";
import Pager from "../Pager";

const PER_PAGE = 25;
const STATE_BADGE = {
  done: "growing",
  confirmed: "method",
  ready: "stable",
  waiting: "na",
};

export default function MoMonitoringClient({ moHeaders, moWip, wipMap, vendorMap, kpi }) {
  const [stateFilter, setStateFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return moHeaders.filter((mo) => {
      const q = search.toLowerCase();
      if (q && !(mo.product || "").toLowerCase().includes(q) && !(mo.mo_reference || "").toLowerCase().includes(q)) return false;
      if (stateFilter !== "ALL" && (mo.state || "").toLowerCase() !== stateFilter.toLowerCase()) return false;
      return true;
    });
  }, [moHeaders, search, stateFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = filtered.slice(cur * PER_PAGE, cur * PER_PAGE + PER_PAGE);

  const states = useMemo(() => {
    const s = new Set(moHeaders.map((m) => m.state).filter(Boolean));
    return [...s].sort();
  }, [moHeaders]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">MO Monitoring</h1>
          <div className="page-sub">
            Manufacturing Orders — shop floor production tracking
            {kpi.snapshotDate && <> · snapshot {kpi.snapshotDate}</>}
          </div>
        </div>
        <a className="btn-export" href="/api/export?view=mo_header">Export CSV</a>
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon accent">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <div className="kpi-label">Active MOs</div>
            <div className="kpi-value" style={{ color: kpi.activeMos > 0 ? "var(--accent)" : "var(--muted)" }}>{fmt(kpi.activeMos)}</div>
            <div className="kpi-sub">in production</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div className="kpi-label">Done MOs</div>
            <div className="kpi-value" style={{ color: "var(--green)" }}>{fmt(kpi.doneMos)}</div>
            <div className="kpi-sub">completed</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/></svg>
          </div>
          <div>
            <div className="kpi-label">Total MOs</div>
            <div className="kpi-value">{fmt(kpi.totalMos)}</div>
            <div className="kpi-sub">all states</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon muted">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div>
            <div className="kpi-label">Planned Qty</div>
            <div className="kpi-value">{fmt(kpi.totalPlanned)}</div>
            <div className="kpi-sub">total units across all MOs</div>
          </div>
        </div>
      </section>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h2 className="card-title" style={{ margin: 0 }}>Manufacturing Orders ({fmt(filtered.length)})</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search product or MO#..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)", width: 200 }}
            />
            <div className="gloss-tabs" style={{ margin: 0 }}>
              <button className={"gloss-pill" + (stateFilter === "ALL" ? " active" : "")} onClick={() => { setStateFilter("ALL"); setPage(0); }}>All</button>
              {states.map((s) => (
                <button key={s} className={"gloss-pill " + (STATE_BADGE[s.toLowerCase()] || "na") + (stateFilter === s ? " active" : "")} onClick={() => { setStateFilter(s); setPage(0); }}>{s}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="card-note">
          Each row = one Manufacturing Order · click Product to open Deep Dive · filter by state to see active/in-progress MOs
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>MO Reference</th>
                <th>Product</th>
                <th>Type</th>
                <th className="num">Planned Qty</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((mo, i) => (
                <tr key={mo.mo_reference}>
                  <td className="num" style={{ color: "var(--muted)" }}>{cur * PER_PAGE + i + 1}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{mo.mo_reference}</td>
                  <td className="name">
                    <Link href={`/deep-dive?sku=${encodeURIComponent(mo.product)}`} style={{ color: "inherit", textDecoration: "none" }}>{mo.product}</Link>
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{mo.product_type || "—"}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{mo.total_planned_qty != null ? fmt(mo.total_planned_qty) : "—"}</td>
                  <td><span className={"badge " + (STATE_BADGE[(mo.state || "").toLowerCase()] || "na")}>{mo.state || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={cur} pages={pages} total={filtered.length} perPage={PER_PAGE} onPage={setPage} />
      </div>
    </>
  );
}
