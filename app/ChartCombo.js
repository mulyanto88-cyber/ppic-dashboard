"use client";
import { useState } from "react";
import { fmt, rp, fmtC } from "../lib/format";

// Combo: revenue bars + units line, dengan hover tooltip (angka pasti).
export default function ChartCombo({ data }) {
  const [hi, setHi] = useState(-1);
  const W = 760, H = 210, padX = 10, padTop = 14, padBottom = 24;
  const n = data.length || 1;
  const plotH = H - padTop - padBottom;
  const maxRev = Math.max(1, ...data.map((d) => Number(d.revenue_idr) || 0));
  const maxQty = Math.max(1, ...data.map((d) => Number(d.qty) || 0));
  const slot = (W - padX * 2) / n;
  const qy = (v) => padTop + plotH - ((Number(v) || 0) / maxQty) * plotH;
  const pts = data.map((d, i) => [padX + slot * i + slot / 2, qy(d.qty)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const hd = hi >= 0 ? data[hi] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {data.map((d, i) => {
          const h = ((Number(d.revenue_idr) || 0) / maxRev) * plotH;
          return (
            <rect key={i} x={padX + slot * i + slot * 0.22} y={padTop + plotH - h}
              width={slot * 0.56} height={h} rx="2.5"
              style={{ fill: "var(--accent)", opacity: hi === i ? 0.9 : 0.5, transition: "all 0.2s ease-in-out" }} />
          );
        })}
        <path d={path} style={{ fill: "none", stroke: "var(--green)", strokeWidth: 2 }} />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={hi === i ? 4 : 2.6} style={{ fill: "var(--green)" }} />)}
        {/* Qty label langsung di atas titik garis */}
        {pts.map((p, i) => (
          <text key={"q" + i} x={p[0]} y={p[1] - 7}
            style={{ fontSize: 8.5, fill: "var(--green)", fontWeight: 600 }} textAnchor="middle">
            {fmtC(data[i].qty)}
          </text>
        ))}
        {data.map((d, i) =>
          n <= 12 || i % 2 === 0 ? (
            <text key={i} x={padX + slot * i + slot / 2} y={H - 8}
              style={{ fontSize: 9, fill: "var(--muted)" }} textAnchor="middle">{d._lbl}</text>
          ) : null
        )}
        {data.map((d, i) => (
          <rect key={"h" + i} x={padX + slot * i} y={0} width={slot} height={H}
            fill="transparent" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)} />
        ))}
      </svg>
      {hd && (
        <div className="chart-tip">
          <b>{hd._lbl}</b>
          <div>Revenue: {rp(hd.revenue_idr)}</div>
          <div>Units: {fmt(hd.qty)}</div>
        </div>
      )}
      <div className="legend">
        <span className="lg-accent">Revenue (IDR)</span>
        <span className="lg-green">Units delivered</span>
      </div>
    </div>
  );
}
