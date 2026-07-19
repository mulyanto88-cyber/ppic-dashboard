"use client";
import Link from "next/link";

export default function Pager({ page, pages, total, perPage, onPage }) {
  if (pages <= 1) return null;
  const start = page * perPage + 1;
  const end = Math.min(total, (page + 1) * perPage);

  return (
    <div className="pager" style={{
      display: "flex", alignItems: "center", justifyContent: "flex-end",
      gap: "12px", padding: "10px 0", fontSize: "13px"
    }}>
      <span className="pager-info" style={{ color: "var(--muted)" }}>
        {start}–{end} of {total.toLocaleString()}
      </span>
      <div style={{ display: "flex", gap: "4px" }}>
        <button
          className="gloss-pill"
          disabled={page === 0}
          onClick={() => onPage(0)}
        >
          «
        </button>
        <button
          className="gloss-pill"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          ‹
        </button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          let num;
          if (pages <= 7) {
            num = i;
          } else if (page <= 3) {
            num = i;
          } else if (page >= pages - 4) {
            num = pages - 7 + i;
          } else {
            num = page - 3 + i;
          }
          return (
            <button
              key={num}
              className="gloss-pill"
              disabled={num === page}
              onClick={() => onPage(num)}
              style={num === page ? { background: "var(--accent)", color: "#fff" } : {}}
            >
              {num + 1}
            </button>
          );
        })}
        <button
          className="gloss-pill"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          ›
        </button>
        <button
          className="gloss-pill"
          disabled={page >= pages - 1}
          onClick={() => onPage(pages - 1)}
        >
          »
        </button>
      </div>
    </div>
  );
}
