# Arsitektur M1–M2

## Batas sistem

Implementasi menggunakan modular monolith Next.js 16. Presentation, autentikasi, dan data
access berada dalam satu aplikasi; PostgreSQL, Auth, dan policy data dikelola Supabase.
Milestone ini belum memiliki endpoint laporan, media, Gemini, tugas, peta, atau analitik.

```text
Browser
  -> Next.js public/auth UI
  -> Server Actions (login, daftar, recovery, logout)
  -> server-only access context (claims + minimal profile/membership DTO)
  -> user-scoped Supabase client
  -> PostgreSQL grants + RLS
```

`proxy.ts` hanya menyegarkan token Supabase melalui `getClaims()` dan menambahkan header
`Cache-Control: private, no-store` untuk route privat. Proxy bukan lapisan authorization.
Setiap protected page membaca ulang identity, profile, role, dan membership dari server.

## Struktur tanggung jawab

- `src/app/`: route dan composition Server Components.
- `src/components/`: primitive form, feedback, dan layout reusable.
- `src/features/auth/`: Server Actions dan form autentikasi.
- `src/features/areas/`: tipe dan keputusan akses role/wilayah yang pure dan teruji.
- `src/integrations/supabase/`: browser client, server client, dan refresh session.
- `src/lib/auth/`: safe redirect dan data-access helper server-only.
- `src/lib/validation/`: schema Zod bersama.
- `supabase/migrations/`: schema, trigger provisioning, grants, dan RLS.
- `supabase/tests/`: 53 assertion pgTAP untuk grants, matrix role/area, dan abuse cases.
- `scripts/verify-m2-live.mjs`: Auth/JWT/RLS/recovery verifier yang menolak target non-local.
- `e2e/`: browser checks untuk accessibility, responsive layout, dan live SSR auth.

## Alur identitas

1. Form auth memvalidasi input dengan Zod pada Server Action.
2. Supabase Auth menjadi sumber identity; role dari request body tidak pernah diterima.
3. Trigger `auth.users` membuat `profiles` dengan role database default `resident`.
4. Data-access helper memvalidasi JWT melalui `getClaims()` lalu mengambil profile dan
   membership melalui user-scoped client.
5. Pure authorization helper memerlukan role dan membership type yang sesuai serta
   `verified_at` non-null.
6. Trigger database menjaga kecocokan role dan tipe membership.
7. Helper policy area mengikat `auth.uid()`, role profile, tipe membership, area, dan
   `verified_at`; RLS dan grants tetap membatasi query walaupun UI dilewati.

## Perilaku route

- `/app/beranda`: akun resident; tanpa membership menampilkan status menunggu persetujuan.
- `/kader/ringkasan`: role `cadre` + membership `assigned_cadre` terverifikasi.
- `/pengelola/ringkasan`: role `manager` + membership `manager` terverifikasi.
- Role salah diarahkan ke `/forbidden`; user tanpa session diarahkan ke login.
- Kegagalan konfigurasi/data menghasilkan state unavailable yang fail closed.

## Evolusi milestone berikutnya

Reports dan ActionLoop harus menggunakan data-access boundary yang sama, menambahkan
repository/service per use case, dan melakukan transisi atomik melalui PostgreSQL RPC bila
beberapa write harus menjadi satu transaksi. Tidak boleh mengubah status lewat PATCH umum.
