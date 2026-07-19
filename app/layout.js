import "./globals.css";
import { Inter } from "next/font/google";
import Sidebar from "./Sidebar";
import { sb } from "../lib/supabase";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

export const metadata = {
  title: "PPIC Dashboard",
  description: "Supply Chain / PPIC Dashboard — PT FOOM Lab Global",
};

const themeScript = `try{var t=localStorage.getItem('ppic-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

async function getFreshness() {
  try {
    const logs = await sb("etl_load_log?select=dataset,snapshot_date,loaded_at&order=loaded_at.desc&limit=10");
    if (!logs || logs.length === 0) return null;
    const latest = logs[0];
    const datasets = [...new Set(logs.map((l) => l.dataset))];
    const maxDate = logs.reduce((max, l) => {
      const d = l.snapshot_date || l.loaded_at?.split("T")[0];
      return d > max ? d : max;
    }, "");
    return {
      lastRun: latest.loaded_at,
      snapshotDate: maxDate,
      datasetCount: datasets.length,
    };
  } catch (e) {
    return null;
  }
}

export default async function RootLayout({ children }) {
  const freshness = await getFreshness();

  return (
    <html lang="id" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="layout">
          <Sidebar freshness={freshness} />
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
