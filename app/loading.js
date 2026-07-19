export default function Loading() {
  return (
    <main className="page">
      <div className="page-head">
        <h1 className="page-title">Loading…</h1>
      </div>
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div className="spinner" style={{
          width: 32, height: 32, border: "3px solid var(--border)",
          borderTopColor: "var(--accent)", borderRadius: "50%",
          animation: "spin 0.8s linear infinite", margin: "0 auto 12px"
        }} />
        <p style={{ color: "var(--muted)", fontSize: "14px" }}>Fetching data from Supabase…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
}
