# Verifikasi final M5 — Cadre Verification

**Tanggal:** 31 Oktober 2026. **Basis Git:** `acd2a87` pada `main`; perubahan M5 belum di-commit.
Seluruh uji memakai Supabase development lokal (Auth, PostgreSQL, Storage) dan server Next.js
lokal. Tidak ada reset database, migrasi remote, push, merge, atau pekerjaan M6.

Migration `202610310003_cadre_verification.sql` diterapkan dengan
`supabase migration up --local`.

## A. Ruang lingkup yang dibangun

- **M5-A (database):** RPC `review_report`, `add_report_information`, dan
  `get_report_ai_suggestions`; constraint event per transisi; trigger append-only
  `report_events`. Keputusan teknis: T18.
- **M5-B (API):** `POST /api/v1/reports/:id/review`, `POST /api/v1/reports/:id/add-information`,
  `GET /api/v1/reports/:id/ai-suggestions`, filter antrean (`status`, `category`, `areaId`,
  `submittedFrom`, `submittedTo`, pagination) pada `GET /api/v1/reports`.
- **M5-C (UI):** `/kader/verifikasi` (antrean, filter, pagination, empty/error/loading),
  `/kader/verifikasi/[reportId]` (foto privat, lokasi privat, riwayat, panel
  "Saran AI — perlu verifikasi", form keputusan), serta form informasi tambahan pada detail
  laporan warga.
- **Kompatibilitas API:** respons laporan kini camelCase (`publicReference`, `submittedAt`,
  `isDemo`, `eventType`, dan seterusnya). Kolom database tetap snake_case. Consumer M3
  (halaman daftar/detail warga, `ReportForm`, E2E M3) diperbarui; `ReportForm` hanya membaca
  `data.id` sehingga tidak berubah.

## B. Live E2E M5 (`pnpm test:e2e:m5`) — PASS 9/9

Fixture sintetis dibuat per eksekusi: dua area demo `M5E2E-A/B-<run>`, satu warga, dua kader
area A, satu kader area B, dan satu manager area A. Password acak per eksekusi dan tidak
dicatat. Analisis AI memakai `AI_TEST_ADAPTER=deterministic` (lokal saja).

| Skenario                                      | Bukti                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Laporan warga muncul di antrean kader area | Laporan via API M3 nyata tampil di `/kader/verifikasi`; detail memuat foto, lokasi privat, dan saran AI                                                                                     |
| 2. Verifikasi                                 | Form keyboard → `verified`, `version` 1→2, event `report_verified` dengan actor kader                                                                                                       |
| 3. Minta info → warga menjawab                | `needs_information` v2; jawaban dengan versi lama → 409; jawaban valid → `pending_verification` v3; timeline warga dan kader memuat catatan                                                 |
| 4. Tolak                                      | Alasan valid → `rejected` v4; urutan event dan actor tervalidasi di database                                                                                                                |
| 5. Duplikat                                   | Target `rejected` ditolak 422; dropdown hanya memuat laporan lebih awal yang kanonik; hasil `duplicate` dengan `duplicate_of_report_id` benar                                               |
| 6. Resident/manager                           | Review → 403; manager ke `/kader/verifikasi` → `/forbidden`; manager ke saran AI → 403                                                                                                      |
| 7. Kader lintas area                          | Detail, saran AI, dan review → 404; laporan tidak ada di daftarnya; `createSignedUrl` dan `download` Storage langsung gagal; `ai_analyses` langsung kosong; filter `areaId` asing → 403     |
| 8. Error                                      | Versi lama → 409 `STALE_VERSION`; transisi ilegal → 422 `INVALID_TRANSITION`; alasan kosong, versi string, keputusan asing, field asing → 422; cross-origin → 403; tidak ada event tambahan |
| 9. AC-31                                      | Lihat bagian C                                                                                                                                                                              |
| 10. Regresi warga                             | Daftar/detail API camelCase dengan kunci terkunci; tidak ada `actorId`, `reporter_id`, atau `storage_path`; halaman `/app/laporan` tetap berfungsi                                          |

Konflik UI juga diuji: kader membuka form, kader lain memutuskan lebih dulu, lalu submit
menampilkan alert "Laporan telah diperbarui" dengan tombol "Muat data terbaru"; setelah
refresh form hilang dan hanya satu event `report_verified` tercatat.

## C. Konkurensi dua session (AC-31) — PASS

Dua browser context terpisah (dua kader area A, dua cookie session) mengirim
`POST /review` serentak dengan `expectedVersion: 1` melalui `Promise.all`, tiga putaran pada
tiga laporan berbeda. Setiap putaran: status HTTP tepat `[200, 409]`, kode `STALE_VERSION`,
satu event keputusan, versi akhir 2. pgTAP juga membuktikan kasus versi lama berurutan.
Jaminan atomik berasal dari `SELECT … FOR UPDATE` dan `UPDATE … WHERE version = expected` di
dalam satu RPC.

## D. Hasil regression gate

| Command                                                                       | Hasil                                                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm format:check`                                                           | PASS                                                                                      |
| `pnpm lint`                                                                   | PASS                                                                                      |
| `pnpm typecheck`                                                              | PASS (setelah perbaikan tipe fixture E2E)                                                 |
| `pnpm test`                                                                   | PASS, 102/102 pada 11 file                                                                |
| `pnpm test:db`                                                                | PASS, 192/192 pgTAP (M2 53, M3 47, M4 28, M5 64)                                          |
| `pnpm build`                                                                  | PASS, Webpack production; route M5 dynamic                                                |
| `pnpm test:auth:live`                                                         | PASS, 13/13                                                                               |
| `pnpm test:e2e:live`                                                          | PASS, 3/3                                                                                 |
| `M3_TEST_EMAIL=m3-verifikasi-f8c69b55@denguewatch.test pnpm test:e2e:reports` | PASS, 11/11                                                                               |
| `M4_TEST_EMAIL=m4-verifikasi-dcfa9943@denguewatch.test pnpm test:e2e:ai`      | PASS, 7/7 (deterministik)                                                                 |
| `pnpm test:e2e:m5`                                                            | PASS, 9/9                                                                                 |
| `pnpm test:e2e`                                                               | PASS, 11 tes umum; 31 tes live di-skip dan dijalankan lewat command khusus                |
| `pnpm audit --prod`                                                           | PASS, tidak ada kerentanan                                                                |
| `pnpm test:e2e:ai:live` (Gemini nyata)                                        | NOT RUN — tidak ada perubahan pada jalur provider M4; menghindari panggilan API eksternal |

## E. Aksesibilitas dan responsif

- Axe (`main`) tanpa pelanggaran pada antrean, detail kader (form aktif), dan detail warga
  `needs_information`.
- Tanpa horizontal overflow pada 320, 390, 768, dan 1440 px untuk antrean dan detail;
  screenshot diperiksa manual. Zoom 200% diuji sebagai viewport CSS 640 px (setara jendela
  1280 px pada zoom 200%), bukan zoom native browser.
- Keyboard: submit kosong memindahkan fokus ke radio keputusan pertama; Space memilih;
  Enter mengirim. Alasan pendek memindahkan fokus ke textarea dengan pesan error terhubung
  `aria-describedby`. Radio card memiliki focus ring melalui `:has(:focus-visible)`.

## F. Batasan

- Fixture E2E sengaja tidak dihapus karena `service_role` tidak memiliki DELETE pada
  `reports`/`profiles`; data berada di area demo terisolasi per eksekusi dan ditandai simulasi.
- Notifikasi in-app (FR-34) ditunda ke Notification Center P1; status perubahan terlihat pada
  detail dan timeline.
- Hasil ini membuktikan lingkungan lokal, bukan deployment hosted.

**M5 Development Release Gate (lokal): PASS.**
