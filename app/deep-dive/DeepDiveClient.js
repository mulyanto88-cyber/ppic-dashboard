"use client";

import { useState, useMemo, useTransition } from "react";
import { fmt, rp, ym } from "../../lib/format";
import SkuPicker from "./SkuPicker";
import { METHODS } from "../../lib/forecast";

const IconDollarSign = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const IconPackage = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
const IconTag = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>;
const IconTrendingUp = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;

const MAT_BADGE = { Critical: "declining", "Below Min": "stable", OK: "growing" };

function q(val, uom) {
  if (uom === "g") return fmt(Math.round(Number(val) / 1000)) + " kg";
  return fmt(val) + (uom ? " " + uom : "");
}

function Bars({ data, valueKey, labelKey }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="barchart" style={{ paddingTop: "24px" }}>
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const pct = (v / max) * 100;
        const formattedVal = fmt(v);
        return (
          <div 
            className="bar-col" 
            key={i}
            title={`${d[labelKey]}: ${formattedVal} units`}
            style={{ cursor: "pointer" }}
          >
            <div className="bar-val" style={{ fontSize: "10px", color: "var(--text-dim)", fontWeight: 600, marginBottom: "4px" }}>
              {v > 0 ? formattedVal : "0"}
            </div>
            <div 
              className="bar hl" 
              style={{ height: Math.max(3, pct) + "%", transition: "all 0.2s ease-in-out" }} 
            />
            <div className="bar-label">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProductionScheduleSimulator({ detail }) {
  const mps = detail?.mpsPlan || {};
  const soh = Number(detail?.inv?.soh_qty || mps.soh || 0);
  const weeklyDemand = Number(mps.weekly_demand || (detail?.seg?.avg_monthly ? detail.seg.avg_monthly / 4.345 : 0));
  const dailyDemand = weeklyDemand / 7;

  const [targetDays, setTargetDays] = useState(30);
  const [batchRounding, setBatchRounding] = useState(500);

  const minStockTarget = Math.round(dailyDemand * targetDays);
  const isBelowMin = soh < minStockTarget;

  // 8-week simulation
  const simulationWeeks = useMemo(() => {
    const weeks = [];
    let currentStock = soh;
    const batch = Math.max(1, batchRounding);

    for (let w = 1; w <= 8; w++) {
      const stockStart = currentStock;
      const demand = Math.round(weeklyDemand);
      const stockAfterDemand = stockStart - demand;
      
      let plannedMo = 0;
      if (stockAfterDemand < minStockTarget) {
        const need = minStockTarget - stockAfterDemand;
        plannedMo = Math.ceil(need / batch) * batch;
      }

      const stockEnd = stockAfterDemand + plannedMo;
      currentStock = stockEnd;

      const woc = weeklyDemand > 0 ? (stockEnd / weeklyDemand).toFixed(1) : "—";
      
      let status = "Healthy";
      let statusClass = "growing";
      if (stockEnd < 0) {
        status = "Critical (Stockout)";
        statusClass = "declining";
      } else if (stockEnd < minStockTarget) {
        status = "Below Minimum";
        statusClass = "stable";
      }

      weeks.push({
        weekNum: w,
        stockStart,
        demand,
        plannedMo,
        stockEnd,
        woc,
        status,
        statusClass
      });
    }
    return weeks;
  }, [soh, weeklyDemand, minStockTarget, batchRounding]);

  const totalPlannedMo = simulationWeeks.reduce((sum, w) => sum + w.plannedMo, 0);
  const firstMoWeek = simulationWeeks.find(w => w.plannedMo > 0)?.weekNum;

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚙️</span> Simulasi Production Schedule &amp; Buffer (8 Minggu)
          </h2>
          <div className="card-note">
            Perhitungan kebutuhan jadwal produksi mingguan (MPS) berdasarkan target safety stock &amp; kelipatan batch size.
          </div>
        </div>
        <div className="dd-badges">
          <span className={"badge " + (isBelowMin ? "declining" : "growing")}>
            {isBelowMin ? "⚠️ Below Stock Minimum" : "✅ Stock Healthy"}
          </span>
        </div>
      </div>

      {/* Control panel & KPI summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", margin: "16px 0", background: "var(--surface)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
        <div>
          <label style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>
            Target Buffer Stock (Hari): <b style={{ color: "var(--accent)" }}>{targetDays} Hari</b>
          </label>
          <input
            type="range"
            min="7"
            max="90"
            step="1"
            value={targetDays}
            onChange={(e) => setTargetDays(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)" }}>
            <span>7h</span>
            <span>30h (Std)</span>
            <span>60h</span>
            <span>90h</span>
          </div>
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: "6px" }}>
            Batch Size Rounding (Pcs):
          </label>
          <input
            type="number"
            min="500"
            step="500"
            value={batchRounding}
            onChange={(e) => setBatchRounding(Math.max(1, Number(e.target.value)))}
            style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "inherit", fontSize: "13px" }}
          />
        </div>

        <div>
          <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Safety Stock Minimum Target</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: "4px" }}>{fmt(minStockTarget)} <span style={{ fontSize: "12px", fontWeight: "normal", color: "var(--muted)" }}>pcs</span></div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>Daily Demand: {fmt(Math.round(dailyDemand))} pcs/day</div>
        </div>

        <div>
          <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Total Rencana MO (8 Minggu)</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: totalPlannedMo > 0 ? "var(--amber, #f59e0b)" : "var(--green, #10b981)", marginTop: "4px" }}>
            {fmt(totalPlannedMo)} <span style={{ fontSize: "12px", fontWeight: "normal", color: "var(--muted)" }}>pcs</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
            {firstMoWeek ? `Minggu Rilis Pertama: W+${firstMoWeek}` : "Stok Aman (Tanpa MO)"}
          </div>
        </div>
      </div>

      {/* 8-Week Simulation Table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Minggu</th>
              <th className="num">Stok Awal</th>
              <th className="num">Est. Demand</th>
              <th className="num" style={{ background: "rgba(59, 130, 246, 0.08)" }}>Rencana Produksi (MO)</th>
              <th className="num">Stok Akhir</th>
              <th className="num">Weeks Cover</th>
              <th>Status Buffer</th>
            </tr>
          </thead>
          <tbody>
            {simulationWeeks.map((row) => (
              <tr key={row.weekNum} style={row.plannedMo > 0 ? { background: "rgba(245, 158, 11, 0.05)" } : {}}>
                <td style={{ fontWeight: 600 }}>W+{row.weekNum}</td>
                <td className="num">{fmt(row.stockStart)}</td>
                <td className="num">{fmt(row.demand)}</td>
                <td className="num" style={{ fontWeight: row.plannedMo > 0 ? "bold" : "normal", color: row.plannedMo > 0 ? "var(--accent)" : "inherit", background: "rgba(59, 130, 246, 0.05)" }}>
                  {row.plannedMo > 0 ? `+${fmt(row.plannedMo)}` : "—"}
                </td>
                <td className="num" style={{ fontWeight: "bold" }}>{fmt(row.stockEnd)}</td>
                <td className="num">{row.woc} wks</td>
                <td><span className={"badge " + row.statusClass}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  pickerItems,
  currentSku,
  detail,
  productMasterList,
  materialMasterList = [],
  saveSkuMasterAction,
  deleteSkuMasterAction,
  bulkUploadSkuMasterAction,
  saveMaterialMasterAction,
  deleteMaterialMasterAction,
  bulkUploadMaterialMasterAction
}) {
  const [activeMode, setActiveMode] = useState("viewer"); // "viewer" | "master"
  const [masterTab, setMasterTab] = useState("fg"); // "fg" | "rmpm"
  const [isPending, startTransition] = useTransition();

  // Master Data Search & Pagination
  const [masterSearch, setMasterSearch] = useState("");
  const [masterPage, setMasterPage] = useState(0);
  const PER_PAGE = 20;

  // SKU Modal / Editor forms
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

  // Material (RMPM) Modal / Editor forms
  const [showMatModal, setShowMatModal] = useState(false);
  const [matModalMode, setMatModalMode] = useState("add"); // "add" | "edit"
  const [matFormData, setMatFormData] = useState({
    material_name: "",
    vendor_name: "",
    lead_time_days: 14,
    moq: 0,
    safety_stock_days: 30,
    source_type: "local",
    material_classification: "RM",
    status: "active"
  });

  // SKU Handlers
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

  // Material Handlers
  const handleOpenAddMat = () => {
    setMatFormData({
      material_name: "",
      vendor_name: "",
      lead_time_days: 14,
      moq: 0,
      safety_stock_days: 30,
      source_type: "local",
      material_classification: "RM",
      status: "active"
    });
    setMatModalMode("add");
    setShowMatModal(true);
  };

  const handleOpenEditMat = (matName) => {
    const found = materialMasterList.find(m => m.material_name === matName) || {};
    setMatFormData({
      material_name: found.material_name || matName,
      vendor_name: found.vendor_name || "",
      lead_time_days: found.lead_time_days ?? 14,
      moq: found.moq ?? 0,
      safety_stock_days: found.safety_stock_days ?? 30,
      source_type: found.source_type || "local",
      material_classification: found.material_classification || "RM",
      status: found.status || "active"
    });
    setMatModalMode("edit");
    setShowMatModal(true);
  };

  const handleSaveMat = async (e) => {
    e.preventDefault();
    if (!matFormData.material_name.trim()) {
      alert("Material Name is required");
      return;
    }

    startTransition(async () => {
      const res = await saveMaterialMasterAction(matFormData.material_name, matFormData);
      if (res.success) {
        setShowMatModal(false);
      } else {
        alert("Failed to save material: " + res.error);
      }
    });
  };

  const handleDeleteMat = async (matName) => {
    if (!confirm(`Are you absolutely sure you want to delete material: "${matName}"?\nThis might affect views if used in BOM.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteMaterialMasterAction(matName);
      if (!res.success) {
        alert("Failed to delete material: " + res.error);
      }
    });
  };

  const handleBulkUploadMat = async (e) => {
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
        const matNameIdx = headers.indexOf("material_name");
        if (matNameIdx === -1) {
          alert("Missing required column 'material_name' in CSV");
          return;
        }

        const vendorIdx = headers.indexOf("vendor_name");
        const ltIdx = headers.indexOf("lead_time_days");
        const moqIdx = headers.indexOf("moq");
        const ssIdx = headers.indexOf("safety_stock_days");
        const srcIdx = headers.indexOf("source_type");
        const classIdx = headers.indexOf("material_classification");
        const statusIdx = headers.indexOf("status");

        const dataRows = [];
        for (let i = 1; i < parsedLines.length; i++) {
          const row = parsedLines[i];
          if (!row[matNameIdx]) continue;
          dataRows.push({
            material_name: row[matNameIdx],
            vendor_name: vendorIdx !== -1 ? row[vendorIdx] : null,
            lead_time_days: ltIdx !== -1 ? Number(row[ltIdx]) || 14 : 14,
            moq: moqIdx !== -1 ? Number(row[moqIdx]) || 0 : 0,
            safety_stock_days: ssIdx !== -1 ? Number(row[ssIdx]) || 30 : 30,
            source_type: srcIdx !== -1 ? row[srcIdx] : "local",
            material_classification: classIdx !== -1 ? row[classIdx] : "RM",
            status: statusIdx !== -1 ? row[statusIdx] : "active",
          });
        }

        if (dataRows.length === 0) {
          alert("No records with valid 'material_name' found.");
          return;
        }

        if (!confirm(`Found ${dataRows.length} Material records. Perform bulk upsert to database?`)) {
          return;
        }

        startTransition(async () => {
          const res = await bulkUploadMaterialMasterAction(dataRows);
          if (res.success) {
            alert(`Successfully uploaded/updated ${res.count} Materials!`);
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

  const downloadCSVTemplateMat = () => {
    const headers = "material_name,vendor_name,lead_time_days,moq,safety_stock_days,source_type,material_classification,status\n";
    const sample = "GLYCERIN USP 99.7%,PT VISTA CHEM INDONESIA,14,500,30,local,RM,active\n";
    const blob = new Blob([headers + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "material_master_template.csv");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filter lists based on search
  const filteredMaster = useMemo(() => {
    return productMasterList.filter(p => {
      return (p.sku_name || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (p.type || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (p.brand || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (p.series || "").toLowerCase().includes(masterSearch.toLowerCase());
    });
  }, [productMasterList, masterSearch]);

  const filteredRmpm = useMemo(() => {
    return materialMasterList.filter(m => {
      return (m.material_name || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (m.vendor_name || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (m.source_type || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (m.material_classification || "").toLowerCase().includes(masterSearch.toLowerCase()) ||
             (m.status || "").toLowerCase().includes(masterSearch.toLowerCase());
    });
  }, [materialMasterList, masterSearch]);

  // Pagination calculation
  const curList = masterTab === "fg" ? filteredMaster : filteredRmpm;
  const masterPages = Math.max(1, Math.ceil(curList.length / PER_PAGE));
  const curMasterPage = Math.min(masterPage, masterPages - 1);
  const masterPageRows = curList.slice(curMasterPage * PER_PAGE, curMasterPage * PER_PAGE + PER_PAGE);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Deep Dive &amp; Master Data</h1>
          <div className="page-sub">360° view of single SKU &amp; product/material master repository editor</div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            className={"gloss-pill" + (activeMode === "viewer" ? " active" : "")} 
            onClick={() => setActiveMode("viewer")}
            style={{ padding: "8px 16px", borderRadius: "20px" }}
          >
            📊 SKU &amp; RMPM Analytics
          </button>
          <button 
            className={"gloss-pill" + (activeMode === "master" ? " active" : "")} 
            onClick={() => { setActiveMode("master"); setMasterPage(0); setMasterSearch(""); }}
            style={{ padding: "8px 16px", borderRadius: "20px" }}
          >
            🗂 Master Data Editor
          </button>
        </div>
      </div>

      {activeMode === "viewer" && (
        <>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "100%", marginBottom: "1rem" }}>
            <div style={{ flex: 1 }}><SkuPicker items={pickerItems} current={currentSku} /></div>
            {currentSku && detail && detail.type === "FG" && (
              <button 
                className="btn-export" 
                onClick={() => handleOpenEdit(currentSku)}
                style={{ height: "45px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}
              >
                ✏️ Edit SKU Master
              </button>
            )}
            {currentSku && detail && detail.type === "RMPM" && (
              <button 
                className="btn-export" 
                onClick={() => handleOpenEditMat(currentSku)}
                style={{ height: "45px", margin: 0, display: "flex", alignItems: "center", gap: "5px" }}
              >
                ✏️ Edit Material Master
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
            <div className="card"><div className="gloss-empty">Search and pick an FG SKU or RMPM Material above to see its full profile.</div></div>
          )}

          {currentSku && detail && detail.type === "FG" && (
            <>
              <div className="card">
                <h2 className="card-title">{detail.seg.sku_name || currentSku}</h2>
                <div className="card-note">Type: {detail.seg.type || "—"}</div>
                <div className="dd-badges">
                  {detail.seg.status && <span className={"badge " + (detail.seg.status === "Discontinued" ? "dead" : "growing")}>{detail.seg.status}</span>}
                  {detail.seg.abc_tier && detail.seg.abc_tier !== "—" && <span className={"badge abc-" + String(detail.seg.abc_tier).toLowerCase()}>ABC-qty {detail.seg.abc_tier}</span>}
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
                  <h2 className="card-title">Forecast — 3 Months (3 Models)</h2>
                  <div className="card-note">Evaluasi 3 Model: WMA, Linear Trend, &amp; Seasonal · Champion: <b>{METHODS[detail.champMethod]?.label || "WMA"}</b></div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Bulan</th>
                          <th className="num">WMA</th>
                          <th className="num">Linear Trend</th>
                          <th className="num">Seasonal</th>
                          <th className="num" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--green)" }}>Champion ({METHODS[detail.champMethod]?.label})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.fc.map((r, i) => {
                          const wmaQ = detail.modelFc?.wma?.[i]?.q ?? null;
                          const trendQ = detail.modelFc?.trend?.[i]?.q ?? null;
                          const seasonalQ = detail.modelFc?.seasonal?.[i]?.q ?? null;
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{ym(r.ym)}</td>
                              <td className="num">{wmaQ == null ? "—" : fmt(wmaQ)}</td>
                              <td className="num">{trendQ == null ? "—" : fmt(trendQ)}</td>
                              <td className="num">{seasonalQ == null ? "—" : fmt(seasonalQ)}</td>
                              <td className="num" style={{ fontWeight: "bold", background: "rgba(16, 185, 129, 0.05)", color: "var(--green)" }}>
                                {fmt(r.q)}
                              </td>
                            </tr>
                          );
                        })}
                        {detail.fc.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No forecast available.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <ProductionScheduleSimulator detail={detail} />

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
                            <td className="name">
                              <a href={`/deep-dive?sku=${encodeURIComponent(b.component)}`} style={{ color: "var(--accent)", fontWeight: "bold", textDecoration: "none" }}>
                                {b.component}
                              </a>
                            </td>
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

          {currentSku && detail && detail.type === "RMPM" && (
            <>
              {/* Header card for RMPM */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 className="card-title" style={{ margin: 0 }}>{detail.mrp.material_name || currentSku}</h2>
                    <div className="card-note" style={{ marginTop: "5px" }}>
                      Primary Vendor: <b>{detail.mrp.vendor || "—"}</b>
                    </div>
                  </div>
                </div>
                <div className="dd-badges" style={{ marginTop: "10px" }}>
                  <span className={"badge " + (detail.mrp.source_type === "import" ? "declining" : "method")}>
                    {detail.mrp.source_type === "import" ? "✈️ Import" : "🏡 Local"}
                  </span>
                  <span className="badge method">
                    Classification: {detail.mrp.material_classification || "RM"}
                  </span>
                  <span className={"badge " + (detail.mrp.status === "inactive" ? "na" : "growing")}>
                    Status: {detail.mrp.status || "active"}
                  </span>
                  {detail.mrp.status && detail.mrp.status !== "active" && detail.mrp.status !== "inactive" && (
                    <span className={"badge " + (MAT_BADGE[detail.mrp.status] || "na")}>
                      MRP Status: {detail.mrp.status}
                    </span>
                  )}
                </div>
              </div>

              {/* KPI Cards for RMPM */}
              <section className="kpi-grid">
                <div className="card kpi-card">
                  <div className="kpi-icon accent"><IconTrendingUp /></div>
                  <div>
                    <div className="kpi-label">Lead Time</div>
                    <div className="kpi-value">{detail.mrp.lead_time_days || 14} days</div>
                    <div className="kpi-sub">{detail.mrp.source_type === "import" ? "Overseas transit" : "Local delivery"}</div>
                  </div>
                </div>
                <div className="card kpi-card">
                  <div className="kpi-icon amber"><IconPackage /></div>
                  <div>
                    <div className="kpi-label">Safety Stock</div>
                    <div className="kpi-value">{detail.mrp.safety_stock_days || 30} days</div>
                    <div className="kpi-sub">buffer coverage target</div>
                  </div>
                </div>
                <div className="card kpi-card">
                  <div className="kpi-icon green"><IconDollarSign /></div>
                  <div>
                    <div className="kpi-label">MOQ</div>
                    <div className="kpi-value">{fmt(detail.mrp.moq || 0)}</div>
                    <div className="kpi-sub">minimum order units</div>
                  </div>
                </div>
                <div className="card kpi-card">
                  <div className="kpi-icon muted"><IconPackage /></div>
                  <div>
                    <div className="kpi-label">Stock Position</div>
                    <div className="kpi-value">{q(detail.mrp.total_position, detail.mrp.uom)}</div>
                    <div className="kpi-sub">Cover: {detail.mrp.weeks_cover || 0} weeks</div>
                  </div>
                </div>
              </section>

              {/* Grid with breakdown & Used In */}
              <section className="grid-2">
                {/* Inventory Health Details */}
                <div className="card">
                  <h2 className="card-title">Inventory &amp; Requirement Details</h2>
                  <div className="card-note">Detailed stock segments and net requirement calculation.</div>
                  <div className="table-wrap">
                    <table className="table" style={{ width: "100%" }}>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>Stock on Hand (SOH)</td>
                          <td className="num">{q(detail.mrp.soh, detail.mrp.uom)}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>PO Incoming</td>
                          <td className="num">{q(detail.mrp.po_incoming, detail.mrp.uom)}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>MO WIP</td>
                          <td className="num">{q(detail.mrp.mo_wip, detail.mrp.uom)}</td>
                        </tr>
                        <tr style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card-soft)" }}>
                          <td style={{ fontWeight: "bold", color: "var(--text)" }}>Total Stock Position</td>
                          <td className="num" style={{ fontWeight: "bold", color: "var(--text)" }}>{q(detail.mrp.total_position, detail.mrp.uom)}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>Weekly Consumption Rate</td>
                          <td className="num">{q(detail.mrp.weekly_consumption, detail.mrp.uom)}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>Weeks of Cover</td>
                          <td className="num" style={{ fontWeight: "bold", color: Number(detail.mrp.weeks_cover) < ((detail.mrp.lead_time_days || 14) / 7) ? "var(--red)" : "var(--green)" }}>
                            {detail.mrp.weeks_cover || 0} weeks
                          </td>
                        </tr>
                        <tr style={{ borderTop: "1px solid var(--border)", background: "rgba(220, 53, 69, 0.1)" }}>
                          <td style={{ fontWeight: "bold", color: "var(--red)" }}>Net Requirement</td>
                          <td className="num" style={{ fontWeight: "bold", color: "var(--red)", fontSize: "15px" }}>
                            {detail.mrp.uom === "g" ? (detail.mrp.net_requirement_kg != null ? fmt(detail.mrp.net_requirement_kg) + " kg" : "—") : fmt(detail.mrp.net_requirement || 0)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>Supply Mode Override</td>
                          <td className="num">
                            <span className="badge method">{detail.mrp.supply_mode || "Normal"}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Used In Finished Goods */}
                <div className="card">
                  <h2 className="card-title">Used In — Finished Goods (FG)</h2>
                  <div className="card-note">FGs where this material is configured in the Bill of Materials (BOM). Click on FG name to inspect.</div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>FG SKU Name</th>
                          <th className="num">Qty Per Unit</th>
                          <th>ABC Tier</th>
                          <th>XYZ Class</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.usedIn.map((item, i) => (
                          <tr key={i}>
                            <td className="name">
                              <a href={`/deep-dive?sku=${encodeURIComponent(item.product)}`} style={{ color: "var(--accent)", fontWeight: "bold", textDecoration: "none" }}>
                                {item.product}
                              </a>
                            </td>
                            <td className="num" style={{ fontWeight: "bold" }}>{item.per_pcs}</td>
                            <td>
                              {item.seg.abc_tier ? (
                                <span className={"badge abc-" + String(item.seg.abc_tier).toLowerCase()}>
                                  ABC-{item.seg.abc_tier}
                                </span>
                              ) : "—"}
                            </td>
                            <td>
                              {item.seg.xyz_class ? (
                                <span className={"badge xyz-" + String(item.seg.xyz_class).toLowerCase()}>
                                  {item.seg.xyz_class}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                        {detail.usedIn.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ color: "var(--muted)", textAlign: "center", padding: "1.5rem" }}>
                              This material is not used in any Finished Goods BOMs.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {activeMode === "master" && (
        <>
          {/* Sub-tab selection */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "1rem" }}>
            <button 
              className={"gloss-pill" + (masterTab === "fg" ? " active" : "")}
              onClick={() => { setMasterTab("fg"); setMasterPage(0); setMasterSearch(""); }}
              style={{ fontSize: "13px" }}
            >
              📦 Finished Goods (FG) Master
            </button>
            <button 
              className={"gloss-pill" + (masterTab === "rmpm" ? " active" : "")}
              onClick={() => { setMasterTab("rmpm"); setMasterPage(0); setMasterSearch(""); }}
              style={{ fontSize: "13px" }}
            >
              🧪 Raw Mat &amp; Pack Mat (RMPM) Master
            </button>
          </div>

          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {masterTab === "fg" ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <button 
                      className="btn-export" 
                      onClick={handleOpenAddMat}
                      style={{ background: "var(--accent)", color: "white", display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      ➕ Add New Material
                    </button>
                    <button 
                      className="btn-export" 
                      onClick={downloadCSVTemplateMat}
                      style={{ display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      📥 Template CSV
                    </button>
                    <label className="btn-export" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", border: "1px dashed var(--border)", background: "none" }}>
                      📤 Upload Material (CSV)
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleBulkUploadMat} 
                        style={{ display: "none" }} 
                      />
                    </label>
                  </>
                )}
              </div>

              <div style={{ position: "relative", width: "300px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position: 'absolute', left: '12px', top: '10px', color: 'var(--muted)'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                  className="gloss-search"
                  placeholder={masterTab === "fg" ? "Search SKU master list…" : "Search material master list…"}
                  value={masterSearch}
                  onChange={(e) => { setMasterSearch(e.target.value); setMasterPage(0); }}
                  style={{ padding: "8px 12px 8px 36px", fontSize: "13px", margin: 0 }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            {masterTab === "fg" ? (
              <>
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
              </>
            ) : (
              <>
                <h2 className="card-title">Material Master Repository — material_master</h2>
                <div className="card-note">Central parameters for Raw Material (RM) and Packaging Material (PM) used for Lead Time and Safety Stock offsets.</div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Material Name</th>
                        <th>Primary Vendor</th>
                        <th className="num">Lead Time</th>
                        <th className="num">MOQ</th>
                        <th className="num">Safety Stock</th>
                        <th>Source</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterPageRows.map((r, i) => (
                        <tr key={i}>
                          <td className="num" style={{ color: "var(--muted)" }}>{curMasterPage * PER_PAGE + i + 1}</td>
                          <td className="name" style={{ fontWeight: 600 }}>{r.material_name}</td>
                          <td>{r.vendor_name || "—"}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{r.lead_time_days} days</td>
                          <td className="num">{fmt(r.moq || 0)}</td>
                          <td className="num" style={{ color: "var(--muted)" }}>{r.safety_stock_days} days</td>
                          <td>
                            <span className={"badge " + (r.source_type === "import" ? "declining" : "method")}>
                              {r.source_type === "import" ? "✈️ Import" : "🏡 Local"}
                            </span>
                          </td>
                          <td>
                            <span className="badge method">
                              {r.material_classification || "RM"}
                            </span>
                          </td>
                          <td>
                            <span className={"badge " + (r.status === "inactive" ? "na" : "growing")}>
                              {r.status || "active"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button 
                                onClick={() => handleOpenEditMat(r.material_name)}
                                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "12px", textDecoration: "underline", padding: 0 }}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteMat(r.material_name)}
                                style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "12px", textDecoration: "underline", padding: 0 }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredRmpm.length === 0 && (
                        <tr>
                          <td colSpan={10} className="gloss-empty">No material master records match query.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {masterPages > 1 && (
              <div className="pager">
                <span className="pager-info">{curMasterPage * PER_PAGE + 1}–{Math.min(curList.length, curMasterPage * PER_PAGE + PER_PAGE)} of {fmt(curList.length)}</span>
                <button className="gloss-pill" disabled={curMasterPage === 0} onClick={() => setMasterPage(curMasterPage - 1)}>‹ Prev</button>
                <button className="gloss-pill" disabled={curMasterPage === masterPages - 1} onClick={() => setMasterPage(curMasterPage + 1)}>Next ›</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* SKU Editor Modal Popup */}
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

      {/* RMPM Material Editor Modal Popup */}
      {showMatModal && (
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
              {matModalMode === "add" ? "Add New Material Master" : `Edit Material: "${matFormData.material_name}"`}
            </h2>
            <form onSubmit={handleSaveMat}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Material Name *</label>
                  <input 
                    type="text"
                    required
                    disabled={matModalMode === "edit"}
                    value={matFormData.material_name}
                    onChange={(e) => setMatFormData({ ...matFormData, material_name: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Primary Vendor</label>
                  <input 
                    type="text"
                    placeholder="e.g. PT SCENTIUM FLAVORS"
                    value={matFormData.vendor_name}
                    onChange={(e) => setMatFormData({ ...matFormData, vendor_name: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Lead Time (days)</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={matFormData.lead_time_days}
                      onChange={(e) => setMatFormData({ ...matFormData, lead_time_days: parseInt(e.target.value) || 0 })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>MOQ</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={matFormData.moq}
                      onChange={(e) => setMatFormData({ ...matFormData, moq: parseFloat(e.target.value) || 0 })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Safety Stock (days)</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={matFormData.safety_stock_days}
                      onChange={(e) => setMatFormData({ ...matFormData, safety_stock_days: parseInt(e.target.value) || 0 })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Source Type</label>
                    <select
                      value={matFormData.source_type}
                      onChange={(e) => setMatFormData({ ...matFormData, source_type: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    >
                      <option value="local">local (🏡 Local)</option>
                      <option value="import">import (✈️ Import)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Classification</label>
                    <select
                      value={matFormData.material_classification}
                      onChange={(e) => setMatFormData({ ...matFormData, material_classification: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    >
                      <option value="RM">RM (Raw Material)</option>
                      <option value="PM">PM (Packaging Material)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "bold" }}>Status</label>
                    <select
                      value={matFormData.status}
                      onChange={(e) => setMatFormData({ ...matFormData, status: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                    >
                      <option value="active">active (Active)</option>
                      <option value="inactive">inactive (Inactive)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button 
                  type="button" 
                  className="btn-export" 
                  disabled={isPending}
                  onClick={() => setShowMatModal(false)}
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
