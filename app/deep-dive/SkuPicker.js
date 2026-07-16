"use client";
import { useState } from "react";

export default function SkuPicker({ skus, current }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const matches = ql ? skus.filter((s) => s.toLowerCase().includes(ql)).slice(0, 12) : [];

  return (
    <div className="card">
      <input
        className="gloss-search"
        placeholder="Search a SKU to drill into…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {matches.length > 0 && (
        <div className="sku-matches">
          {matches.map((s) => (
            <a key={s} href={`/deep-dive?sku=${encodeURIComponent(s)}`} className="sku-match">
              {s}
            </a>
          ))}
        </div>
      )}
      {current && (
        <div className="page-sub" style={{ marginTop: 8 }}>
          Showing: <b>{current}</b>
        </div>
      )}
    </div>
  );
}
