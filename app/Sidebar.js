"use client";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV = [
  { href: "/", label: "Demand Analytics" },
  { href: "/forecast", label: "Forecast" },
  { href: "/inventory", label: "Inventory Health" },
  { href: "/po-monitoring", label: "PO Monitoring" },
  { href: "/planning", label: "Planning (MPS)" },
  { href: "/mrp", label: "MRP" },
  { href: "/deep-dive", label: "Deep Dive" },
  { href: "/glossary", label: "Glossary" },
];

export default function Sidebar() {
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

  return (
    <header className="navbar">
      <div className="brand">
        PPIC<span>·Dashboard</span>
      </div>
      <nav className="nav">
        {NAV.map((n) => {
          const active = !n.soon && n.href === path;
          return (
            <a
              key={n.label}
              href={n.href}
              className={"nav-item" + (active ? " active" : "") + (n.soon ? " soon" : "")}
            >
              {n.label}
              {n.soon && <span className="tag-soon">soon</span>}
            </a>
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
      <div className="sidebar-foot">PT FOOM Lab Global</div>
    </header>
  );
}
