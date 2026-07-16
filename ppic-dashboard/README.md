# PPIC Dashboard

Dashboard Supply Chain / PPIC — PT FOOM Lab Global.
Next.js (App Router) + Vercel, membaca Supabase (schema `ppic`) secara server-side.

## Environment variables (di Vercel)

| Nama | Isi |
|------|-----|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server-side, JANGAN pakai prefix `NEXT_PUBLIC`) |

Dibaca hanya di server (`lib/supabase.js`), tidak pernah dikirim ke browser.

## Struktur

```
app/
  layout.js      # shell + sidebar nav
  page.js        # tab Overview (server component, ambil view KPI)
  globals.css    # styling (plain CSS)
lib/
  supabase.js    # helper fetch ke PostgREST schema ppic
```

## Deploy

1. Push repo ini ke GitHub.
2. Di Vercel: New Project → import repo → framework auto-detect **Next.js**.
3. Tambah 2 environment variable di atas (Production & Preview).
4. Deploy.

Data diambil live tiap request (`force-dynamic`), jadi begitu ETL memperbarui
Supabase, dashboard ikut terbarui tanpa rebuild.
