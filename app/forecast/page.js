import { sb } from "../../lib/supabase";
import { fmt, ym, pct } from "../../lib/format";

export const dynamic = "force-dynamic";

function BarChart({ data, valueKey, labelKey, showVal }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="barchart">
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        return (
          <div className="bar-col" key={i}>
            {showVal && <div className="bar-val">{fmt(v)}</div>}
            <div className="bar hl" style={{ height: (v / max) * 100 + "%" }} />
            <div className="bar-label">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default async function Forecast() {
  let accW = {}, fcRows = [], accSku = [], val = [], error = null;
  try {
    const [a, b, c, d] = await Promise.all([
      sb("v_forecast_accuracy_weighted?select=*"),
      sb("v_forecast_monthly?select=*&order=forecast_month.asc"),
      sb("v_forecast_accuracy_sku?select=*"),
      sb("v_sku_value?select=sku_name,value_12m,abc_tier_value&order=value_12m.desc"),
    ]);
    accW = (a && a[0]) || {}; fcRows = b || []; accSku = c || []; val = d || [];
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="card error">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
        <p>Make sure migrations 0008–0010 have been run in Supabase.</p>
      </div>
    );
  }

  const wmapeWma = Number(accW.wmape_wma || 0);
  const accuracy = 100 - wmapeWma;

  const months = [...new Set(fcRows.map((r) => r.forecast_month))].sort();
  const totalByMonth = months.map((m) => ({
    _lbl: ym(m),
    total: fcRows.filter((r) => r.forecast_month === m).reduce((s, r) => s + Number(r.forecast_qty || 0), 0),
  }));

  const fcMap = {};
  for (const r of fcRows) {
    if (!fcMap[r.sku_name]) fcMap[r.sku_name] = { months: {}, method: r.method, hist: r.hist_months };
    fcMap[r.sku_name].months[r.forecast_month] = r.forecast_qty;
  }
  const accSkuMap = {};
  for (const r of accSku) accSkuMap[r.sku_name] = r.mape_wma;

  const topRows = val.filter((v) => fcMap[v.sku_name]).slice(0, 20);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Forecast</h1>
          <div className="page-sub">WMA method (0.6 / 0.3 / 0.1) · Active FG · 3-month horizon</div>
        </div>
        <a className="btn-export" href="/api/export?view=v_forecast_monthly">↓ Export CSV</a>
      </div>

      <section className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Forecast Accuracy</div>
          <div className="kpi-value" style={{ color: accuracy >= 80 ? "var(--green)" : "var(--amber)" }}>
            {pct(accuracy)}
          </div>
          <div className="kpi-sub">target ≥ 80% · wMAPE basis</div>
        </div>
        <div className="card">
          <div className="kpi-label">Method</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>WMA</div>
          <div className="kpi-sub">weights 0.6 / 0.3 / 0.1</div>
        </div>
        <div className="card">
          <div className="kpi-label">Forecast {months[0] ? ym(months[0]) : ""}</div>
          <div className="kpi-value">{fmt(totalByMonth[0] ? totalByMonth[0].total : 0)}</div>
          <div className="kpi-sub">total units (all SKUs)</div>
        </div>
        <div className="card">
          <div className="kpi-label">SKUs Forecasted</div>
          <div className="kpi-value">{fmt(Object.keys(fcMap).length)}</div>
          <div className="kpi-sub">Active FG</div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2 className="card-title">Total Forecast by Month</h2>
          <div className="card-note">total units · all SKUs · next 3 months</div>
          <BarChart data={totalByMonth} valueKey="total" labelKey="_lbl" showVal />
        </div>

        <div className="card">
          <h2 className="card-title">Accuracy by Method (backtest)</h2>
          <div className="card-note">wMAPE — lower is better · WMA wins</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Method</th><th className="num">wMAPE</th><th className="num">Accuracy</th></tr></thead>
              <tbody>
                <tr><td>Naive</td><td className="num">{pct(accW.wmape_naive)}</td><td className="num">{pct(100 - Number(accW.wmape_naive || 0))}</td></tr>
                <tr><td>SMA-3</td><td className="num">{pct(accW.wmape_sma3)}</td><td className="num">{pct(100 - Number(accW.wmape_sma3 || 0))}</td></tr>
                <tr style={{ fontWeight: 700 }}>
                  <td><span className="badge growing">WMA</span></td>
                  <td className="num">{pct(accW.wmape_wma)}</td>
                  <td className="num">{pct(accuracy)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="card">
        <h2 className="card-title">Forecast by SKU — Top 20 (by revenue)</h2>
        <div className="card-note">next 3 months · accuracy = 100 − per-SKU MAPE (backtest)</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>ABC (value)</th>
                {months.map((m) => <th className="num" key={m}>{ym(m)}</th>)}
                <th className="num">Accuracy</th>
                <th className="num">History</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((v, i) => {
                const fc = fcMap[v.sku_name];
                const mape = accSkuMap[v.sku_name];
                const acc = mape === undefined ? null : 100 - Number(mape);
                return (
                  <tr key={i}>
                    <td className="name">{v.sku_name}</td>
                    <td><span className={"badge abc-" + String(v.abc_tier_value || "").toLowerCase()}>{v.abc_tier_value}</span></td>
                    {months.map((m) => <td className="num" key={m}>{fmt(fc.months[m])}</td>)}
                    <td className="num" style={acc !== null ? { color: acc >= 80 ? "var(--green)" : acc >= 60 ? "var(--amber)" : "var(--red)" } : {}}>
                      {acc === null ? "—" : pct(acc)}
                    </td>
                    <td className="num">{fmt(fc.hist)} mo</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
