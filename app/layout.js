import "./globals.css";
import { Inter } from "next/font/google";
import Sidebar from "./Sidebar";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

export const metadata = {
  title: "PPIC Dashboard",
  description: "Supply Chain / PPIC Dashboard — PT FOOM Lab Global",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        <div className="layout">
          <Sidebar />
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
