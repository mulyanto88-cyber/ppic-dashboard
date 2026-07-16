"use client";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Demand Analytics" },
  { href: "/forecast", label: "Forecast" },
  { href: "/inventory", label: "Inventory Health" },
  { href: "/po-monitoring", label: "PO Monitoring" },
  { href: "/planning", label: "Planning (MPS)" },
  { href: "/mrp", label: "MRP" },
  { href: "/glossary", label: "Glossary" },
];

export default function Sidebar() {
  const path = usePathname();
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
      <div className="sidebar-foot">PT FOOM Lab Global</div>
    </header>
  );
}
