import "./globals.css";

export const metadata = {
  title: "PPIC Dashboard",
  description: "Supply Chain / PPIC Dashboard — PT FOOM Lab Global",
};

// Tab aktif = Sales & Demand ("/"). Tab lain menyusul (butuh data stok yg benar).
const NAV = [
  { href: "/", label: "Sales & Demand", active: true },
  { href: "#", label: "Inventory Health", soon: true },
  { href: "#", label: "MPS & Planning", soon: true },
  { href: "#", label: "Forecast", soon: true },
  { href: "#", label: "Glossary", soon: true },
];

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">
              PPIC<span>·Dashboard</span>
            </div>
            <nav className="nav">
              {NAV.map((n) => (
                <a
                  key={n.label}
                  href={n.href}
                  className={
                    "nav-item" +
                    (n.active ? " active" : "") +
                    (n.soon ? " soon" : "")
                  }
                >
                  {n.label}
                  {n.soon && <span className="tag-soon">segera</span>}
                </a>
              ))}
            </nav>
            <div className="sidebar-foot">PT FOOM Lab Global</div>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
