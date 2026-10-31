# Verifikasi final M4 — Gemini SmartSpot

**Tanggal:** 31 Oktober 2026. **Basis Git:** `2c2a905` pada `main`; perubahan M4 masih belum di-commit. Verifikasi ini hanya memakai Supabase development lokal (`127.0.0.1:54321` untuk API dan `127.0.0.1:54322` untuk database). Tidak ada reset database, migrasi remote, push, merge, atau pekerjaan M5.

`pnpm exec supabase migration list --local` mencatat migration M4 `202610310001` dan hardening `202610310002` telah diterapkan pada database lokal sebelum tes final.

## A. Konfigurasi Gemini

- `.env.local` memuat `GEMINI_API_KEY`, `GEMINI_MODEL`, dan `AI_REQUEST_TIMEOUT_MS` yang terisi. Nilai kunci tidak dicatat. `.env.local` diabaikan Git.
- Model yang dibaca dari environment dan tercatat pada analisis live adalah **`gemini-3.5-flash-lite`**. Timeout lokal 15.000 ms. Implementasi memakai `@google/genai` 2.32.0 melalui modul server-only.
- `AI_TEST_ADAPTER` tidak disetel pada uji live; command live menghapus variabel tersebut dari environment anak proses. Foto sintetis berasal dari `assets/demo-reports/water-container.png`.

## B–E. Provider nyata, output, persistence, dan keamanan

`M4_TEST_EMAIL=m4-verifikasi-dcfa9943@denguewatch.test pnpm test:e2e:ai:live` menghasilkan **1/1 PASS**. Test tersebut login ke Supabase Auth sebagai resident dengan membership area terverifikasi, mengunggah foto melalui private upload M3, lalu memanggil `POST /api/v1/ai/analyze-report` satu kali. Endpoint mengembalikan HTTP 200. Analisis memakai model dari `GEMINI_MODEL`, tanpa adapter deterministik. Database menyimpan status `success`, model yang sama, 1.270 input token dan 142 output token; adapter deterministik hanya mengembalikan 1/1 token. Ini menjadi bukti bahwa jalur provider nyata digunakan, bersama konfigurasi test yang meniadakan adapter.

Respons melewati parser `AiReportSuggestion` dengan objek strict, kategori `water_container`, `requiresHumanVerification: true`, dan batasan foto. Tinjauan manual atas hasil sintetis tidak menemukan diagnosis, identifikasi spesies, atau klaim medis pasti. Ini membuktikan satu keluaran yang diuji, bukan jaminan semua keluaran model di masa depan.

Baris `ai_analyses` menyimpan hash SHA-256 input, hasil terstruktur, token, status, dan pemilik yang sesuai. Sebelum laporan dikirim, `report_id` kosong; sesudah alur M3, analisis tertaut ke report yang benar. Status report di database dan UI tetap **`pending_verification`**. AI tidak diberi jalur untuk mengubah status itu. Tidak ada raw image, koordinat privat, atau signed Storage URL dalam dokumen ini.

Pemeriksaan source dan test menegaskan bahwa RPC memverifikasi user, membership area, kepemilikan upload, masa berlaku, format WebP privat, keberadaan objek, serta kuota sebelum memanggil Gemini. Service mengunduh ulang objek privat dan memeriksa byte, dimensi, metadata, dan hash. RLS hanya memberi resident akses baca atas analisis miliknya pada area yang masih sah; pengguna biasa tidak diberi hak menulis tabel. Suite M4 menguji penolakan anonim, cadre, upload milik warga lain, area lain, path palsu, dan upload kedaluwarsa.

Pemindaian 124 file tracked/untracked serta 44 file `.next/static` menemukan **0 kecocokan nilai kunci Gemini**. Browser bundle juga tidak memuat penanda `GEMINI_API_KEY` atau `GoogleGenAI`. Tidak ada nilai kunci yang ditampilkan pada output pengujian. Pemindaian ini memeriksa checkout dan bundle lokal saat ini, bukan lingkungan hosted.

## F–G. Fallback manual, browser, accessibility, dan zoom

Suite M4 deterministik dijalankan **ulang setelah migration hardening RLS dan perubahan AbortSignal terakhir** dengan resident sintetis terisolasi: `M4_TEST_EMAIL=m4-verifikasi-dcfa9943@denguewatch.test pnpm test:e2e:ai` **7/7 PASS**. Supabase Auth, database, dan Storage tetap nyata; hanya respons AI yang deterministik. Tes mencakup apply dengan konfirmasi, penyuntingan setelah apply, ignore, kegagalan provider lalu submit manual, request lintas user/area/role, dan respons AI lama yang tidak boleh menimpa edit baru. UI menampilkan loading melalui `role=status`, error melalui `role=alert`, serta tombol retry, cancel, apply, dan ignore yang dapat dijangkau keyboard. Axe tidak menemukan pelanggaran pada konten utama M4, dan `prefers-reduced-motion` diperiksa.

Pada uji live, isian manual tetap ada saat saran muncul. Pengguna secara eksplisit menerapkan saran, lalu mengubah deskripsi sebelum mengirim laporan. Pengiriman melalui M3 berhasil tanpa perubahan status oleh AI.

Zoom browser asli diuji pada tab Chromium dengan `chrome.tabs.setZoom(tabId, 2)` dan diverifikasi dengan `chrome.tabs.getZoom(tabId) = 2` serta `devicePixelRatio = 2`; ini bukan CSS `zoom`. Panel saran M4 tetap terlihat dan tidak ada overflow horizontal pada lebar fisik 640, 780, 1536, dan 2880 px, setara lebar CSS efektif **320, 390, 768, dan 1440 px** pada zoom 200%. Zoom dikembalikan ke 100% dan profil browser sementara dihapus. Test otomatis M3 juga memeriksa reflow di keempat lebar tersebut. Kontrol Safari melalui alat UI tidak tersedia dalam sesi ini, sehingga verifikasi zoom asli menggunakan Chromium.

Temuan axe `region` tingkat moderate pada banner simulasi global tetap ada. Temuan tersebut berada di luar konten utama M4 dan tidak menutup keyboard flow atau submit; perlu ditinjau pada audit aksesibilitas lintas aplikasi sebelum publikasi luas. Tidak ada perubahan design system yang dikunci.

## H. Regression M1–M3 dan seluruh gate lokal

| Command                                                                       | Hasil aktual                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm format:check`                                                           | PASS, Prettier exit 0                                                                      |
| `pnpm lint`                                                                   | PASS, ESLint exit 0                                                                        |
| `pnpm typecheck`                                                              | PASS, TypeScript exit 0                                                                    |
| `pnpm test`                                                                   | PASS, 61/61 pada 10 file                                                                   |
| `pnpm build`                                                                  | PASS, Webpack production build; endpoint M4 dynamic                                        |
| `pnpm test:db`                                                                | PASS, **128/128** assertion pgTAP: 53 M2, 47 M3, 28 M4                                     |
| `pnpm test:auth:live`                                                         | PASS, 13/13 pemeriksaan Auth/JWT/RLS/recovery M2                                           |
| `pnpm test:e2e:live`                                                          | PASS, 3/3 browser Auth M2                                                                  |
| `M3_TEST_EMAIL=m3-verifikasi-f8c69b55@denguewatch.test pnpm test:e2e:reports` | PASS, 11/11 browser laporan M3                                                             |
| `pnpm test:e2e`                                                               | PASS, 11 tes umum; 22 tes live khusus di-skip dan dijalankan melalui command masing-masing |
| `M4_TEST_EMAIL=m4-verifikasi-dcfa9943@denguewatch.test pnpm test:e2e:ai`      | PASS, 7/7 browser M4 dengan adapter AI deterministik                                       |
| `M4_TEST_EMAIL=m4-verifikasi-dcfa9943@denguewatch.test pnpm test:e2e:ai:live` | PASS, 1/1 browser M4 dengan Google Gemini nyata                                            |
| `pnpm audit --prod`                                                           | PASS, registry melaporkan 0 known vulnerabilities                                          |

Run pertama `pnpm test:e2e:reports` berhenti pada tes keempat karena akun demo utama mencapai batas **10 laporan per jam**; UI menampilkan pesan batas sementara. Assertion tidak diubah dan kuota tidak dihapus. Pengulangan memakai akun resident sintetis baru dengan membership sah di Supabase lokal, lalu **11/11 PASS**. Dua akun fixture verifikasi lokal terpisah dari akun demo utama. Satu percobaan awal zoom memakai URL `127.0.0.1:3001` dan mendapat HTTP 403 saat menyiapkan foto; penyebab spesifik 403 tidak direkam. Pengulangan pada origin aplikasi `localhost:3001` lulus. Tidak ada perubahan pada pemeriksaan keamanan origin.

## Perbaikan M4 yang diuji

1. Parser output mempertahankan ungkapan ketidakpastian seperti “tidak dapat memastikan” sambil menolak klaim medis eksplisit.
2. Migration `202610310002_ai_analysis_scope_hardening.sql` menutup akses baca analisis setelah membership area dicabut dan mencegah tautan analisis area A ke laporan area B.
3. Jalur request meneruskan `AbortSignal` ke SDK. Konfigurasi Gemini menghapus parameter sampling `temperature` yang dinyatakan deprecated untuk keluarga model ini dalam [dokumentasi Google](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.6); model tetap diambil dari environment.
4. Test browser live dan fixture terisolasi ditambahkan agar satu panggilan provider nyata serta suite deterministik dapat dibuktikan tanpa mengganggu kuota akun demo utama. Test M3 menerima override email fixture tanpa mengubah assertion.

## I. Batasan yang tersisa

- Satu panggilan Gemini live berhasil. Ketersediaan, latensi, biaya, dan kualitas keluaran dapat berubah menurut quota dan model provider; uji ini tidak mengukur reliabilitas jangka panjang.
- Konfigurasi secret, kuota, scheduler retensi 30 hari, dan monitoring pada hosted/staging belum diuji. Deployment publik memerlukan gate lingkungan tersendiri.
- Review semantik manusia atas foto dan saran tetap wajib. Parser deterministik hanya menyaring bentuk output dan beberapa klaim eksplisit.
- Audit aksesibilitas lintas aplikasi terhadap banner simulasi global masih terbuka. Zoom asli diuji pada Chromium; Safari tidak berhasil dikendalikan pada sesi ini.

## J. Final M4 release gate

**PASS untuk release gate M4 pada lingkungan development lokal.** Semua tes wajib yang diminta pada verifikasi final ini telah dijalankan dan lulus, termasuk satu panggilan Gemini nyata, fallback manual, RLS, browser zoom 200%, dan regresi M1–M3. Status ini **tidak** menyatakan deployment hosted/staging telah lulus. Checkpoint commit yang direkomendasikan setelah review: `feat: integrate Gemini SmartSpot with verified manual fallback`. Belum ada push atau merge.
