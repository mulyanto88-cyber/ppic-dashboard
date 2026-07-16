import { sb } from "../lib/supabase";

export const dynamic = "force-dynamic";

/* ---------- formatters ---------- */
const MON = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
function fmt(n) {
  if (n === null || n === undefined || n === "") return "—";
  return new Intl.NumberFormat("id-ID").format(Math.round(Number(n)));
}
function rp(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return "Rp " + (v / 1e12).toFixed(2).replace(".", ",") + " T";
  if (a >= 1e9)  return "Rp " + (v / 1e9).toFixed(2).replace(".", ",") + " M";
  if (a >= 1e6)  return "Rp " + (v / 1e6).toFixed(1).replace(".", ",") + " jt";
  return "Rp " + fmt(v);
}
function ym(dstr) {
  const d = new Date(dstr);
  if (isNaN(d)) return dstr;
  return MON[d.getMonth()] + " " + String(d.getFullYear()).slice(2);
}

/* ---------- CSS bar chart ---------- */
function BarChart({ data, valueKey, labelKey, showVal, fmtVal, highlight }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="barchart">
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const hl = highlight ? highlight(d, i) : false;
        return (
          <div className="bar-col" key={i}>
            {showVal && <div className="bar-val">{fmtVal ? fmtVal(v) : fmt(v)}</div>}
            <div className={"bar" + (hl ? " hl" : "")} style={{ height: (v / max) * 100 + "%" }} />
            <div className="bar-label">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default async function SalesDemand() {
  let revenue = [], payday = [], skuValue = [], seg = [], matrix = [], movement = [], watch = [];
  let error = null;
  try {
    const [a, b, c, d, e, f, g] = await Promise.all([
      sb("v_revenue_monthly?select=*&order=month.asc"),
      sb("v_payday_pattern?select=*&order=week_of_month.asc"),
      sb("v_sku_value?select=*&order=value_12m.desc"),
      sb("v_sku_segmentation?select=sku_name,abc_tier,movement_class,xyz_class,trend"),
      sb("v_sku_segmentation_summary?select=*"),
      sb("v_sku_movement_summary?select=*"),
      sb("v_sku_trend_watch?select=*&limit=12"),
    ]);
    revenue = a || []; payday = b || []; skuValue = c || []; seg = d || [];
    matrix = e || []; movement = f || []; watch = g || [];
  } catch (err) {
    error = err.message;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Gagal memuat data</h2>
        <pre>{error}</pre>
        <p>
          Cek env <code>SUPABASE_URL</code> &amp; <code>SUPABASE_SERVICE_ROLE_KEY</code> di
          Vercel, dan schema <code>ppic</code> ada di Exposed schemas.
        </p>
      </div>
    );
  }

  /* ---- KPIs from value view ---- */
  const totalValue = skuValue.reduce((s, r) => s + Number(r.value_12m || 0), 0);
  const totalQty = skuValue.reduce((s, r) => s + Number(r.qty_12m || 0), 0);
  const avgPrice = totalQty > 0 ? totalValue / totalQty : 0;
  const nA = skuValue.filter((r) => r.abc_tier_value === "A").length;
  const lastMonth = revenue.length ? revenue[revenue.length - 1].month : null;

  /* ---- merge segmentation into top-value table ---- */
  const segMap = {};
  for (const s of seg) segMap[s.sku_name] = s;
  const topValue = skuValue.slice(0, 12);

  const rev18 = revenue.slice(-18).map((r) => ({ ...r, _lbl: ym(r.month) }));

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Sales &amp; Demand</h1>
        <div className="page-sub">
          FG status Continue · data s/d {lastMonth ? ym(lastMonth) : "—"} · basis 12 bulan
        </div>
      </div>

      {/* KPI row */}
      <section className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Revenue 12 bln</div>
          <div className="kpi-value">{rp(totalValue)}</div>
          <div className="kpi-sub">nilai penjualan (Rp)</div>
        </div>
        <div className="card">
          <div className="kpi-label">Qty 12 bln</div>
          <div className="kpi-value">{fmt(totalQty)}</div>
          <div className="kpi-sub">unit terkirim</div>
        </div>
        <div className="card">
          <div className="kpi-label">Harga rata-rata</div>
          <div className="kpi-value">{rp(avgPrice)}</div>
          <div className="kpi-sub">per unit</div>
        </div>
        <div className="card">
          <div className="kpi-label">SKU aktif</div>
          <div className="kpi-value">{fmt(skuValue.length)}</div>
          <div className="kpi-sub">{fmt(nA)} tier A (value)</div>
        </div>
      </section>

      {/* Revenue trend */}
      <div className="card">
        <h2 className="card-title">Tren Revenue Bulanan</h2>
        <div className="card-note">18 bulan terakhir · nilai penjualan (Rp)</div>
        <BarChart data={rev18} valueKey="revenue_idr" labelKey="_lbl" />
      </div>

      <section className="grid-2">
        {/* Payday */}
        <div className="card">
          <h2 className="card-title">Pola Payday (minggu-dalam-bulan)</h2>
          <div className="card-note">rata-rata qty/minggu · 12 bln · hijau = zona payday (≥ tgl 22)</div>
          <div className="payday">
            <BarChart
              data={payday}
              valueKey="avg_qty"
              labelKey="week_of_month"
              showVal
              highlight={(d) => /payday|29\+/.test(String(d.week_of_month))}
            />
          </div>
        </div>

        {/* Movement distribution */}
        <div className="card">
          <h2 className="card-title">Distribusi Velocity</h2>
          <div className="card-note">jumlah SKU per kelas kecepatan gerak</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Kelas</th><th className="num">SKU</th><th className="num">Qty 12 bln</th></tr></thead>
              <tbody>
                {movement.map((m, i) => (
                  <tr key={i}>
                    <td><span className={"badge " + String(m.movement_class || "").toLowerCase()}>{m.movement_class}</span></td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Top SKU by value */}
      <div className="card">
        <h2 className="card-title">Top 12 SKU — Kontribusi Revenue</h2>
        <div className="card-note">urut dari nilai penjualan (Rp) 12 bulan tertinggi</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th className="num">Revenue</th>
                <th className="num">Qty</th>
                <th className="num">Harga/unit</th>
                <th>ABC (value)</th>
                <th>XYZ</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {topValue.map((r, i) => {
                const s = segMap[r.sku_name] || {};
                return (
                  <tr key={i}>
                    <td className="name">{r.sku_name}</td>
                    <td className="num">{rp(r.value_12m)}</td>
                    <td className="num">{fmt(r.qty_12m)}</td>
                    <td className="num">{rp(r.avg_price_idr)}</td>
                    <td><span className={"badge abc-" + String(r.abc_tier_value || "").toLowerCase()}>{r.abc_tier_value}</span></td>
                    <td>{s.xyz_class ? <span className={"badge xyz-" + String(s.xyz_class).toLowerCase()}>{s.xyz_class}</span> : "—"}</td>
                    <td>{s.trend ? <span className={"badge " + String(s.trend).toLowerCase()}>{s.trend}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <section className="grid-2">
        {/* ABC x XYZ matrix */}
        <div className="card">
          <h2 className="card-title">Matriks ABC × XYZ</h2>
          <div className="card-note">jumlah SKU per kombinasi (basis qty)</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>ABC</th><th>XYZ</th><th className="num">SKU</th><th className="num">Qty 12 bln</th></tr></thead>
              <tbody>
                {matrix.map((m, i) => (
                  <tr key={i}>
                    <td><span className={"badge abc-" + String(m.abc_tier || "").toLowerCase()}>{m.abc_tier}</span></td>
                    <td>{m.xyz_class === "N/A" ? <span className="badge na">N/A</span> : <span className={"badge xyz-" + String(m.xyz_class || "").toLowerCase()}>{m.xyz_class}</span>}</td>
                    <td className="num">{fmt(m.sku_count)}</td>
                    <td className="num">{fmt(m.qty_12m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trend watchlist */}
        <div className="card">
          <h2 className="card-title">Watchlist Momentum</h2>
          <div className="card-note">SKU A/B melemah atau C sedang naik</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>SKU</th><th>ABC</th><th className="num">Qty 12 bln</th><th>Trend</th></tr></thead>
              <tbody>
                {watch.map((r, i) => (
                  <tr key={i}>
                    <td className="name">{r.sku_name}</td>
                    <td><span className={"badge abc-" + String(r.abc_tier || "").toLowerCase()}>{r.abc_tier}</span></td>
                    <td className="num">{fmt(r.qty_12m)}</td>
                    <td><span className={"badge " + String(r.trend || "").toLowerCase()}>{r.trend}</span></td>
                  </tr>
                ))}
                {watch.length === 0 && (
                  <tr><td colSpan={4} style={{ color: "var(--muted)" }}>Tak ada SKU pada watchlist.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
