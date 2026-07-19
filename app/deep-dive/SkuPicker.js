"use client";
import { useState } from "react";
import Link from "next/link";

export default function SkuPicker({ items, current }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const matches = ql ? items.filter((item) => (item.name || "").toLowerCase().includes(ql)).slice(0, 15) : [];

  return (
    <div className="card" style={{ position: "relative" }}>
      <input
        className="gloss-search"
        placeholder="Search FG SKU or RMPM Material to drill into…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", padding: "10px 12px 10px 36px", fontSize: "14px", margin: 0 }}
      />
      <span style={{ position: "absolute", left: "24px", top: "24px", color: "var(--muted)" }}>🔍</span>
      {matches.length > 0 && (
        <div className="sku-matches" style={{ zIndex: 10 }}>
          {matches.map((item) => (
            <Link 
              key={item.name} 
              href={`/deep-dive?sku=${encodeURIComponent(item.name)}`} 
              className="sku-match"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none" }}
            >
              <span style={{ fontWeight: 600 }}>{item.name}</span>
              <span className={"badge " + (item.type === "FG" ? "growing" : "method")} style={{ fontSize: "10px", padding: "2px 6px" }}>
                {item.type}
              </span>
            </Link>
          ))}
        </div>
      )}
      {current && (
        <div className="page-sub" style={{ marginTop: 8 }}>
          Active Selection: <b>{current}</b>
        </div>
      )}
    </div>
  );
}
