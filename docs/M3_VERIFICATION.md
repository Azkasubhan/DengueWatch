# Verifikasi M3 — Environmental Reports

Review UI/UX lanjutan pada 31 Oktober 2026, termasuk hasil suite browser yang kini 11/11,
dicatat terpisah di [M3_UI_UX_REVIEW.md](M3_UI_UX_REVIEW.md). Tabel di bawah merekam
baseline implementasi M3 sebelum review tersebut.

**Tanggal:** 30–31 Oktober 2026. **Target:** Supabase development lokal pada loopback;
tidak ada migration/reset pada project remote. **Basis Git:** `db8bb07` pada branch
`main`. Dokumen ini merekam hasil command yang benar-benar dijalankan; status hosted
deployment belum diuji.

## Implementasi

- Resident dengan area terverifikasi dapat memilih 1–3 foto, kategori, deskripsi, dan
  lokasi opsional; melihat pratinjau; lalu mengirim laporan. Halaman daftar/detail membaca
  PostgreSQL dan menampilkan nomor, status `pending_verification`, foto, dan riwayat.
- Migration `202610300004_environmental_reports.sql` membuat `reports`, `report_uploads`,
  `report_images`, `report_events`, dan `report_idempotency` beserta constraints, indeks,
  RLS, grants, private Storage bucket, dan RPC finalisasi atomik. Migration
  `202610300005_report_upload_quota.sql` membatasi lease media. Migration
  `202610300006_persistent_report_upload_quota.sql` membuat ledger percobaan yang tidak
  hilang ketika lease dibersihkan.
- Foto JPEG/PNG/WebP dibatasi 5 MiB, divalidasi signature/decode/dimensi/pixel, lalu
  dinormalisasi sebagai WebP tanpa EXIF/XMP. Bucket `report-photos` privat. URL bertanda
  tangan dibuat lewat user-scoped client setelah RLS dan berlaku 60 detik.
- RPC mengambil identity dari `auth.uid()`, memvalidasi role/area dan lease milik user,
  lalu membuat report + image links + event `report_created` + idempotency record dalam
  satu transaksi. Batas 10 laporan dan 30 reservasi upload per user per jam ada di database.
- Endpoint dan respons ada di [M3_API.md](M3_API.md). Script seed membuat tiga laporan
  simulasi deterministik dengan aset sintetis tanpa identitas atau alamat nyata.

## Hasil verifikasi lokal

| Status | Command                                   | Hasil aktual                                                                                     |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| PASS   | `pnpm exec supabase migration up --local` | Migration 004, 005, dan 006 diterapkan berurutan ke PostgreSQL lokal; tanpa reset data.          |
| PASS   | `pnpm test:db`                            | 100/100 assertion pada dua file: 53 M2 dan 47 M3.                                                |
| PASS   | `ALLOW_DEMO_SEED=true pnpm seed:reports`  | Tiga laporan simulasi dibuat; eksekusi ulang selesai tanpa membuat ulang laporan yang sudah ada. |
| PASS   | `pnpm test`                               | 36/36 unit tests pada 7 file.                                                                    |
| PASS   | `pnpm test:e2e:reports`                   | 8/8 live Chromium tests dengan Auth, DB, API, dan Storage lokal.                                 |
| PASS   | `pnpm test:e2e`                           | 11/11 tes publik/akses; 11 live tests sengaja skipped oleh command umum.                         |
| PASS   | `pnpm test:auth:live`                     | 13/13 pemeriksaan Auth/JWT/RLS/recovery M2.                                                      |
| PASS   | `pnpm test:e2e:live`                      | 3/3 browser Auth M2.                                                                             |
| PASS   | `pnpm format:check`                       | Seluruh file sesuai Prettier pada pemeriksaan sebelum pembaruan akhir dokumen ini.               |
| PASS   | `pnpm lint`                               | ESLint exit 0.                                                                                   |
| PASS   | `pnpm typecheck`                          | TypeScript exit 0.                                                                               |
| PASS   | `pnpm build`                              | Next.js production Webpack build selesai; route M3 dynamic terdaftar.                            |
| PASS   | `pnpm audit --prod`                       | Tidak ada known vulnerabilities yang dilaporkan registry saat pemeriksaan.                       |

### Cakupan keamanan dan integrasi

- pgTAP M3 membuktikan grants minimum, RLS report/image/event, status awal, event, role
  dan area scope, larangan write langsung, idempotency, kepemilikan foto, dan policy
  `storage.objects`. Ledger kuota tetap menghitung lease yang dihapus dan menolak
  reservasi ke-31. Tes M2 tetap lulus setelah assertion yang bergantung pada jumlah
  profil test diisolasi dari data seed M3.
- Browser M3 mengirim laporan melalui session resident asli, memuat ulang detail persisten,
  menguji retry bersamaan dengan key sama (satu report), key sama dengan payload berbeda
  (`409`), pagination, private signed image, dan warga kedua di area sama yang mendapat
  `404` untuk report pertama serta gagal membuat URL/unduh Storage langsung.
- Browser menguji `401`, `403`, `400`, `413`, `415`, `422`, foto PDF tersamar, penghapusan
  lease oleh owner, dan cleanup satu lease sintetis yang dibuat kedaluwarsa secara sengaja.
  Normalisasi JPEG/PNG/WebP, corrupt/fake/SVG/PDF/executable, ukuran berlebih, dan
  penghapusan EXIF juga diuji pada unit level.
- Screenshot 390, 768, dan 1440 px diperiksa secara visual; tidak terlihat horizontal
  overflow. Automated axe pada form 768/1440 tidak menemukan pelanggaran serious/critical.

## Bug dan perbaikan selama implementasi

1. Supabase lokal semula berjalan tanpa Storage; `[storage].enabled=true` diterapkan dan
   stack lokal direstart, lalu migration 004/005 berhasil.
2. Petunjuk lokasi tanpa GPS semula tampil di preview tetapi hilang saat submit; schema
   dan payload kini mengizinkan catatan dengan pasangan koordinat `null`.
3. Tes M2 menghitung semua profil termasuk seed, sehingga gagal setelah laporan demo;
   assertion dibatasi pada lima fixture M2, lalu 94 assertion lulus.
4. Port 3000 ditempati proses lain dan test browser awal mendapat 404; Playwright
   menggunakan port lokal terpisah 3001. Locator status yang terlalu luas serta body
   JSON malformed pada fixture tes diperbaiki dan dijalankan ulang.
5. Label area demo pada pemilih semula menampilkan penanda simulasi dua kali;
   ditampilkan satu kali.
6. Kuota unggahan semula dapat dilewati dengan menghapus lease setelah upload; migration
   006 memindahkan penghitung ke ledger append-only dan pgTAP memverifikasi batasnya.
7. Setelah pergantian hari, runtime container lokal sempat berhenti sehingga uji browser
   gagal pada login karena Auth tidak terjangkau. OrbStack/Supabase lokal dinyalakan kembali;
   suite M3 lengkap kemudian lulus 8/8 terhadap migration 006.

## Batasan dan keputusan gate

**M3 lokal: PASS.** Alur resident end-to-end dan pembatasan data/foto telah diuji dengan
Supabase Auth, PostgreSQL, Storage, dan browser nyata. Hasil ini tidak membuktikan
konfigurasi hosted/production. Sebelum deployment publik, jadwalkan cleanup lease
kedaluwarsa, verifikasi konfigurasi Storage/Auth/rate limit hosted, dan ulangi suite pada
environment staging.

Signed URL adalah bearer link selama maksimal 60 detik: siapa pun yang memperoleh URL
tersebut dapat memakainya sampai kedaluwarsa. Suite E2E memakai akun demo yang dibatasi
10 report per jam; menjalankan suite berulang kali dalam satu jam dapat memicu `429`
yang memang diharapkan dari rate limit. Tidak ada Gemini SmartSpot, tindakan verifikasi
kader, ActionLoop, Community Map, atau diagnosis medis pada M3.
