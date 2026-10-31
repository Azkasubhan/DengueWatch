# DengueWatch

DengueWatch adalah fondasi platform komunitas untuk pelaporan lingkungan dan tindak lanjut
pencegahan dengue yang terverifikasi. Implementasi saat ini hanya mencakup:

- **M1 Foundation:** Next.js App Router, TypeScript strict, Tailwind CSS, design tokens,
  komponen dasar, halaman publik, dan tooling pengujian.
- **M2 Authentication & Area Access:** Supabase Auth SSR, profil, tiga peran, keanggotaan
  wilayah, protected route, RLS, dan seed demo yang dijaga.
- **M3 Environmental Reports:** laporan manual warga, foto privat, daftar/detail, riwayat,
  API, serta pengujian keamanan dan integrasi lokal.
- **M4 Gemini SmartSpot:** bantuan AI opsional pada foto laporan, dengan tinjauan dan
  keputusan akhir tetap pada warga. Satu alur Gemini nyata telah lulus di development lokal.

Verifikasi laporan, ActionLoop, peta, PSN, dan analitik belum diimplementasikan.

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
| `SUPABASE_SECRET_KEY`                  | Server/script only | Staging/cleanup foto dan seed tepercaya                |
| `ALLOW_DEMO_SEED`                      | Script only        | Guard eksplisit agar seed tidak berjalan tidak sengaja |
| `DEMO_ACCOUNT_PASSWORD`                | Script only        | Password akun demo, tidak disimpan di repository       |
| `NEXT_PUBLIC_DEMO_MODE`                | Client + server    | Penanda lingkungan simulasi                            |
| `GEMINI_API_KEY`                       | Server only        | Kunci Gemini untuk analisis foto                       |
| `GEMINI_MODEL`                         | Server only        | Model yang mendukung image dan JSON terstruktur        |
| `AI_REQUEST_TIMEOUT_MS`                | Server only        | Timeout per percobaan; default 15000 ms                |

Jangan pernah memberi prefix `NEXT_PUBLIC_` pada secret key. Simpan secret melalui pengelola
secret lokal/deployment, bukan Git.

## Database dan migration

Migration berada di `supabase/migrations/` dan harus dijalankan berurutan. Migration kedua
menambahkan invariant role-membership, policy area yang role-aware, dan defense-in-depth
terhadap perubahan role. Migration ketiga memberi `service_role` hanya operasi tabel yang
dibutuhkan seed (`SELECT`, `INSERT`, `UPDATE`) dan tetap menolak `DELETE`. Migration keempat
menambahkan Environmental Reports dan private Storage; migration kelima membatasi reservasi
unggahan sementara. Migration keenam membuat ledger percobaan upload yang tetap dihitung
setelah lease dihapus. Pastikan `[storage].enabled = true` di konfigurasi Supabase lokal.
Migration ketujuh menambahkan ledger analisis AI, kuota terpisah, RLS, dan tautan otomatis
ke laporan yang akhirnya dikirim.
Migration kedelapan memperketat pembacaan catatan AI setelah membership dicabut dan
hanya menautkan analisis ke laporan pada area yang sama.

Dengan Supabase lokal:

```bash
pnpm supabase:start
pnpm exec supabase migration up --local
pnpm test:db
```

`pnpm supabase:reset` menghapus dan membangun ulang **database lokal**. Untuk menerapkan
migration baru tanpa menghapus data lokal, jalankan `pnpm exec supabase migration up --local`.
Jangan menjalankan reset pada project remote/produksi. Untuk project remote yang sudah ditautkan, tinjau migration
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

## Laporan lingkungan M3

Resident dengan membership area terverifikasi dapat membuka `/app/laporan/buat`, mengirim
1–3 foto, dan melihat daftar serta detail laporan yang persisten. Foto disimpan sebagai
WebP tanpa metadata dalam bucket privat `report-photos`. Setiap laporan baru berstatus
`pending_verification` dan memiliki event `report_created`. Keputusan verifikasi kader
berada di milestone lain dan tidak dipengaruhi Gemini.

Setelah seed M2, buat tiga laporan simulasi deterministik beserta foto sintetis dari
`assets/demo-reports/`:

```bash
ALLOW_DEMO_SEED=true pnpm seed:reports
```

Unggahan yang belum dikaitkan dengan laporan kedaluwarsa setelah satu jam. Jalankan
cleanup lokal secara berkala dengan guard eksplisit:

```bash
ALLOW_UPLOAD_CLEANUP=true pnpm cleanup:report-uploads
```

Endpoint dan bentuk respons dijelaskan di [kontrak API M3](docs/M3_API.md). Upload
memerlukan secret key hanya pada server untuk menyiapkan foto; create/list/detail laporan
memakai session pengguna dan RLS. Jangan menaruh secret key di browser.

## Bantuan Gemini M4

Warga dapat menyiapkan satu foto yang sudah divalidasi, lalu menekan **Bantu dengan Gemini**.
Pemberitahuan pemrosesan eksternal ditampilkan sebelum tindakan tersebut. Hasil AI dapat
diterapkan, diubah, dipulihkan, atau diabaikan. Mengirim laporan tetap tindakan terpisah
melalui alur M3. Tanpa kunci atau model Gemini yang valid, pesan unavailable ditampilkan
dan laporan manual tetap berfungsi.

Isi `GEMINI_API_KEY`, `GEMINI_MODEL`, dan bila perlu `AI_REQUEST_TIMEOUT_MS` di `.env.local`.
Model harus tersedia untuk project Gemini development, menerima image, dan mendukung JSON
terstruktur. Implementasi selalu membaca model dari environment. Hasil live development
dan batas verifikasinya tercatat di [verifikasi M4](docs/M4_VERIFICATION.md).

Tes browser deterministik memakai Supabase Auth, database, dan Storage lokal yang nyata,
namun **tidak** memanggil Gemini:

```bash
pnpm test:e2e:ai
```

Satu uji provider nyata memakai akun resident sintetis terisolasi di Supabase lokal:

```bash
M4_TEST_EMAIL=<email-fixture-resident-lokal> pnpm test:e2e:ai:live
```

Command ini memakai quota Gemini nyata dan tidak boleh dijalankan dengan foto pribadi.

Catatan analisis lokal yang berusia lebih dari 30 hari dapat dibersihkan dengan:

```bash
ALLOW_AI_CLEANUP=true pnpm cleanup:ai-analyses
```

Jadwalkan cleanup yang setara pada lingkungan hosted sebelum deployment publik.

## Pemeriksaan kualitas

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm test:e2e:live
pnpm test:e2e:reports
pnpm test:e2e:ai
M4_TEST_EMAIL=<email-fixture-resident-lokal> pnpm test:e2e:ai:live
pnpm test:db
pnpm test:auth:live
```

`pnpm test:db` menjalankan 53 assertion M2, 47 assertion M3, dan 28 assertion M4 untuk grant, RLS, role,
membership, cross-area access, report atomicity, dan Storage policy. Hasilnya hanya boleh disebut lulus bila
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
- [Arsitektur M1–M4](docs/ARCHITECTURE.md)
- [Kontrak desain](docs/DESIGN.md)
- [Model keamanan](docs/SECURITY.md)
- [Keputusan teknis](docs/DECISIONS.md)
- [Bukti verifikasi M2](docs/M2_VERIFICATION.md)
- [Kontrak API M3](docs/M3_API.md)
- [Bukti verifikasi M3](docs/M3_VERIFICATION.md)
- [Kontrak API M4](docs/M4_API.md)
- [Bukti verifikasi M4](docs/M4_VERIFICATION.md)
