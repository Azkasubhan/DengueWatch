# Keputusan Teknis

## T01 — Package manager dan versi

- **Status:** accepted, 30 Oktober 2026.
- **Keputusan:** pnpm 10.21.0; Next.js 16.4.3; React 19.3.1; TypeScript 6.0.3;
  Tailwind CSS 4.3.3; Supabase JS 2.118.0; Supabase SSR 0.12.7; Zod 4.6.7.
- **Alasan:** versi stabil saat implementasi dan lockfile reproducible.
- **Catatan kompatibilitas:** TypeScript 7 dan ESLint 10 adalah versi terbaru registry,
  tetapi berada di luar peer range lint stack Next 16. Dipilih TypeScript 6.0.3 dan ESLint
  9.39.5 sebagai versi tertinggi yang kompatibel. ESLint 9 sudah berstatus deprecated oleh
  registry; naikkan setelah plugin Next mendukung ESLint 10.

## T02 — Next.js Proxy

- **Status:** accepted.
- **Keputusan:** menggunakan root `proxy.ts`, bukan `middleware.ts`.
- **Alasan:** Next.js 16 mengganti convention Middleware menjadi Proxy. Proxy hanya refresh
  token dan header cache; authorization tetap di server DAL dan RLS.

## T03 — Font self-hosted

- **Status:** accepted.
- **Keputusan:** `@fontsource-variable/plus-jakarta-sans`.
- **Alasan:** memenuhi font terkunci tanpa membuat production build bergantung pada akses
  Google Fonts. Tidak ada font dekoratif kedua.

## T04 — Builder produksi

- **Status:** accepted untuk environment ini.
- **Keputusan:** `next build --webpack`.
- **Alasan:** Turbopack 16.4.3 panik saat worker PostCSS mencoba bind internal port yang
  dilarang managed execution environment (`EPERM`). Webpack adalah builder Next.js yang
  didukung dan build berhasil. Evaluasi kembali Turbopack di CI/deployment yang normal.

## T05 — Form tanpa React Hook Form

- **Status:** accepted.
- **Keputusan:** native form + React `useActionState` + Server Actions + Zod.
- **Alasan:** empat form auth sederhana tidak membutuhkan dependency/form abstraction
  tambahan. React Hook Form dapat ditambahkan bila form laporan yang kompleks dibangun.

## T06 — Model centroid area

- **Status:** accepted untuk M2.
- **Keputusan:** `public_latitude` dan `public_longitude` numeric nullable dengan pair/range
  constraints, bukan PostGIS geometry.
- **Alasan:** M2 tidak mengimplementasikan peta. Struktur ini cukup untuk centroid publik
  generalisasi dan menghindari extension yang belum dibutuhkan. ADR baru diperlukan bila
  modul peta membutuhkan geospatial query.

## T07 — Tidak ada pemilihan area saat registrasi

- **Status:** accepted.
- **Keputusan:** public registration hanya mengumpulkan nama, email, dan password.
- **Alasan:** browser-supplied area tidak boleh menjadi membership otomatis. Area dan role
  demo disiapkan oleh seed tepercaya; user baru melihat status menunggu persetujuan.

## T08 — Hardening role dan area melalui migration forward-only

- **Status:** accepted dan diverifikasi pada PostgreSQL lokal, 30 Oktober 2026.
- **Keputusan:** migration kedua menambahkan trigger invariant role-membership, helper area
  role-aware, revocation function private, dan `FORCE ROW LEVEL SECURITY`.
- **Alasan:** grants yang sempit saja tidak cukup sebagai pertahanan jangka panjang; trigger
  mencegah escalation jika privilege kelak melebar dan policy mengikat role ke tipe
  membership yang benar.
- **Bukti:** clean reset menerapkan seluruh migration dan `pnpm test:db` mengeksekusi 53/53
  assertion dengan hasil lulus.

## T09 — Supabase CLI dan local config dipin

- **Status:** accepted.
- **Keputusan:** dev dependency `supabase` 2.122.0 dan `supabase/config.toml` menjadi entry
  point local development; seed otomatis dinonaktifkan.
- **Alasan:** command yang versioned dan configuration-as-code lebih reproducible daripada
  bergantung pada CLI global atau setting lokal tersembunyi.
- **Catatan environment:** OrbStack menyediakan Docker engine lokal. Database, GoTrue,
  Kong, dan Mailpit berhasil dijalankan; verifier menolak target non-local.

## T10 — Least-privilege grant untuk seed tepercaya

- **Status:** accepted dan diverifikasi.
- **Keputusan:** migration ketiga memberi `service_role` `SELECT/INSERT/UPDATE` hanya pada
  tabel yang diperlukan seed dan tidak memberi `DELETE`.
- **Alasan:** `BYPASSRLS` tidak menggantikan PostgreSQL table privileges. Tanpa grant
  eksplisit, seed gagal dengan `permission denied for table areas`; memberi semua privilege
  akan lebih luas daripada kebutuhan aktual.
- **Bukti:** seed empat akun sintetis berhasil dan tiga assertion pgTAP memverifikasi grant
  positif serta ketiadaan `DELETE`.

## T11 — Lease upload dan finalisasi atomik M3

- **Status:** accepted, 30 Oktober 2026.
- **Keputusan:** upload foto diproses server menjadi WebP privat dengan `report_uploads`
  sebagai lease satu jam. RPC user-scoped memfinalisasi 1–3 lease, report, image metadata,
  event, dan idempotency dalam satu transaksi.
- **Alasan:** binary upload dan transaction PostgreSQL tidak dapat menjadi satu HTTP
  transaction. Lease, ownership, expiry, penghapusan manual, dan cleanup menangani objek
  yang tidak pernah difinalisasi.
- **Batasan:** cleanup perlu dijalankan terjadwal saat deploy. URL foto bertanda tangan
  berlaku 60 detik dan merupakan bearer URL selama interval itu.

## T12 — Lokasi opsional tanpa peta M3

- **Status:** accepted.
- **Keputusan:** lokasi presisi hanya berasal dari geolocation setelah tindakan user;
  petunjuk lokasi umum dapat diberikan tanpa koordinat. Tidak ada titik default `[0,0]`.
- **Alasan:** memenuhi informasi lokasi minimum tanpa membangun Community Map M4.

## T13 — Batas reservasi media

- **Status:** accepted.
- **Keputusan:** trigger database membatasi 30 lease upload per akun per jam, sedangkan RPC
  membatasi 10 laporan per akun per jam. Keduanya berlaku lintas instance aplikasi.
- **Alasan:** mencegah storage abuse dasar tanpa menambah in-memory limiter yang tidak
  konsisten pada beberapa instance.

## T14 — Ledger kuota yang bertahan setelah lease dihapus

- **Status:** accepted dan diverifikasi, 31 Oktober 2026.
- **Keputusan:** migration keenam mencatat setiap reservasi ke tabel append-only
  `report_upload_attempts`; trigger kuota menghitung ledger ini, bukan baris lease aktif.
- **Alasan:** hitungan pada `report_uploads` dapat dilewati dengan menghapus lease segera
  setelah upload. Ledger tetap menghitung percobaan dalam jendela satu jam. pgTAP menguji
  bahwa penghapusan lease tidak mereset hitungan dan reservasi ke-31 ditolak.
