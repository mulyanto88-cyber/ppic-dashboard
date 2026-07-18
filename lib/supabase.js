// Helper baca Supabase dari SERVER (service_role tidak pernah ke browser).
// Pakai fetch biasa ke PostgREST, target schema `ppic` via header Accept-Profile.

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Ambil data dari sebuah view/tabel di schema ppic.
 * @param {string} pathAndQuery contoh: "v_sku_movement_summary?select=*"
 * @returns {Promise<any[]>}
 */
export async function sb(pathAndQuery, { schema = "ppic" } = {}) {
  if (!BASE || !KEY) {
    throw new Error(
      "Environment SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set."
    );
  }
  const res = await fetch(`${BASE.replace(/\/$/, "")}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Accept-Profile": schema,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Ambil SEMUA baris dengan paginasi (limit+offset per 1000).
 * WAJIB dipakai untuk sumber >1000 baris — PostgREST diam-diam memotong di 1000
 * (terbukti: v_stock_position 1.428, material_master 1.030 baris).
 */
export async function sbAll(pathAndQuery, { schema = "ppic", chunk = 1000 } = {}) {
  const out = [];
  for (let offset = 0; ; offset += chunk) {
    const sep = pathAndQuery.includes("?") ? "&" : "?";
    const rows = await sb(`${pathAndQuery}${sep}limit=${chunk}&offset=${offset}`, { schema });
    out.push(...rows);
    if (rows.length < chunk) break;
  }
  return out;
}

/**
 * Tulis ke schema ppic (INSERT / DELETE). Server-only (service_role).
 * @param {string} pathAndQuery contoh: "forecast_log?run_date=eq.2026-07-17"
 * @param {any} body array baris utk POST; null utk DELETE.
 */
export async function sbWrite(pathAndQuery, body, { method = "POST", schema = "ppic", prefer } = {}) {
  if (!BASE || !KEY) throw new Error("Environment SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set.");
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    "Content-Profile": schema,
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${BASE.replace(/\/$/, "")}/rest/v1/${pathAndQuery}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase ${res.status}: ${t.slice(0, 300)}`);
  }
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}
