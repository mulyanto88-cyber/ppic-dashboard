"use client";

import { useState, useMemo, useTransition } from "react";
import { fmt, rp, ym } from "../../lib/format";
import SkuPicker from "./SkuPicker";
import { METHODS } from "../../lib/forecast";

const MAT_BADGE = { Critical: "declining", "Below Min": "stable", OK: "growing" };

const IconDollarSign = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const IconPackage = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
const IconTag = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>;
const IconTrendingUp = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;

function Bars({ data, valueKey, labelKey }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="barchart">
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          <div className="bar hl" style={{ height: (Number(d[valueKey]) || 0) / max * 100 + "%", transition: "all 0.2s ease-in-out" }} />
          <div className="bar-label">{d[labelKey]}</div>
        </div>
      ))}
    </div>
  );
}

function parseCSV(text) {
  const lines = [];
  let row = [""];
  lines.push(row);
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',') {
      if (inQuotes) {
        row[row.length - 1] += c;
      } else {
        row.push("");
      }
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && next === '\n') {
        i++;
      }
      if (inQuotes) {
        row[row.length - 1] += '\n';
      } else {
        row = [""];
        lines.push(row);
      }
    } else {
      row[row.length - 1] += c;
    }
  }
  return lines.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

export default function DeepDiveClient({
  skuList,
  currentSku,
  detail,
  productMasterList,
  saveSkuMasterAction,
  deleteSkuMasterAction,
  bulkUploadSkuMasterAction
}) {
  const [activeMode, setActiveMode] = useState("viewer"); // "viewer" | "master"
  const [isPending, startTransition] = useTransition();

  // Master Data Search & Pagination
  const [masterSearch, setMasterSearch] = useState("");
  const [masterPage, setMasterPage] = useState(0);
  const PER_PAGE = 20;

  // Modals / Editor forms
  const [showModal, setShowModal] = useState(false); // add/edit modal
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit"
  const [formData, setFormData] = useState({
    sku_name: "",
    type: "",
    series: "",
    brand: "",
    status: "Continue",
    sub_category: "",
    barcode: "",
    unique_label: ""
  });

  const handleOpenAdd = () => {
    setFormData({
      sku_name: "",
      type: "",
      series: "",
      brand: "",
      status: "Continue",
      sub_category: "",
      barcode: "",
      unique_label: ""
    });
    setModalMode("add");
    setShowModal(true);
  };

  const handleOpenEdit = (sku) => {
    const found = productMasterList.find(p => p.sku_name === sku) || {};
    setFormData({
      sku_name: found.sku_name || sku,
      type: found.type || "",
      series: found.series || "",
      brand: found.brand || "",
      status: found.status || "Continue",
      sub_category: found.sub_category || "",
      barcode: found.barcode || "",
      unique_label: found.unique_label || ""
    });
    setModalMode("edit");
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.sku_name.trim()) {
      alert("SKU Name is required");
      return;
    }

    startTransition(async () => {
      const res = await saveSkuMasterAction(formData.sku_name, formData);
      if (res.success) {
        setShowModal(false);
        // If we edited current SKU, force refresh page view
        if (modalMode === "edit" && formData.sku_name === currentSku) {
          window.location.reload();
        }
      } else {
        alert("Failed to save SKU: " + res.error);
      }
    });
  };

  const handleDelete = async (sku) => {
    if (!confirm(`Are you absolutely sure you want to delete SKU: "${sku}"?\nThis might affect views if sales history exists.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteSkuMasterAction(sku);
      if (res.success) {
        if (sku === currentSku) {
          window.location.href = "/deep-dive";
        }
      } else {
        alert("Failed to delete SKU: " + res.error);
      }
    });
  };

  // Bulk Upload File handler
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const parsedLines = parseCSV(text);
        if (parsedLines.length < 2) {
          alert("CSV is empty or invalid");
          return;
        }

        const headers = parsedLines[0].map(h => h.trim().toLowerCase());
        const skuNameIdx = headers.indexOf("sku_name");
        if (skuNameIdx === -1) {
          alert("Missing required column 'sku_name' in CSV");
          return;
        }

        const typeIdx = headers.indexOf("type");
        const seriesIdx = headers.indexOf("series");
        const brandIdx = headers.indexOf("brand");
        const statusIdx = headers.indexOf("status");
        const subCatIdx = headers.indexOf("sub_category");
        const barcodeIdx = headers.indexOf("barcode");
        const labelIdx = headers.indexOf("unique_label");

        const dataRows = [];
        for (let i = 1; i < parsedLines.length; i++) {
          const row = parsedLines[i];
          if (!row[skuNameIdx]) continue;
          dataRows.push({
            sku_name: row[skuNameIdx],
            type: typeIdx !== -1 ? row[typeIdx] : null,
            series: seriesIdx !== -1 ? row[seriesIdx] : null,
            brand: brandIdx !== -1 ? row[brandIdx] : null,
            status: statusIdx !== -1 ? row[statusIdx] : "Continue",
            sub_category: subCatIdx !== -1 ? row[subCatIdx] : null,
            barcode: barcodeIdx !== -1 ? row[barcodeIdx] : null,
            unique_label: labelIdx !== -1 ? row[labelIdx] : null,
          });
        }

        if (dataRows.length === 0) {
          alert("No records with valid 'sku_name' found.");
          return;
        }

        if (!confirm(`Found ${dataRows.length} SKU records. Perform bulk upsert to database?`)) {
          return;
        }

        startTransition(async () => {
          const res = await bulkUploadSkuMasterAction(dataRows);
          if (res.success) {
            alert(`Successfully uploaded/updated ${res.count} SKUs!`);
            e.target.value = ""; // reset file input
          } else {
            alert("Bulk upload failed: " + res.error);
          }
        });

      } catch (err) {
        alert("Failed to parse CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const downloadCSVTemplate = () => {
    const headers = "sku_name,type,series,brand,status,sub_category,barcode,unique_label\n";
    const sample = "FOOM X CARTRIDGE PACK (3PCS),Cartridge,G5 Series,FOOM,Continue,Cartridge,899000111222,Cartridge G5\n";
    const blob = new Blob([headers + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "sku_master_template.csv");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filtered Master Data list
  const filteredMaster = useMemo(() => {
    return productMasterList.filter(p => {
      return (p.sku_name || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (p.type || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (p.brand || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (p.series || "").toLowerCase().includes(masterSearch.toLowerCase());
    });
  }, [productMasterList, masterSearch]);

  const masterPages = Math.max(1, Math.ceil(filteredMaster.length / PER_PAGE));
  const curMasterPage = Math.min(masterPage, masterPages - 1);
  const masterPageRows = filteredMaster.slice(curMasterPage * PER_PAGE, curMasterPage * PER_PAGE + PER_PAGE);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Deep Dive &amp; Master Data</h1>
          <div className="page-sub">360° view of single SKU &amp; product master repository editor</div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            className={"gloss-pill" + (activeMode === "viewer" ? " active" : "")} 
            onClick={() => setActiveMode("viewer")}
            style={{ padding: "8px 16px", borderRadius: "20px" }}
          >
            📊 SKU Analytics
          </button>
          <button 
            className={"gloss-pill" + (activeMode === "master" ? " active" : "")} 
            onClick={() => setActiveMode("master")}
            style={{ padding: "8px 16px", borderRadius: "20px" }}
          >
            🗂 SKU Master Data
          </button>
        </div>
      </div>

      {activeMode === "viewer" && (
        <>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "100%", marginBottom: "1rem" }}>
            <div style={{ flex: 1 }}><SkuPicker skus={skuList} current={currentSku} /></div>
            {currentSku && (
              <button 
                className="btn-export" 
                onClick={() => handleOpenEdit(currentSku)}
                style={{ height: "45px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}
              >
                ✏️ Edit SKU Master
              </button>
            )}
            <button 
              className="btn-export" 
              onClick={handleOpenAdd}
              style={{ height: "45px", margin: 0, display: "flex", alignItems: "center", gap: "5px", background: "var(--accent)", color: "white" }}
            >
              ➕ Add SKU
            </button>
          </div>

          {!currentSku && (
            <div className="card"><div className="gloss-empty">Search and pick a SKU above to see its full profile.</div></div>
          )}

          {currentSku && detail && (
            <>
              <div className="card">
                <h2 className="card-title">{detail.seg.sku_name || currentSku}</h2>
                <div className="card-note">Type: {detail.seg.type || "—"}</div>
                <div className="dd-badges">
                  {detail.seg.abc_tier && <span className={"badge abc-" + String(detail.seg.abc_tier).toLowerCase()}>ABC-qty {detail.seg.abc_tier}</span>}
                  {detail.val.abc_tier_value && <span className={"badge abc-" + String(detail.val.abc_tier_value).toLowerCase()}>ABC-value {detail.val.abc_tier_value}</span>}
                  {detail.seg.xyz_class && <span className={"badge xyz-" + String(detail.seg.xyz_class).toLowerCase()}>{detail.seg.xyz_class}</span>}
                  {detail.seg.movement_class && <span className={"badge " + String(detail.seg.movement_class).toLowerCase()}>{detail.seg.movement_class}</span>}
                  {detail.seg.trend && <span className={"badge " + String(detail.seg.trend).toLowerCase()}>{detail.seg.trend}</span>}
                </div>
              </div>

              <section className="kpi-grid">
                <div className="card kpi-card">
                  <div className="kpi-icon accent"><IconDollarSign /></div>
                  <div>
                    <div className="kpi-label">Revenue (12 mo)</div>
                    <div className="kpi-value">{rp(detail.val.value_12m)}</div>
                    <div className="kpi-sub">{fmt(detail.seg.qty_12m)} units</div>
                  </div>
                </div>
                <div className="card kpi-card">
                  <div className="kpi-icon green"><IconPackage /></div>
                  <div>
                    <div className="kpi-label">Stock on Hand</div>
                    <div className="kpi-value">{fmt(detail.inv.soh_qty)}</div>
                    <div className="kpi-sub">DOI {detail.inv.doi_days == null ? "—" : detail.inv.doi_days + " d"}</div>
                  </div>
                </div>
                <div className="card kpi-card">
                  <div className="kpi-icon amber"><IconTag /></div>
                  <div>
                    <div className="kpi-label">Avg Price</div>
                    <div className="kpi-value">{rp(detail.val.avg_price_idr)}</div>
                    <div className="kpi-sub">per unit</div>
                  </div>
                </div>
                <div className="card kpi-card">
                  <div className="kpi-icon muted"><IconTrendingUp /></div>
                  <div>
                    <div className="kpi-label">Forecast (next mo)</div>
                    <div className="kpi-value">{detail.fc[0] ? fmt(detail.fc[0].q) : "—"}</div>
                    <div className="kpi-sub">{METHODS[detail.champMethod]?.label || "Forecast Engine"}</div>
                  </div>
                </div>
              </section>

              <section className="grid-2">
                <div className="card">
                  <h2 className="card-title">Monthly Sales</h2>
                  <div className="card-note">last 18 months · units delivered</div>
                  {detail.sales.length ? <Bars data={detail.sales} valueKey="qty_delivered" labelKey="_lbl" />
                    : <div className="gloss-empty">No sales history.</div>}
                </div>
                <div className="card">
                  <h2 className="card-title">Forecast — 3 Months</h2>
                  <div className="card-note">Champion: {METHODS[detail.champMethod]?.label || "WMA"}</div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Month</th><th className="num">Forecast</th></tr></thead>
                      <tbody>
                        {detail.fc.map((r, i) => (
                          <tr key={i}><td>{ym(r.ym)}</td><td className="num">{fmt(r.q)}</td></tr>
                        ))}
                        {detail.fc.length === 0 && <tr><td colSpan={2} style={{ color: "var(--muted)" }}>No forecast.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <div className="card">
                <h2 className="card-title">Bill of Materials</h2>
                <div className="card-note">components per unit · material stock &amp; coverage from warehouse</div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th className="num">Per Unit</th>
                        <th>Satuan</th>
                        <th className="num">Stock on Hand (SOH)</th>
                        <th className="num">PO Incoming</th>
                        <th className="num">Wks Cover</th>
                        <th>Material Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.bom.map((b, i) => {
                        const isG = (b.mat.uom || b.stock.uom) === "g";
                        const displayUom = isG ? "kg" : (b.mat.uom || b.stock.uom || "—");
                        
                        const formatVal = (v) => {
                          if (v == null) return "—";
                          const num = Number(v) || 0;
                          return isG ? (num / 1000).toFixed(1) : fmt(num);
                        };

                        const rawSoh = b.stock.soh ?? b.mat.soh;
                        const rawPO = b.stock.po_incoming ?? b.mat.po_incoming;

                        return (
                          <tr key={i}>
                            <td className="name">{b.component}</td>
                            <td className="num">{b.per_pcs}</td>
                            <td><span className="badge method">{isG ? "g" : displayUom}</span></td>
                            <td className="num">{formatVal(rawSoh)}</td>
                            <td className="num">{formatVal(rawPO)}</td>
                            <td className="num">{b.mat.weeks_cover == null ? "—" : b.mat.weeks_cover}</td>
                            <td>{b.mat.status ? <span className={"badge " + (MAT_BADGE[b.mat.status] || "na")}>{b.mat.status}</span> : <span className="badge na">No Demand</span>}</td>
                          </tr>
                        );
                      })}
                      {detail.bom.length === 0 && <tr><td colSpan={7} style={{ color: "var(--muted)" }}>No BOM found for this SKU.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {activeMode === "master" && (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button 
                  className="btn-export" 
                  onClick={handleOpenAdd}
                  style={{ background: "var(--accent)", color: "white", display: "flex", alignItems: "center", gap: "5px" }}
                >
                  ➕ Add New SKU
                </button>
                <button 
                  className="btn-export" 
                  onClick={downloadCSVTemplate}
                  style={{ display: "flex", alignItems: "center", gap: "5px" }}
                >
                  📥 Template CSV
                </button>
                
                <label className="btn-export" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", border: "1px dashed var(--border)", background: "none" }}>
                  📤 Upload SKU (CSV)
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleBulkUpload} 
                    style={{ display: "none" }} 
                  />
                </label>
              </div>

              <div style={{ position: "relative", width: "300px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position: 'absolute', left: '12px', top: '10px', color: 'var(--muted)'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                  className="gloss-search"
                  placeholder="Search SKU master list…"
                  value={masterSearch}
                  onChange={(e) => { setMasterSearch(e.target.value); setMasterPage(0); }}
                  style={{ padding: "8px 12px 8px 36px", fontSize: "13px", margin: 0 }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Product Master Repository — product_master</h2>
            <div className="card-note">Central SKU dimensions used for demand segmentation, MRP explosion and scheduling.</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>SKU Name</th>
                    <th>Type</th>
                    <th>Series</th>
                    <th>Brand</th>
                    <th>Status</th>
                    <th>Barcode</th>
                    <th>Sub Cat.</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {masterPageRows.map((r, i) => (
                    <tr key={i}>
                      <td className="num" style={{ color: "var(--muted)" }}>{curMasterPage * PER_PAGE + i + 1}</td>
                      <td className="name" style={{ fontWeight: 600 }}>{r.sku_name}</td>
                      <td><span className="badge method">{r.type || "—"}</span></td>
                      <td>{r.series || "—"}</td>
                      <td>{r.brand || "—"}</td>
                      <td>
                        <span className={"badge " + (r.status === "Discontinued" ? "na" : "growing")}>
                          {r.status || "Continue"}
                        </span>
                      </td>
                      <td>{r.barcode || "—"}</td>
                      <td>{r.sub_category || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button 
                            onClick={() => handleOpenEdit(r.sku_name)}
                            style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "12px", textDecoration: "underline", padding: 0 }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(r.sku_name)}
                            style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "12px", textDecoration: "underline", padding: 0 }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMaster.length === 0 && (
                    <tr>
                      <td colSpan={9} className="gloss-empty">No product master records match query.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {masterPages > 1 && (
              <div className="pager">
                <span className="pager-info">{curMasterPage * PER_PAGE + 1}–{Math.min(filteredMaster.length, curMasterPage * PER_PAGE + PER_PAGE)} of {fmt(filteredMaster.length)}</span>
                <button className="gloss-pill" disabled={curMasterPage === 0} onClick={() => setMasterPage(curMasterPage - 1)}>‹ Prev</button>
                <button className="gloss-pill" disabled={curMasterPage === masterPages - 1} onClick={() => setMasterPage(curMasterPage + 1)}>Next ›</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Editor Modal Popup */}
      {showModal && (
        <div style={{
          position: "fixed",
          left: 0, top: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 1000,
          backdropFilter: "blur(4px)"
        }}>
          <div className="card" style={{
            width: "500px",
            maxHeight: "90vh",
            overflowY: "auto",
            border: "1px solid var(--border)",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
          }}>
            <h2 className="card-title" style={{ margin: "0 0 15px 0" }}>
              {modalMode === "add" ? "Add New SKU Master" : `Edit SKU: "${formData.sku_name}"`}
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>SKU Name *</label>
                  <input 
                    type="text"
                    required
                    disabled={modalMode === "edit"}
                    value={formData.sku_name}
                    onChange={(e) => setFormData({ ...formData, sku_name: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Type</label>
                    <input 
                      type="text"
                      placeholder="e.g. 30ML, Capsule"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    >
                      <option value="Continue">Continue (Active)</option>
                      <option value="Discontinued">Discontinued</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Brand</label>
                    <input 
                      type="text"
                      placeholder="e.g. FOOM, FLOOID"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Series</label>
                    <input 
                      type="text"
                      placeholder="e.g. Tropical Series"
                      value={formData.series}
                      onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Sub Category</label>
                  <input 
                    type="text"
                    placeholder="e.g. Liquid, Device"
                    value={formData.sub_category}
                    onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Barcode</label>
                    <input 
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Unique Label</label>
                    <input 
                      type="text"
                      value={formData.unique_label}
                      onChange={(e) => setFormData({ ...formData, unique_label: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button 
                  type="button" 
                  className="btn-export" 
                  disabled={isPending}
                  onClick={() => setShowModal(false)}
                  style={{ background: "none", border: "1px solid var(--border)", margin: 0 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-export" 
                  disabled={isPending}
                  style={{ background: "var(--accent)", color: "white", margin: 0 }}
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
