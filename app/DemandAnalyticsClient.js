"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { fmt, rp, ym, dmon, pct } from "../lib/format";
import ChartCombo from "./ChartCombo";
import WeeklyBars from "./WeeklyBars";

const IconTrendingUp = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>;
const IconPackage = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
const IconTag = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>;
const IconLayers = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>;
const IconFilter = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>;

function pctOf(part, total) {
  return total > 0 ? pct(((Number(part) || 0) / total) * 100) : "—";
}

function getSkuBrand(skuName, p) {
  if (p?.brand) return p.brand.toUpperCase().trim();
  const s = (skuName || "").toUpperCase();
  if (s.startsWith("FOOM")) return "FOOM";
  if (s.startsWith("FLOOID")) return "FLOOID";
  if (s.startsWith("OEM")) return "OEM";
  return "OTHER";
}

export default function DemandAnalyticsClient({
  productMaster = [],
  skuValue = [],
  skuSegmentation = [],
  recentSales = [],
  trendWatch = [],
  revenueMonthly = [],
  weeklyTrend = [],
  salesMonthly18 = [],
  salesWeekly12 = [],
  lastMonth,
}) {
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedSubCat, setSelectedSubCat] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  // Build product_master map
  const pmMap = useMemo(() => {
    const map = {};
    productMaster.forEach((p) => {
      if (p.sku_name) map[p.sku_name.toUpperCase().trim()] = p;
    });
    return map;
  }, [productMaster]);

  // Build segmentation map
  const segMap = useMemo(() => {
    const map = {};
    skuSegmentation.forEach((s) => {
      if (s.sku_name) map[s.sku_name] = s;
    });
    return map;
  }, [skuSegmentation]);

  // Build recent sales map
  const recentMap = useMemo(() => {
    const map = {};
    recentSales.forEach((r) => {
      if (r.sku_name) map[r.sku_name] = r;
    });
    return map;
  }, [recentSales]);

  // Extract filter options
  const brandOptions = ["All", "FOOM", "FLOOID", "OEM"];

  const subCatOptions = useMemo(() => {
    const set = new Set();
    productMaster.forEach((p) => {
      if (p.sub_category) set.add(p.sub_category);
    });
    return ["All", ...Array.from(set).sort()];
  }, [productMaster]);

  const typeOptions = useMemo(() => {
    const set = new Set();
    productMaster.forEach((p) => {
      if (p.type) set.add(p.type);
    });
    skuSegmentation.forEach((s) => {
      if (s.type) set.add(s.type);
    });
    return ["All", ...Array.from(set).sort()];
  }, [productMaster, skuSegmentation]);

  // Reactive SKU set matching active filters
  const filteredSkuSet = useMemo(() => {
    const set = new Set();
    skuValue.forEach((r) => {
      const norm = (r.sku_name || "").toUpperCase().trim();
      const p = pmMap[norm];

      // Brand filter
      const brand = getSkuBrand(r.sku_name, p);
      if (selectedBrand !== "All" && brand !== selectedBrand) return;

      // Sub Category filter
      const subCat = p?.sub_category || "";
      if (selectedSubCat !== "All" && subCat !== selectedSubCat) return;

      // Type filter
      const type = p?.type || segMap[r.sku_name]?.type || "";
      if (selectedType !== "All" && type !== selectedType) return;

      set.add(r.sku_name);
    });
    return set;
  }, [selectedBrand, selectedSubCat, selectedType, skuValue, pmMap, segMap]);

  const isFiltered = selectedBrand !== "All" || selectedSubCat !== "All" || selectedType !== "All";

  // 1. Filtered SKU Value & KPI Metrics
  const filteredSkuValue = useMemo(() => {
    return skuValue.filter((r) => filteredSkuSet.has(r.sku_name));
  }, [skuValue, filteredSkuSet]);

  const totalValue = useMemo(() => {
    return filteredSkuValue.reduce((s, r) => s + Number(r.value_12m || 0), 0);
  }, [filteredSkuValue]);

  const totalQty = useMemo(() => {
    return filteredSkuValue.reduce((s, r) => s + Number(r.qty_12m || 0), 0);
  }, [filteredSkuValue]);

  const avgPrice = totalQty > 0 ? totalValue / totalQty : 0;
  const nA = useMemo(() => {
    return filteredSkuValue.filter((r) => r.abc_tier_value === "A").length;
  }, [filteredSkuValue]);

  // 2. Filtered Monthly Sales (18-Month Timeline)
  const rev18 = useMemo(() => {
    if (!isFiltered) {
      return revenueMonthly.slice(-18).map((r) => ({ ...r, _lbl: ym(r.month) }));
    }
    // Aggregate from salesMonthly18 for filtered SKUs
    const monthMap = {};
    const months = revenueMonthly.slice(-18).map((r) => r.month);
    months.forEach((m) => {
      monthMap[m] = { qty: 0, revenue_idr: 0 };
    });

    salesMonthly18.forEach((sm) => {
      if (filteredSkuSet.has(sm.sku_name) && monthMap[sm.month]) {
        const q = Number(sm.qty_delivered || 0);
        monthMap[sm.month].qty += q;
        const skuValObj = filteredSkuValue.find((v) => v.sku_name === sm.sku_name);
        const unitPrice = skuValObj && skuValObj.qty_12m > 0
          ? Number(skuValObj.value_12m) / Number(skuValObj.qty_12m)
          : avgPrice;
        monthMap[sm.month].revenue_idr += Math.round(q * unitPrice);
      }
    });

    return months.map((m) => ({
      month: m,
      qty: monthMap[m].qty,
      revenue_idr: monthMap[m].revenue_idr,
      _lbl: ym(m),
    }));
  }, [isFiltered, revenueMonthly, salesMonthly18, filteredSkuSet, filteredSkuValue, avgPrice]);

  // 3. Filtered Weekly FG Trend (12-Week Timeline)
  const weekly = useMemo(() => {
    if (!isFiltered) return weeklyTrend;
    const weekMap = {};
    weeklyTrend.forEach((w) => {
      weekMap[w.week_start] = { week_start: w.week_start, iso_week: w.iso_week, qty: 0 };
    });

    salesWeekly12.forEach((sw) => {
      if (filteredSkuSet.has(sw.sku_name) && weekMap[sw.week_start]) {
        weekMap[sw.week_start].qty += Number(sw.qty || 0);
      }
    });

    return Object.values(weekMap).sort((a, b) => (a.week_start > b.week_start ? 1 : -1));
  }, [isFiltered, weeklyTrend, salesWeekly12, filteredSkuSet]);

  // 4. Velocity Distribution (Movement Summary)
  const movement = useMemo(() => {
    const classes = ["Fast", "Medium", "Slow", "Dead"];
    const agg = {
      Fast: { sku_count: 0, qty_12m: 0 },
      Medium: { sku_count: 0, qty_12m: 0 },
      Slow: { sku_count: 0, qty_12m: 0 },
      Dead: { sku_count: 0, qty_12m: 0 },
    };

    filteredSkuValue.forEach((v) => {
      const s = segMap[v.sku_name];
      const mClass = s?.movement_class || "Slow";
      if (agg[mClass]) {
        agg[mClass].sku_count += 1;
        agg[mClass].qty_12m += Number(v.qty_12m || 0);
      }
    });

    return classes.map((c) => ({
      movement_class: c,
      sku_count: agg[c].sku_count,
      qty_12m: agg[c].qty_12m,
    }));
  }, [filteredSkuValue, segMap]);

  const movSku = useMemo(() => movement.reduce((s, m) => s + Number(m.sku_count || 0), 0), [movement]);
  const movVol = useMemo(() => movement.reduce((s, m) => s + Number(m.qty_12m || 0), 0), [movement]);

  // 5. Pareto ABC Distribution Summary
  const abc = useMemo(() => {
    const tiers = ["A", "B", "C"];
    const agg = {
      A: { sku_count: 0, qty_12m: 0 },
      B: { sku_count: 0, qty_12m: 0 },
      C: { sku_count: 0, qty_12m: 0 },
    };

    filteredSkuValue.forEach((v) => {
      const tier = v.abc_tier_value || segMap[v.sku_name]?.abc_tier || "C";
      if (agg[tier]) {
        agg[tier].sku_count += 1;
        agg[tier].qty_12m += Number(v.qty_12m || 0);
      }
    });

    return tiers.map((t) => ({
      abc_tier: t,
      sku_count: agg[t].sku_count,
      qty_12m: agg[t].qty_12m,
    }));
  }, [filteredSkuValue, segMap]);

  const abcSku = useMemo(() => abc.reduce((s, m) => s + Number(m.sku_count || 0), 0), [abc]);
  const abcVol = useMemo(() => abc.reduce((s, m) => s + Number(m.qty_12m || 0), 0), [abc]);

  // 6. Top 12 SKUs — Filtered & Ranked
  const topValue = useMemo(() => {
    return [...filteredSkuValue].sort((a, b) => Number(b.value_12m || 0) - Number(a.value_12m || 0)).slice(0, 12);
  }, [filteredSkuValue]);

  // 4 recent month labels for Top 12 table
  const last4 = useMemo(() => revenueMonthly.slice(-4).map((r) => ym(r.month)), [revenueMonthly]);

  // 7. ABC x XYZ Matrix Summary
  const matrix = useMemo(() => {
    const agg = {};
    filteredSkuValue.forEach((v) => {
      const s = segMap[v.sku_name] || {};
      const abcT = v.abc_tier_value || s.abc_tier || "C";
      const xyzC = s.xyz_class || "N/A";
      const key = `${abcT}_${xyzC}`;
      if (!agg[key]) agg[key] = { abc_tier: abcT, xyz_class: xyzC, sku_count: 0, qty_12m: 0 };
      agg[key].sku_count += 1;
      agg[key].qty_12m += Number(v.qty_12m || 0);
    });

    return Object.values(agg).sort((a, b) => {
      if (a.abc_tier !== b.abc_tier) return a.abc_tier.localeCompare(b.abc_tier);
      return a.xyz_class.localeCompare(b.xyz_class);
    });
  }, [filteredSkuValue, segMap]);

  // 8. Momentum Watchlist Filtered
  const watch = useMemo(() => {
    return trendWatch.filter((w) => filteredSkuSet.has(w.sku_name));
  }, [trendWatch, filteredSkuSet]);

  const handleReset = () => {
    setSelectedBrand("All");
    setSelectedSubCat("All");
    setSelectedType("All");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Demand Analytics</h1>
          <div className="page-sub">
            Active FG (Continue) · data through {lastMonth ? ym(lastMonth) : "—"} · 12-month basis
          </div>
        </div>
        <a className="btn-export" href="/api/export?view=v_sku_segmentation">↓ Export CSV</a>
      </div>

      {/* Dynamic Filter Controls Bar */}
      <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: "var(--accent)" }}>
            <IconFilter />
            <span>Filter Demand:</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            {/* Brand / Family Group Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Brand / Group:</label>
              <select
                className="gloss-select"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}
              >
                {brandOptions.map((b) => (
                  <option key={b} value={b}>
                    {b === "All" ? "All Brands (FOOM, FLOOID, OEM)" : b}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub Category Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Sub Category:</label>
              <select
                className="gloss-select"
                value={selectedSubCat}
                onChange={(e) => setSelectedSubCat(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}
              >
                {subCatOptions.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc === "All" ? "All Sub Categories" : sc}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Type:</label>
              <select
                className="gloss-select"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t === "All" ? "All Types" : t}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            {isFiltered && (
              <button
                className="gloss-pill active"
                onClick={handleReset}
                style={{ background: "var(--red-soft)", color: "var(--red)", border: "1px solid var(--red)", padding: "5px 12px", cursor: "pointer" }}
              >
                Reset Filter ↺
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Summary Badge */}
        {isFiltered && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line-soft)", fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>Menampilkan data terfilter:</span>
            <b style={{ color: "var(--fg)" }}>{fmt(filteredSkuValue.length)} SKUs</b>
            <span>(dari total {fmt(skuValue.length)} SKUs)</span>
          </div>
        )}
      </div>

      <section className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon accent"><IconTrendingUp /></div>
          <div>
            <div className="kpi-label">Revenue (12 mo)</div>
            <div className="kpi-value">{rp(totalValue)}</div>
            <div className="kpi-sub">sales value (IDR)</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon green"><IconPackage /></div>
          <div>
            <div className="kpi-label">Units Sold (12 mo)</div>
            <div className="kpi-value">{fmt(totalQty)}</div>
            <div className="kpi-sub">units delivered</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon amber"><IconTag /></div>
          <div>
            <div className="kpi-label">Avg. Price / Unit</div>
            <div className="kpi-value">{rp(avgPrice)}</div>
            <div className="kpi-sub">blended</div>
          </div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-icon muted"><IconLayers /></div>
          <div>
            <div className="kpi-label">Active SKUs</div>
            <div className="kpi-value">{fmt(filteredSkuValue.length)}</div>
            <div className="kpi-sub">{fmt(nA)} Tier A (by value)</div>
          </div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Monthly Revenue &amp; Units</h2>
        <div className="card-note">last 18 months · bars = revenue · line = units · hover for exact figures</div>
        <ChartCombo data={rev18} />
      </div>

      <div className="card">
        <h2 className="card-title">Weekly FG Trend</h2>
        <div className="card-note">last 12 weeks · FG units (matched to product master) · label = week start · hover for ISO week &amp; date range</div>
        <WeeklyBars data={weekly} />
      </div>

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">Velocity Distribution</h2>
          <div className="card-note">SKU count by movement class</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Class</th><th className="num">SKUs</th><th className="num">% SKU</th><th className="num">Units (12mo)</th><th className="num">% Vol</th></tr></thead>
              <tbody>
                {movement.map((m, k) => (
                  <tr key={k}>
                    <td><span className={"badge " + String(m.movement_class || "").toLowerCase()}>{m.movement_class}</span></td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{pctOf(m.sku_count, movSku)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                    <td className="num">{pctOf(m.qty_12m, movVol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Pareto ABC Distribution</h2>
          <div className="card-note">tier A should be few SKUs but most volume</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tier</th><th className="num">SKUs</th><th className="num">% SKU</th><th className="num">Units (12mo)</th><th className="num">% Vol</th></tr></thead>
              <tbody>
                {abc.map((m, k) => (
                  <tr key={k}>
                    <td><span className={"badge abc-" + String(m.abc_tier || "").toLowerCase()}>{m.abc_tier}</span></td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{pctOf(m.sku_count, abcSku)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                    <td className="num">{pctOf(m.qty_12m, abcVol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Top 12 SKUs — Revenue Contribution</h2>
        <div className="card-note">
          ranked by 12-month value · monthly sales (last 4 months) · <b>{last4[3] || "current"}* = partial month</b> · Avg/mo = 12-week run-rate → monthly
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th className="num">Revenue</th>
                <th className="num">{last4[0] || "M-3"}</th>
                <th className="num">{last4[1] || "M-2"}</th>
                <th className="num">{last4[2] || "M-1"}</th>
                <th className="num">{last4[3] ? last4[3] + "*" : "M-0"}</th>
                <th className="num">Avg/mo</th>
                <th>ABC-val</th>
                <th>XYZ</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {topValue.map((r, k) => {
                const s = segMap[r.sku_name] || {};
                const rc = recentMap[r.sku_name] || {};
                return (
                  <tr key={k}>
                    <td className="name">
                      <Link href={`/deep-dive?sku=${encodeURIComponent(r.sku_name)}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {r.sku_name}
                      </Link>
                    </td>
                    <td className="num">{rp(r.value_12m)}</td>
                    <td className="num">{fmt(rc.m3_qty)}</td>
                    <td className="num">{fmt(rc.m2_qty)}</td>
                    <td className="num">{fmt(rc.m1_qty)}</td>
                    <td className="num">{fmt(rc.m0_qty)}</td>
                    <td className="num">{fmt(rc.avg_monthly_l3m)}</td>
                    <td><span className={"badge abc-" + String(r.abc_tier_value || "").toLowerCase()}>{r.abc_tier_value}</span></td>
                    <td>{s.xyz_class ? <span className={"badge xyz-" + String(s.xyz_class).toLowerCase()}>{s.xyz_class}</span> : "—"}</td>
                    <td>{s.trend ? <span className={"badge " + String(s.trend).toLowerCase()}>{s.trend}</span> : "—"}</td>
                  </tr>
                );
              })}
              {topValue.length === 0 && (
                <tr><td colSpan={10} style={{ color: "var(--muted)", textAlign: "center", padding: "20px" }}>Tidak ada SKU yang sesuai dengan filter ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">ABC × XYZ Matrix</h2>
          <div className="card-note">SKU count per combination (qty basis)</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>ABC</th><th>XYZ</th><th className="num">SKUs</th><th className="num">Units (12mo)</th></tr></thead>
              <tbody>
                {matrix.map((m, k) => (
                  <tr key={k}>
                    <td><span className={"badge abc-" + String(m.abc_tier || "").toLowerCase()}>{m.abc_tier}</span></td>
                    <td>{m.xyz_class === "N/A" ? <span className="badge na">N/A</span> : <span className={"badge xyz-" + String(m.xyz_class || "").toLowerCase()}>{m.xyz_class}</span>}</td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Momentum Watchlist</h2>
          <div className="card-note">A/B SKUs declining or C SKUs rising</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>SKU</th><th>ABC</th><th className="num">Units (12mo)</th><th>Trend</th></tr></thead>
              <tbody>
                {watch.map((r, k) => (
                  <tr key={k}>
                    <td className="name">
                      <Link href={`/deep-dive?sku=${encodeURIComponent(r.sku_name)}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {r.sku_name}
                      </Link>
                    </td>
                    <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier}</span></td>
                    <td className="num">{fmt(r.qty_12m)}</td>
                    <td><span className={"badge " + String(r.trend || "").toLowerCase()}>{r.trend}</span></td>
                  </tr>
                ))}
                {watch.length === 0 && <tr><td colSpan={4} style={{ color: "var(--muted)", textAlign: "center", padding: "16px" }}>No SKUs on watchlist matching active filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
