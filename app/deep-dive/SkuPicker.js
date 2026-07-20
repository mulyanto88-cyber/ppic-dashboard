"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SkuPicker({ items, current }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const ql = q.trim().toLowerCase();
  const matches = ql ? items.filter((item) => (item.name || "").toLowerCase().includes(ql)).slice(0, 15) : [];

  const handleNavigate = (targetName) => {
    setQ("");
    setSelectedIndex(-1);
    router.push(`/deep-dive?sku=${encodeURIComponent(targetName)}`);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;

    // 1. Check for exact match (case insensitive)
    const exact = matches.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
    if (exact) {
      handleNavigate(exact.name);
      return;
    }

    // 2. Check for arrow-key selected index
    if (selectedIndex >= 0 && selectedIndex < matches.length) {
      handleNavigate(matches[selectedIndex].name);
      return;
    }

    // 3. Fallback to top match or raw query
    if (matches.length > 0) {
      handleNavigate(matches[0].name);
      return;
    }

    handleNavigate(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < matches.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : matches.length - 1));
    } else if (e.key === "Escape") {
      setQ("");
      setSelectedIndex(-1);
    }
  };

  return (
    <div className="card" style={{ position: "relative" }}>
      <form onSubmit={handleSubmit} style={{ margin: 0, width: "100%" }}>
        <div style={{ position: "relative", width: "100%" }}>
          <input
            className="gloss-search"
            placeholder="Search FG SKU or RMPM Material to drill into… (Paste & press Enter)"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            style={{ width: "100%", padding: "10px 36px 10px 36px", fontSize: "14px", margin: 0 }}
          />
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }}>🔍</span>
          {q && (
            <button
              type="button"
              onClick={() => { setQ(""); setSelectedIndex(-1); }}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: "14px",
                padding: "4px"
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {matches.length > 0 && (
        <div className="sku-matches" style={{ zIndex: 10 }}>
          {matches.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Link 
                key={item.name} 
                href={`/deep-dive?sku=${encodeURIComponent(item.name)}`} 
                className={"sku-match" + (isSelected ? " pick-active" : "")}
                onClick={() => { setQ(""); setSelectedIndex(-1); }}
                style={{ 
                  display: "flex", 
                  justify: "space-between", 
                  alignItems: "center", 
                  textDecoration: "none",
                  background: isSelected ? "var(--accent-soft)" : undefined
                }}
              >
                <span style={{ fontWeight: 600 }}>{item.name}</span>
                <span className={"badge " + (item.type === "FG" ? "growing" : "method")} style={{ fontSize: "10px", padding: "2px 6px" }}>
                  {item.type}
                </span>
              </Link>
            );
          })}
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
