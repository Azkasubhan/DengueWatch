# DengueWatch

DengueWatch adalah fondasi platform komunitas untuk pelaporan lingkungan dan tindak lanjut
pencegahan dengue yang terverifikasi. Implementasi saat ini hanya mencakup:

- **M1 Foundation:** Next.js App Router, TypeScript strict, Tailwind CSS, design tokens,
  komponen dasar, halaman publik, dan tooling pengujian.
- **M2 Authentication & Area Access:** Supabase Auth SSR, profil, tiga peran, keanggotaan
  wilayah, protected route, RLS, dan seed demo yang dijaga.

Fitur laporan lingkungan, Gemini, verifikasi laporan, ActionLoop, peta, PSN, dan analitik
belum diimplementasikan. UI tidak menampilkan kemampuan tersebut seolah sudah tersedia.

## Persyaratan

- Node.js 20.9 atau lebih baru.
- pnpm 10.21 atau versi kompatibel.
- Project Supabase untuk alur auth nyata.
- Supabase CLI 2.122.0 tersedia sebagai dev dependency. Database lokal dan tes RLS juga
  memerlukan Docker atau runtime container yang kompatibel.

## Menjalankan aplikasi

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Buka `http://localhost:3000`. Tanpa konfigurasi Supabase, halaman publik dan auth tetap
dapat dirender, tetapi operasi akun akan gagal tertutup dengan pesan konfigurasi yang aman.
Nilai contoh seperti `replace_me` dan URL project placeholder sengaja ditolak sebagai
konfigurasi tidak valid.

## Environment variables

| Variable                               | Exposure           | Kegunaan                                               |
| -------------------------------------- | ------------------ | ------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Client + server    | URL project Supabase                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + server    | Publishable key; tetap bergantung pada RLS             |
| `APP_BASE_URL`                         | Server             | Origin callback email auth                             |
| `SUPABASE_SECRET_KEY`                  | Server/script only | Hanya untuk seed developer tepercaya                   |
| `ALLOW_DEMO_SEED`                      | Script only        | Guard eksplisit agar seed tidak berjalan tidak sengaja |
| `DEMO_ACCOUNT_PASSWORD`                | Script only        | Password akun demo, tidak disimpan di repository       |
| `NEXT_PUBLIC_DEMO_MODE`                | Client + server    | Penanda lingkungan simulasi                            |

Jangan pernah memberi prefix `NEXT_PUBLIC_` pada secret key. Simpan secret melalui pengelola
secret lokal/deployment, bukan Git.

## Database dan migration

Migration berada di `supabase/migrations/` dan harus dijalankan berurutan. Migration kedua
menambahkan invariant role-membership, policy area yang role-aware, dan defense-in-depth
terhadap perubahan role. Migration ketiga memberi `service_role` hanya operasi tabel yang
dibutuhkan seed (`SELECT`, `INSERT`, `UPDATE`) dan tetap menolak `DELETE`.

Dengan Supabase lokal:

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm test:db
```

`pnpm supabase:reset` menghapus dan membangun ulang **database lokal**. Jangan menjalankannya
pada project remote/produksi. Untuk project remote yang sudah ditautkan, tinjau migration
terlebih dahulu lalu gunakan prosedur deployment Supabase tim.

Konfigurasi lokal berada di `supabase/config.toml`; seed otomatis dinonaktifkan agar akun
demo tidak dibuat tanpa guard eksplisit. Jika `pnpm test:db` menolak koneksi ke port 54322,
jalankan runtime container lalu `pnpm supabase:start` terlebih dahulu.

## Seed demo

Seed membuat satu area fiktif dan empat akun sintetis: satu warga, dua kader, dan satu
pengelola. Password berasal dari environment dan tidak dicetak oleh script.

```bash
ALLOW_DEMO_SEED=true pnpm seed:demo
```

Email demo:

- `warga.simulasi@denguewatch.test`
- `kader.satu@denguewatch.test`
- `kader.dua@denguewatch.test`
- `pengelola.simulasi@denguewatch.test`

Script memuat `.env.local` melalui Node, menolak placeholder, menolak berjalan ketika
`NODE_ENV=production`, dan membutuhkan server-only secret key.

## Pemeriksaan kualitas

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm test:e2e:live
pnpm test:db
pnpm test:auth:live
```

`pnpm test:db` menjalankan 53 assertion pgTAP untuk grant, RLS, role, membership,
cross-area access, dan privilege-escalation abuse. Hasilnya hanya boleh disebut lulus bila
database lokal benar-benar berjalan dan command selesai dengan exit code 0.

`pnpm test:auth:live` dan `pnpm test:e2e:live` sengaja menolak URL non-local. Keduanya
memerlukan Supabase lokal aktif, kredensial lokal di `.env.local`, dan demo seed yang sudah
dijalankan. Verifier API menggunakan Auth/JWT/RLS/Mailpit nyata; suite browser menggunakan
Server Actions dan cookie SSR nyata.

Playwright memerlukan Chromium satu kali:

```bash
pnpm exec playwright install chromium
```

Build menggunakan Webpack melalui `next build --webpack`. Turbopack membutuhkan internal
worker port yang tidak diizinkan oleh environment implementasi ini; alasan dicatat di
`docs/DECISIONS.md`.

## Dokumentasi

- [PRD final](docs/DengueWatch_PRD.md)
- [Arsitektur M1–M2](docs/ARCHITECTURE.md)
- [Kontrak desain](docs/DESIGN.md)
- [Model keamanan](docs/SECURITY.md)
- [Keputusan teknis](docs/DECISIONS.md)
- [Bukti verifikasi M2](docs/M2_VERIFICATION.md)
