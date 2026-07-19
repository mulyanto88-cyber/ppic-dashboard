"use client";
import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <main className="page">
      <div className="page-head">
        <h1 className="page-title">Something went wrong</h1>
      </div>
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ color: "var(--danger)", fontSize: "14px", marginBottom: 16 }}>
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        <button
          onClick={() => reset()}
          className="btn"
          style={{
            padding: "10px 24px", background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 6, cursor: "pointer", fontSize: "14px"
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
