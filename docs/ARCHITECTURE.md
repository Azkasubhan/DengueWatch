# Arsitektur M1–M3

## Batas sistem

Implementasi menggunakan modular monolith Next.js 16. Presentation, autentikasi, dan data
access berada dalam satu aplikasi; PostgreSQL, Auth, dan policy data dikelola Supabase.
M3 menambahkan laporan lingkungan dan media privat. Gemini, tugas, peta, dan analitik
belum diimplementasikan.

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
- `src/features/reports/`: validasi, normalisasi foto, data access, dan form laporan.
- `src/app/api/v1/`: upload sementara serta create/list/detail laporan.
- `supabase/tests/reports.sql`: 47 assertion pgTAP untuk laporan, foto, event, quota, dan policy.

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
- `/app/laporan`, `/app/laporan/buat`, `/app/laporan/[id]`: alur warga dengan data dari
  PostgreSQL dan Storage privat.

## Alur laporan M3

1. Browser memilih 1–3 foto; Route Handler memvalidasi file, decode, lalu mengonversi ke
   WebP tanpa metadata. Server menyimpan objek di bucket privat dan membuat lease upload
   milik user selama satu jam. Secret key hanya dipakai di server untuk staging/cleanup.
2. Form memvalidasi payload, menampilkan preview, lalu mengirim `Idempotency-Key`.
3. Route Handler memverifikasi session, role, dan membership. RPC PostgreSQL memakai
   `auth.uid()` dan RLS/role helper sebagai batas akhir; report, image links, event, dan
   idempotency record dibuat dalam satu transaksi.
4. List/detail memakai user-scoped Supabase client. Detail membuat signed URL 60 detik
   setelah report dan image row lolos RLS. URL merupakan bearer link yang berlaku sampai
   kedaluwarsa; jangan mencatat atau membagikannya.
5. Unggahan yang ditinggalkan dapat dihapus pemilik atau cleanup lokal setelah lease
   kedaluwarsa. Ledger percobaan tetap menghitung upload walaupun lease dihapus, sehingga
   batas 30/jam tidak dapat dihindari lewat pola upload/hapus. Cleanup produksi harus
   dijadwalkan sebelum deployment publik.

## Evolusi milestone berikutnya

M4 dapat menambahkan transisi terverifikasi melalui RPC khusus dan memperluas enum event.
Status laporan tidak mempunyai endpoint PATCH umum pada M3.
