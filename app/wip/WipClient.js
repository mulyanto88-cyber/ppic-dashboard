"use client";
import { useState, useMemo } from "react";
import { fmt } from "../../lib/format";
import Pager from "../Pager";

const PER_PAGE = 25;

const STATUS_BADGE = {
  Critical: "declining",
  "Below Min": "stable",
  OK: "growing",
};

export default function WipClient({ rows, kpi }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.component.toLowerCase().includes(q));
  }, [rows, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = filtered.slice(cur * PER_PAGE, cur * PER_PAGE + PER_PAGE);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">WIP Monitoring</h1>
          <div className="page-sub">
            Manufacturing Order — components currently being consumed on the shop floor
            {kpi.snapshotDate && <> · snapshot {kpi.snapshotDate}</>}
          </div>
        </div>
        <a className="btn-export" href="/api/export?view=mo_wip">↓ Export CSV</a>
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon accent">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <div className="kpi-label">WIP Components</div>
            <div className="kpi-value">{fmt(kpi.componentCount)}</div>
            <div className="kpi-sub">active on shop floor</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>
          </div>
          <div>
            <div className="kpi-label">Total WIP Qty</div>
            <div className="kpi-value">{fmt(kpi.totalWip)}</div>
            <div className="kpi-sub">units in process</div>
          </div>
        </div>
        <div className="card kpi-card" style={{ borderColor: kpi.criticalCount > 0 ? "var(--red)" : undefined }}>
          <div className="kpi-icon red" style={{ background: kpi.criticalCount > 0 ? "var(--red-soft)" : undefined, color: kpi.criticalCount > 0 ? "var(--red)" : "var(--green)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <div className="kpi-label">MRP Critical</div>
            <div className="kpi-value" style={{ color: kpi.criticalCount > 0 ? "var(--red)" : "var(--green)" }}>{kpi.criticalCount}</div>
            <div className="kpi-sub">components below cover threshold</div>
          </div>
        </div>
        <div className="card kpi-card" style={{ borderColor: kpi.belowMinCount > 0 ? "var(--amber)" : undefined }}>
          <div className="kpi-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
          </div>
          <div>
            <div className="kpi-label">Below Min</div>
            <div className="kpi-value">{kpi.belowMinCount}</div>
            <div className="kpi-sub">approaching cover threshold</div>
          </div>
        </div>
      </section>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 className="card-title" style={{ margin: 0 }}>WIP Components</h2>
          <input
            type="text"
            placeholder="Search component…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            style={{
              padding: "8px 12px", fontSize: "13px", borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--panel)",
              color: "var(--text)", width: 240,
            }}
          />
        </div>
        <div className="card-note">
          Components pulled from active Manufacturing Orders (non-Done) in Odoo · enriched with MRP coverage status
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Component</th>
                <th>Vendor</th>
                <th className="num">WIP Qty</th>
                <th className="num">Weekly Consumption</th>
                <th className="num">Total Position</th>
                <th className="num">Weeks Cover</th>
                <th>MRP Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={i}>
                  <td className="num" style={{ color: "var(--muted)" }}>{cur * PER_PAGE + i + 1}</td>
                  <td className="name">{r.component}</td>
                  <td style={{ color: "var(--muted)" }}>{r.vendor}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmt(r.wip_qty)}</td>
                  <td className="num">{r.weekly_consumption != null ? fmt(r.weekly_consumption) : "—"}</td>
                  <td className="num">{r.total_position != null ? fmt(r.total_position) : "—"}</td>
                  <td className="num" style={{
                    color: r.weeks_cover != null && r.weeks_cover < 1 ? "var(--red)"
                         : r.weeks_cover != null && r.weeks_cover < 2 ? "var(--amber)" : undefined
                  }}>
                    {r.weeks_cover != null ? r.weeks_cover : "—"}
                  </td>
                  <td>
                    {r.mrp_status ? (
                      <span className={"badge " + (STATUS_BADGE[r.mrp_status] || "na")}>{r.mrp_status}</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
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
