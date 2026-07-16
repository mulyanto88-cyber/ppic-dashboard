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
