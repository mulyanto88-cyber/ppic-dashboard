"use client";
import { useState } from "react";
import { fmt, dmon, weekEnd } from "../lib/format";

export default function WeeklyBars({ data }) {
  const [hi, setHi] = useState(-1);
  const max = Math.max(1, ...data.map((d) => Number(d.qty) || 0));
  const hd = hi >= 0 ? data[hi] : null;
  return (
    <div style={{ position: "relative" }}>
      <div className="barchart">
        {data.map((d, i) => {
          const v = Number(d.qty) || 0;
          return (
            <div className="bar-col" key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)}>
              <div className="bar-val">{fmt(v)}</div>
              <div className="bar hl" style={{ height: (v / max) * 100 + "%", opacity: hi === i ? 1 : 0.82, transition: "all 0.2s ease-in-out" }} />
              <div className="bar-label">{dmon(d.week_start)}</div>
            </div>
          );
        })}
      </div>
      {hd && (
        <div className="chart-tip">
          <b>W{hd.iso_week}</b>
          <div>{dmon(hd.week_start)} – {weekEnd(hd.week_start)}</div>
          <div>Units: {fmt(hd.qty)}</div>
        </div>
      )}
    </div>
  );
}
