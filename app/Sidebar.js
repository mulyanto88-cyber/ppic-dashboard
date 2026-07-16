"use client";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Demand Analytics" },
  { href: "/forecast", label: "Forecast" },
  { href: "/glossary", label: "Glossary" },
  { href: "#", label: "Inventory", soon: true },
  { href: "#", label: "Planning", soon: true },
  { href: "#", label: "MRP", soon: true },
  { href: "#", label: "Procurement", soon: true },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
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
    </aside>
  );
}
