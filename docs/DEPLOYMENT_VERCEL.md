# Deployment Vercel — DengueWatch (T34)

Vercel menjalankan Next.js; Supabase Cloud tetap menyimpan PostgreSQL, Auth, dan Storage.
Deployment VPS (T22, `docs/DEPLOYMENT_VPS.md`) tetap didukung.

## 1. Sebelum deploy

1. Semua migration di `supabase/migrations/` sudah diterapkan ke project Supabase Cloud,
   **termasuk `202611050002_fix_create_report_function.sql`**. Tanpa migration itu warga tidak
   dapat membuat laporan. Tinjau dulu, lalu terapkan dengan prosedur tim (jangan `db reset`).
2. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` lulus.

## 2. Pengaturan project Vercel

- Framework: Next.js. Build command: `pnpm build` (memakai `next build --webpack`, T04).
- Node.js 20 atau lebih baru. Region function sebaiknya dekat region Supabase.
- `vercel.json` sudah mendaftarkan Vercel Cron `/api/cron/cleanup` setiap hari 02.00 WIB.

## 3. Environment variables

| Variable                               | Environment         | Catatan                                        |
| -------------------------------------- | ------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Production, Preview | URL project Supabase                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview | Publishable key                                |
| `SUPABASE_SECRET_KEY`                  | Production, Preview | Tandai **Sensitive**; server-only              |
| `GEMINI_API_KEY`, `GEMINI_MODEL`       | Production, Preview | Sensitive; model image + JSON                  |
| `AI_REQUEST_TIMEOUT_MS`                | opsional            | Default 15000                                  |
| `APP_BASE_URL`                         | **Production saja** | Domain publik, `https://…`                     |
| `CRON_SECRET`                          | Production          | Min. 32 karakter acak (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_DEMO_MODE`                | sesuai kebutuhan    | Penanda data SIMULASI                          |

Jangan pernah mengisi `AI_TEST_ADAPTER`, `ALLOW_DEMO_SEED`, `DEMO_ACCOUNT_PASSWORD`, atau
`ALLOW_HOSTED_CLEANUP` di Vercel.

Origin: API hanya menerima `APP_BASE_URL` dan host deployment ini sendiri (`VERCEL_URL`,
`VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, diisi otomatis oleh Vercel). Proyek
`*.vercel.app` lain tetap ditolak. Preview tanpa `APP_BASE_URL` memakai URL branch-nya sendiri.

## 4. Supabase Auth

Di Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** domain produksi.
- **Redirect URLs:** `https://<domain-produksi>/auth/callback` dan, bila preview dipakai,
  pola URL preview tim, misalnya `https://<project>-git-*-<team>.vercel.app/auth/callback`.

## 5. Batasan platform yang sudah ditangani

- Body request Vercel maks. 4,5 MB: browser mengecilkan foto > 3,5 MiB sebelum diunggah
  (`src/lib/image/prepareUploadPhoto.ts`); server tetap memvalidasi dan membuat WebP.
- Analisis AI `maxDuration = 40` detik, cron `maxDuration = 60` detik.
- Paket Hobby hanya menjalankan cron sekali sehari; lease upload kedaluwarsa setelah 1 jam
  sehingga sisa unggahan dibersihkan paling lambat keesokan harinya.

## 6. Smoke test setelah deploy

1. Daftar/masuk warga, buat laporan dengan foto kamera > 5 MB → laporan `Menunggu Pemeriksaan`.
2. Pengelola memverifikasi, membuat tugas; kader mengirim bukti; pengelola menyetujui.
3. Permintaan POST dari origin lain ditolak 403.
4. `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/cleanup` → 200 dan
   tanpa header → 401. Periksa juga tab **Cron Jobs** di Vercel.
5. Gemini tidak tersedia → formulir tetap dapat dikirim manual.
