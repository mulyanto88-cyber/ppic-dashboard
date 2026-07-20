"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

const NAV = [
  { href: "/", label: "Demand Analytics" },
  { href: "/forecast", label: "Forecast" },
  { href: "/inventory", label: "Inventory Health" },
  { href: "/po-monitoring", label: "PO Monitoring" },
  { href: "/planning", label: "Planning (MPS)" },
  { href: "/schedule", label: "Prod. Schedule" },
  { href: "/mrp", label: "MRP" },
  { href: "/deep-dive", label: "Deep Dive" },
  { href: "/wip", label: "MO Monitoring" },
  { href: "/glossary", label: "Glossary" },
];

export default function Sidebar({ freshness }) {
  const path = usePathname();
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ppic-theme", next);
    } catch (e) {
      /* ignore */
    }
  }

  const timeAgo = (iso) => {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "baru saja";
    if (diff < 3600) return Math.floor(diff / 60) + "m lalu";
    if (diff < 86400) return Math.floor(diff / 3600) + "j lalu";
    return Math.floor(diff / 86400) + "h lalu";
  };

  return (
    <header className="navbar">
      <div className="brand">
        PPIC<span>·Dashboard</span>
      </div>
      <nav className="nav">
        {NAV.map((n) => {
          const active = !n.soon && n.href === path;
          return (
            <Link
              key={n.label}
              href={n.href}
              className={"nav-item" + (active ? " active" : "") + (n.soon ? " soon" : "")}
            >
              {n.label}
              {n.soon && <span className="tag-soon">soon</span>}
            </Link>
          );
        })}
      </nav>
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        title="Toggle light / dark"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "☀" : "🌙"}
      </button>
      <div className="sidebar-foot">
        PT FOOM Lab Global
        {freshness && (
          <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: 4 }}>
            Data: {freshness.snapshotDate || "—"} · {timeAgo(freshness.lastRun)}
          </div>
        )}
      </div>
    </header>
  );
}
