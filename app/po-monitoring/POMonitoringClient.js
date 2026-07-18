"use client";
import { useState, useMemo } from "react";
import { fmt, rp } from "../../lib/format";

const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dshort = (dstr) => {
  if (!dstr) return "—";
  const d = new Date(dstr);
  if (isNaN(d)) return dstr;
  return d.getUTCDate() + " " + MON3[d.getUTCMonth()] + " '" + String(d.getUTCFullYear()).slice(2);
};

const ACTION_STYLE = {
  Expedite: { background: "var(--red-soft)", color: "var(--red)" },
  Stale: { background: "var(--amber-soft)", color: "var(--amber)" },
  "Almost Done": { background: "var(--green-soft)", color: "var(--green)" },
  Monitor: { background: "var(--panel-2)", color: "var(--muted)" },
};
const MAT_BADGE = { Critical: "declining", "Below Min": "stable" };

// qty tampil dgn satuan; gram -> kg
function outDisp(r) {
  if (r.uom === "g" && r.outstanding_kg != null) return fmt(r.outstanding_kg) + " kg";
  return fmt(r.outstanding_qty) + (r.uom ? " " + r.uom : "");
}
const ageColor = (d) => (d > 60 ? "var(--red)" : d > 30 ? "var(--amber)" : "var(--muted)");

const IconAlert = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
const IconZap = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
const IconDollar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const IconList = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;

const PER = 25;

export default function POMonitoringClient({ kpi, pipeline, gap, vendors, forceclosed, snapshotDate }) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("ALL");        // ALL | BOM | NONBOM
  const [action, setAction] = useState("ALL");      // ALL | Expedite | Stale | Almost Done | Monitor
  const [page, setPage] = useState(0);
  const [gapPage, setGapPage] = useState(0);

  const expedite = useMemo(() => pipeline.filter((r) => r.action === "Expedite"), [pipeline]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return pipeline.filter((r) => {
      if (scope === "BOM" && !r.in_bom) return false;
      if (scope === "NONBOM" && r.in_bom) return false;
      if (action !== "ALL" && r.action !== action) return false;
      if (!q) return true;
      return (r.product || "").toLowerCase().includes(q) ||
             (r.vendor || "").toLowerCase().includes(q) ||
             (r.order_reference || "").toLowerCase().includes(q);
    });
  }, [pipeline, search, scope, action]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const cur = Math.min(page, pages - 1);
  const pageRows = filtered.slice(cur * PER, cur * PER + PER);

  const gapPages = Math.max(1, Math.ceil(gap.length / PER));
  const curGap = Math.min(gapPage, gapPages - 1);
  const gapRows = gap.slice(curGap * PER, curGap * PER + PER);

  const nonBomCount = useMemo(() => pipeline.filter((r) => !r.in_bom).length, [pipeline]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">PO Monitoring</h1>
          <div className="page-sub">
            source: purchase.order (Odoo){snapshotDate ? " · snapshot " + snapshotDate : ""} · open = status
            &quot;purchase&quot; with outstanding · showing POs from the last 12 months (full history stays in DB)
          </div>
        </div>
        <a className="btn-export" href="/api/export?view=v_po_pipeline">↓ Export CSV</a>
      </div>

      <div className="note-banner">
        <span className="ic">ℹ️</span>
        <div>
          <b>Reading guide.</b> Age = days since the PO was placed (primary lateness measure).
          &quot;Expected&quot; is the internal date auto-filled when the PO was created — an indication, not a vendor
          promise. Scope: <b>supply-chain categories only</b> (RAW MATERIAL · FINISHED GOODS · SFG · CUKAI —
          filtered at ETL). &quot;Non-BOM&quot; ({fmt(nonBomCount)} lines) = materials not in any BOM recipe:
          new items, spare stock, or naming differences.
        </div>
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card" style={{ borderColor: Number(kpi.gap_materials) > 0 ? "var(--red)" : undefined }}>
          <div className={"kpi-icon " + (Number(kpi.gap_materials) > 0 ? "red" : "green")}><IconAlert /></div>
          <div>
            <div className="kpi-label">Critical Without PO</div>
            <div className="kpi-value" style={{ color: Number(kpi.gap_materials) > 0 ? "var(--red)" : "var(--green)" }}>{fmt(kpi.gap_materials)}</div>
            <div className="kpi-sub">materials at risk, nothing on order</div>
          </div>
        </div>
        <div className="card kpi-card" style={{ borderColor: Number(kpi.expedite_lines) > 0 ? "var(--amber)" : undefined }}>
          <div className="kpi-icon amber"><IconZap /></div>
          <div>
            <div className="kpi-label">Expedite Lines</div>
            <div className="kpi-value" style={{ color: "var(--amber)" }}>{fmt(kpi.expedite_lines)}</div>
            <div className="kpi-sub">open POs covering critical materials</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon accent"><IconDollar /></div>
          <div>
            <div className="kpi-label">Outstanding Value</div>
            <div className="kpi-value">{rp(kpi.outstanding_value_idr)}</div>
            <div className="kpi-sub">goods paid-for / committed, not yet received</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon muted"><IconList /></div>
          <div>
            <div className="kpi-label">Open Lines</div>
            <div className="kpi-value">{fmt(kpi.open_lines)}</div>
            <div className="kpi-sub">{fmt(kpi.open_pos)} POs · {fmt(kpi.vendors)} vendors · {fmt(kpi.stale_lines)} stale</div>
          </div>
        </div>
      </section>

      {gap.length > 0 && (
        <div className="card" style={{ borderColor: "var(--red)" }}>
          <h2 className="card-title">⛔ Critical Materials WITHOUT Open PO</h2>
          <div className="card-note">
            at-risk materials with nothing on order — the silent danger · suggested qty respects MOQ ·
            order timing in MRP → 📅 PO Calendar
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Material</th><th>Status</th><th className="num">Cover</th><th className="num">Use/wk</th>
                  <th className="num">Suggested Qty</th><th className="num">LT</th><th>Source</th><th>Default Vendor</th>
                </tr>
              </thead>
              <tbody>
                {gapRows.map((r, i) => (
                  <tr key={i}>
                    <td className="name">{r.component}</td>
                    <td><span className={"badge " + (MAT_BADGE[r.status] || "na")}>{r.status}</span></td>
                    <td className="num" style={{ color: r.status === "Critical" ? "var(--red)" : "var(--amber)" }}>
                      {r.weeks_cover == null ? "—" : r.weeks_cover + " wk"}
                    </td>
                    <td className="num">{r.uom === "g" ? fmt(Math.round(r.weekly_consumption / 1000)) + " kg" : fmt(r.weekly_consumption)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {r.uom === "g" ? (r.net_requirement_kg != null ? fmt(r.net_requirement_kg) + " kg" : "—") : fmt(r.net_requirement)}
                    </td>
                    <td className="num">{r.lead_time_days}d</td>
                    <td><span className={"badge " + (r.source_type === "import" ? "declining" : "method")}>{r.source_type}</span></td>
                    <td className="name">{r.vendor || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {gapPages > 1 && (
            <div className="pager">
              <span className="pager-info">{curGap * PER + 1}–{Math.min(gap.length, curGap * PER + PER)} of {fmt(gap.length)}</span>
              <button className="gloss-pill" disabled={curGap === 0} onClick={() => setGapPage(curGap - 1)}>‹ Prev</button>
              <button className="gloss-pill" disabled={curGap === gapPages - 1} onClick={() => setGapPage(curGap + 1)}>Next ›</button>
            </div>
          )}
        </div>
      )}

      {expedite.length > 0 && (
        <div className="card" style={{ borderColor: "var(--amber)" }}>
          <h2 className="card-title">🚀 Expedite — open POs covering critical materials</h2>
          <div className="card-note">chase these with vendors FIRST — production depends on them</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>PO Ref</th><th>Vendor</th><th>Material</th>
                  <th className="num">Outstanding</th><th className="num">Covers</th>
                  <th className="num">Age</th><th className="num">% Recv</th><th>Material</th>
                </tr>
              </thead>
              <tbody>
                {expedite.slice(0, 25).map((r, i) => (
                  <tr key={i}>
                    <td>{r.order_reference}</td>
                    <td className="name">{r.vendor}</td>
                    <td className="name">{r.product}</td>
                    <td className="num" style={{ fontWeight: 650 }}>{outDisp(r)}</td>
                    <td className="num">{r.covers_weeks == null ? "—" : r.covers_weeks + " wk"}</td>
                    <td className="num" style={{ color: ageColor(Number(r.age_days)) }}>{fmt(r.age_days)}d</td>
                    <td className="num">{r.pct_received == null ? "—" : r.pct_received + "%"}</td>
                    <td><span className={"badge " + (MAT_BADGE[r.material_status] || "na")}>{r.material_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">Vendors — who to call first</h2>
          <div className="card-note">ranked by critical lines, then outstanding value</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Vendor</th><th className="num">Critical</th><th className="num">0% Recv</th><th className="num">Lines</th><th className="num">Value</th><th className="num">Avg Age</th></tr>
              </thead>
              <tbody>
                {vendors.map((v, i) => (
                  <tr key={i}>
                    <td className="name">{v.vendor}</td>
                    <td className="num" style={{ color: Number(v.critical_lines) > 0 ? "var(--red)" : "var(--muted)", fontWeight: Number(v.critical_lines) > 0 ? 700 : 400 }}>
                      {fmt(v.critical_lines)}
                    </td>
                    <td className="num">{fmt(v.zero_received_lines)}</td>
                    <td className="num">{fmt(v.open_lines)}</td>
                    <td className="num">{rp(v.outstanding_value_idr)}</td>
                    <td className="num" style={{ color: ageColor(Number(v.avg_age_days)) }}>{fmt(v.avg_age_days)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Force-closed — unfulfilled by vendor</h2>
          <div className="card-note">POs closed with quantity never delivered · a vendor reliability signal (top 15 by value)</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Vendor</th><th className="num">Lines</th><th className="num">Unfulfilled Value</th><th className="num">Last Case</th></tr>
              </thead>
              <tbody>
                {forceclosed.map((v, i) => (
                  <tr key={i}>
                    <td className="name">{v.vendor}</td>
                    <td className="num">{fmt(v.lines)}</td>
                    <td className="num" style={{ color: "var(--amber)", fontWeight: 600 }}>{rp(v.unfulfilled_value_idr)}</td>
                    <td className="num">{dshort(v.newest_order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "6px" }}>
          <h2 className="card-title" style={{ margin: 0 }}>All Outstanding Lines ({fmt(filtered.length)})</h2>
          <div style={{ position: "relative", width: "280px" }}>
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>🔍</span>
            <input
              className="gloss-search"
              placeholder="Search PO ref / vendor / product…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ padding: "8px 12px 8px 34px", fontSize: "13px", margin: 0 }}
            />
          </div>
        </div>
        <div className="gloss-tabs" style={{ marginBottom: 8 }}>
          <button className={"gloss-pill" + (scope === "ALL" ? " active" : "")} onClick={() => { setScope("ALL"); setPage(0); }}>All scope</button>
          <button className={"gloss-pill" + (scope === "BOM" ? " active" : "")} onClick={() => { setScope("BOM"); setPage(0); }}>BOM materials</button>
          <button className={"gloss-pill" + (scope === "NONBOM" ? " active" : "")} onClick={() => { setScope("NONBOM"); setPage(0); }}>Non-BOM ({fmt(nonBomCount)})</button>
          <span style={{ width: 10 }} />
          {["ALL", "Expedite", "Stale", "Almost Done", "Monitor"].map((a) => (
            <button key={a} className={"gloss-pill" + (action === a ? " active" : "")} onClick={() => { setAction(a); setPage(0); }}>
              {a === "ALL" ? "All actions" : a}
            </button>
          ))}
        </div>
        <div className="card-note">
          sorted: critical materials first, then oldest · gram shown as kg · units differ per line — totals only in value (Rp)
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>PO Ref</th><th>Vendor</th><th>Product</th>
                <th className="num">Outstanding</th><th className="num">Value</th>
                <th className="num">Age</th><th className="num">Expected</th>
                <th className="num">% Recv</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={i}>
                  <td>{r.order_reference}</td>
                  <td className="name">{r.vendor}</td>
                  <td className="name">
                    {r.product}
                    {!r.in_bom && <span className="badge na" style={{ marginLeft: 6, fontSize: 9.5 }}>non-BOM</span>}
                  </td>
                  <td className="num" style={{ fontWeight: 650 }}>{outDisp(r)}</td>
                  <td className="num">{rp(r.outstanding_value_idr)}</td>
                  <td className="num" style={{ color: ageColor(Number(r.age_days)), fontWeight: 600 }}>{fmt(r.age_days)}d</td>
                  <td className="num" style={Number(r.days_past_expected) > 0 ? { color: "var(--amber)" } : {}}
                    title={Number(r.days_past_expected) > 0 ? "past internal expected date by " + fmt(r.days_past_expected) + " days" : undefined}>
                    {dshort(r.expected_date)}
                  </td>
                  <td className="num" style={{ color: Number(r.pct_received) >= 80 ? "var(--green)" : Number(r.pct_received) > 0 ? "var(--amber)" : "var(--red)" }}>
                    {r.pct_received == null ? "—" : r.pct_received + "%"}
                  </td>
                  <td><span className="badge" style={ACTION_STYLE[r.action] || {}}>{r.action}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="gloss-empty">No lines match the filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="pager">
            <span className="pager-info">{cur * PER + 1}–{Math.min(filtered.length, cur * PER + PER)} of {fmt(filtered.length)}</span>
            <button className="gloss-pill" disabled={cur === 0} onClick={() => setPage(cur - 1)}>‹ Prev</button>
            <button className="gloss-pill" disabled={cur === pages - 1} onClick={() => setPage(cur + 1)}>Next ›</button>
          </div>
        )}
      </div>
    </>
  );
}
