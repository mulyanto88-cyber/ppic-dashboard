import "./globals.css";
import { Inter } from "next/font/google";
import Sidebar from "./Sidebar";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

export const metadata = {
  title: "PPIC Dashboard",
  description: "Supply Chain / PPIC Dashboard — PT FOOM Lab Global",
};

const themeScript = `try{var t=localStorage.getItem('ppic-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="layout">
          <Sidebar />
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
