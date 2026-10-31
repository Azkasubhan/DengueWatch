# Verifikasi final M6 — Verified ActionLoop

**Tanggal:** 31 Oktober 2026. **Basis Git:** `71e23b1` pada `main`; perubahan M6 belum di-commit.
Seluruh uji memakai Supabase development lokal (Auth, PostgreSQL, RPC, Storage) dan server
Next.js lokal. Tidak ada reset database, migrasi remote, push, merge, atau deploy.

Migration `202610310004_action_loop.sql` dan `202610310005_task_evidence_uploads.sql`
diterapkan dengan `supabase migration up --local`. Keputusan teknis: T19 dan T20.

## A. Ruang lingkup

- **M6-A:** `action_tasks`, `task_events`, `task_evidence`, idempotency, dan enam RPC
  ActionLoop; closure laporan deterministik; audit append-only.
- **M6-B:** `POST /api/v1/reports/:id/tasks`, `GET /api/v1/tasks`, `GET /api/v1/tasks/:id`,
  `POST /api/v1/tasks/:id/{start,evidence,review,cancel,reopen,evidence-uploads}`; lease upload
  bertujuan (`report`/`task_evidence`) yang terikat ke satu task.
- **M6-C (UI):** `/kader/tugas` (filter status/penanggung jawab/wilayah, pagination,
  empty/error/loading), `/kader/tugas/[id]` (detail, bukti privat, riwayat, aksi start,
  upload+kirim bukti, review, batal, buka kembali), form tugas pada
  `/kader/verifikasi/[reportId]` dengan `Idempotency-Key`, `/pengelola/tugas` read-only, dan
  status/timeline `in_action`/`resolved`/dibuka kembali pada detail laporan warga.
- Assignment MVP: tugas dari form selalu ditugaskan kepada kader yang membuatnya; tidak ada
  direktori kader.

## B. Live E2E M6 (`pnpm test:e2e:m6`) — PASS 10/10

Fixture per eksekusi: dua area demo `M6E2E-A/B-<run>`, satu warga, dua kader area A, satu
kader area B, satu manager area A. Password acak, tidak dicatat.

| Skenario wajib                           | Bukti                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2. Laporan → verifikasi → task pertama | Form UI (validasi fokus) membuat task; laporan `verified → in_action` v3; event `report_action_started`                                                                                                                                                                         |
| 3. Task kedua saat `in_action`           | Kader A2 membuat task sendiri; laporan tetap v3                                                                                                                                                                                                                                 |
| 4. Start → upload WebP privat → evidence | UI; lease `task_evidence` terikat task, `image/webp`, consumed; URL publik bucket tidak 200; signed URL 200 `image/webp`                                                                                                                                                        |
| 5. Larangan review diri                  | UI tidak menampilkan form review; API → 403 `SELF_REVIEW_FORBIDDEN`                                                                                                                                                                                                             |
| 6–7. Revisi lalu persetujuan kader lain  | UI: alasan wajib (fokus), task `in_progress` v4, kirim ulang, setujui → `completed` v6; riwayat bukti `revision_required` + `approved` tersimpan                                                                                                                                |
| 8. Dua task wajib                        | Setelah task 1 selesai laporan tetap `in_action`; setelah task 2 → `resolved` v4                                                                                                                                                                                                |
| 9. Approval paralel                      | Lihat bagian C                                                                                                                                                                                                                                                                  |
| 10. Cancel/reopen (T19)                  | Reopen task selesai → laporan `in_action` + `report_reopened` dengan alasan; cancel task `completed` → 422; cancel task `reopened` → laporan `resolved` lagi; reopen task batal → 422; task baru pada laporan `resolved` → 422                                                  |
| 11. Idempotency                          | Dua request paralel dengan key sama → satu task, ID sama; payload berbeda → 409 `IDEMPOTENCY_CONFLICT`; total task 2                                                                                                                                                            |
| 12. Lease upload                         | Lintas task, kedaluwarsa, sudah dipakai, foto warga sebagai bukti → 409; lease bukti dipakai warga untuk laporan → 409; bukan assignee 403; kader area lain 404; manager/warga 403; file palsu `INVALID_IMAGE`; task bukan `in_progress` 422                                    |
| 13. Otorisasi                            | Manager dan warga: start/review/cancel/create → 403; manager membaca daftar dan `/pengelola/tugas` tanpa tautan aksi; manager ke `/kader/tugas` → `/forbidden`; kader area B: detail 404, daftar kosong, start 404, signed URL Storage dan baris `task_evidence` tidak tersedia |
| 14. Detail warga                         | Status `Selesai`, label penanganan; JSON tanpa path bukti, ID kader, atau field `evidence`/`taskId`/`actor`; `GET /api/v1/tasks` dan detail task → 403                                                                                                                          |

Konflik UI: reviewer membuka form, kader lain membatalkan task, lalu submit menampilkan
alert "Tugas telah diperbarui" dengan "Muat data terbaru"; setelah refresh form hilang dan
tidak ada event approval.

## C. Approval paralel — PASS

Tiga putaran, masing-masing laporan baru dengan dua task wajib (A1 dan A2 sebagai assignee).
Dua session kader berbeda menyetujui task berbeda serentak melalui `Promise.all`. Setiap
putaran: kedua respons 200, kedua task `completed` v4, laporan `resolved` v4, tepat satu
event `report_resolved`, dan tepat dua event approval. Jaminan berasal dari kunci baris
laporan lalu task di setiap RPC ActionLoop.

## D. Regression gate

| Command                                                                       | Hasil                                                                      |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm format:check`                                                           | PASS                                                                       |
| `pnpm lint`                                                                   | PASS                                                                       |
| `pnpm typecheck`                                                              | PASS                                                                       |
| `pnpm test`                                                                   | PASS, 150/150 pada 12 file                                                 |
| `pnpm test:db`                                                                | PASS, 301/301 pada 6 file                                                  |
| `pnpm build`                                                                  | PASS                                                                       |
| `pnpm test:auth:live`                                                         | PASS, 13/13                                                                |
| `pnpm test:e2e:live`                                                          | PASS, 3/3                                                                  |
| `M3_TEST_EMAIL=m3-verifikasi-f8c69b55@denguewatch.test pnpm test:e2e:reports` | PASS, 11/11                                                                |
| `M4_TEST_EMAIL=m4-verifikasi-dcfa9943@denguewatch.test pnpm test:e2e:ai`      | PASS, 7/7                                                                  |
| `pnpm test:e2e:m5`                                                            | PASS, 9/9                                                                  |
| `pnpm test:e2e:m6`                                                            | PASS, 10/10                                                                |
| `pnpm test:e2e`                                                               | PASS, 11 tes umum; 41 tes live di-skip dan dijalankan lewat command khusus |
| `pnpm audit --prod`                                                           | PASS, tidak ada kerentanan                                                 |
| `pnpm test:e2e:ai:live` (Gemini nyata)                                        | NOT RUN — jalur M4 tidak berubah                                           |

## E. Aksesibilitas dan responsif

- Axe (`main`) tanpa pelanggaran: detail laporan kader dengan form tugas, `/kader/tugas`,
  detail tugas (bukti menunggu), `/pengelola/tugas`, dan detail laporan warga `resolved`.
- Tanpa horizontal overflow pada 320, 390, 768, 1440 px untuk daftar tugas, detail tugas,
  dan detail laporan; screenshot diperiksa manual.
- Zoom 200%: diuji sebagai viewport 640 CSS px dengan device scale factor 2 (setara jendela
  1280 px pada 200%) dan label DATA SIMULASI terlihat. **Zoom native browser: NOT RUN** —
  Playwright tidak dapat mengendalikan zoom halaman Chromium, dan tidak ada sesi browser
  manual pada eksekusi ini.
- Keyboard/fokus: submit kosong memindahkan fokus ke field error pertama (judul tugas, foto
  bukti, alasan revisi, alasan batal/buka kembali); radio review memiliki focus ring.
- State: empty, error, loading (`loading.tsx`), sukses (`aria-live`), dan konflik 409 diuji
  atau tersedia; state loading tidak diuji otomatis.

## F. Batasan

- Fixture E2E M5/M6 tidak dapat dihapus karena `service_role` tidak memiliki DELETE pada
  `reports`, `profiles`, dan tabel ActionLoop; data berada di area demo terisolasi per
  eksekusi.
- Assignment ke kader lain hanya tersedia lewat API; UI MVP menugaskan diri sendiri.
- Lease bukti yang batal dipakai dibersihkan oleh cleanup lease kedaluwarsa; belum ada
  tombol hapus.
- Notifikasi in-app ditunda ke Notification Center P1. Hasil ini membuktikan lingkungan
  lokal, bukan deployment hosted.

**M6 Development Release Gate (lokal): PASS.**
