// Shared formatters — English (en-US), professional SCM.
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function fmt(n) {
  if (n === null || n === undefined || n === "") return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(Number(n)));
}

// Rupiah, abbreviated in ENGLISH scale: K / M(illion) / B(illion) / T(rillion)
export function rp(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return "Rp " + (v / 1e12).toFixed(2) + "T";
  if (a >= 1e9)  return "Rp " + (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6)  return "Rp " + (v / 1e6).toFixed(1) + "M";
  if (a >= 1e3)  return "Rp " + (v / 1e3).toFixed(0) + "K";
  return "Rp " + fmt(v);
}

export function ym(dstr) {
  const d = new Date(dstr);
  if (isNaN(d)) return dstr;
  return MON[d.getMonth()] + " '" + String(d.getFullYear()).slice(2);
}

export function pct(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(1) + "%";
}
