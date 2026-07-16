import "./globals.css";
import Sidebar from "./Sidebar";

export const metadata = {
  title: "PPIC Dashboard",
  description: "Supply Chain / PPIC Dashboard — PT FOOM Lab Global",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <div className="layout">
          <Sidebar />
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
