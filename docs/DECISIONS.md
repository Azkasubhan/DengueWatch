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
- **Keputusan:** (dihapus oleh T30 dan T31) trigger database membatasi 30 lease upload per akun per jam, sedangkan RPC
  membatasi 10 laporan per akun per jam (batas laporan dihapus oleh T30). Keduanya
  berlaku lintas instance aplikasi.
- **Alasan:** mencegah storage abuse dasar tanpa menambah in-memory limiter yang tidak
  konsisten pada beberapa instance.

## T14 — Ledger kuota yang bertahan setelah lease dihapus

- **Status:** accepted dan diverifikasi, 31 Oktober 2026.
- **Keputusan:** migration keenam mencatat setiap reservasi ke tabel append-only
  `report_upload_attempts`; trigger kuota menghitung ledger ini, bukan baris lease aktif.
- **Alasan:** hitungan pada `report_uploads` dapat dilewati dengan menghapus lease segera
  setelah upload. Ledger tetap menghitung percobaan dalam jendela satu jam. pgTAP menguji
  bahwa penghapusan lease tidak mereset hitungan dan reservasi ke-31 ditolak. Dihapus
  bersama kuotanya oleh T31.

## T15 — Analisis sebelum submit memakai lease foto M3

- **Status:** accepted untuk M4 lokal, 31 Oktober 2026.
- **Keputusan:** Gemini menerima satu WebP privat yang sudah dinormalisasi oleh M3.
  `ai_analyses.upload_id` mengaitkan hasil pra-submit; trigger pada `report_images`
  menambahkan `report_id` saat foto difinalisasi. M3 RPC tidak diubah.
- **Alasan:** tidak membuat laporan kosong atau workflow upload kedua. Jika lease dihapus,
  FK `ON DELETE SET NULL` mempertahankan metadata analisis sampai retensi berakhir.

## T16 — Kuota AI terpisah dan adapter uji lokal

- **Status:** accepted untuk M4 lokal, 31 Oktober 2026.
- **Keputusan:** RPC user-scoped memesan satu analisis dengan advisory lock, batas
  10/jam, 30/hari (dihapus oleh T32), dan satu permintaan aktif per akun. Catatan aktif memiliki lease satu
  menit. Finalisasi server-only memakai secret key. SDK resmi `@google/genai` 2.32.0
  memakai model dari `GEMINI_MODEL`, timeout per percobaan, maksimal dua percobaan untuk
  429/5xx, dan validasi output di aplikasi.
- **Alasan:** kuota lintas instance dan biaya AI tidak boleh dicampur dengan kuota laporan.
  Adapter deterministik hanya tersedia di mode development/test dengan flag eksplisit dan
  Supabase loopback; tidak menjadi provider pengganti produksi.
- **Batasan:** tanpa key Gemini development, model/quota project dan hasil live belum
  diverifikasi. Hosted scheduler retensi 30 hari masih perlu diatur.

## T17 — Hardening scope catatan AI

- **Status:** accepted dan diuji lokal, 31 Oktober 2026.
- **Keputusan:** migration kedelapan memperketat RLS `ai_analyses`: pemilik harus masih
  memiliki role resident dan membership terverifikasi pada area analisis. Trigger hanya
  menautkan analisis ke report jika area analisis sama dengan area report.
- **Alasan:** ownership UUID saja tidak cukup setelah membership dicabut, dan upload M3
  dapat dipakai resident yang memiliki lebih dari satu area. pgTAP membuktikan akses
  catatan lama hilang setelah membership dicabut.

## T18 — Review laporan melalui RPC atomik M5

- **Status:** accepted dan diuji lokal, 31 Oktober 2026.
- **Keputusan:** migration kesembilan menambah `review_report`, `add_report_information`,
  dan `get_report_ai_suggestions` (definer, `search_path` kosong, hanya `authenticated`).
  Role, area, ownership, status, dan `expectedVersion` dicek di database; laporan di luar
  scope menghasilkan `P0404`, role salah `P0403`, versi lama `P0409`, transisi ilegal atau
  input tidak valid `P0422`. Duplicate hanya boleh menunjuk laporan lebih awal di area
  sama yang bukan `rejected`/`duplicate`. Tiap `event_type` dikunci ke satu transisi PRD
  §8.1 melalui CHECK, dan trigger menolak UPDATE/DELETE langsung pada `report_events`.
- **Alasan:** status, versi, dan audit ditulis dalam satu transaksi dengan row lock.
  RLS `ai_analyses` tetap owner-only; kader hanya menerima field saran yang disanitasi.
  Manager membaca koordinat persis di area kelolanya sesuai PRD §10.5 dan §11.2, sehingga
  tidak ada patch akses koordinat.

## T19 — ActionLoop atomik M6

- **Status:** accepted dan diuji lokal, 31 Oktober 2026.
- **Keputusan:** migration kesepuluh menambah `action_tasks`, `task_events`, `task_evidence`,
  dan enam RPC (`create_action_task`, `start_action_task`, `submit_task_evidence`,
  `review_task_evidence`, `cancel_action_task`, `reopen_action_task`). Tidak ada status
  `draft`. Assignee MVP adalah kader terverifikasi di area laporan; manager hanya membaca.
  `reopened` kembali ke `in_progress` melalui `start`. `cancelled` hanya dari status aktif
  dan dengan alasan. Bukti memakai satu lease upload M3 privat per pengiriman; reviewer
  harus berbeda dari pengirim (RPC dan CHECK). Laporan `verified → in_action` saat task
  pertama dibuat, `in_action → resolved` hanya bila ada ≥1 task wajib aktif dan semuanya
  `completed`, serta `resolved → in_action` saat task wajib dibuka ulang dengan alasan.
- **Alasan:** setiap mutation mengunci baris laporan lalu task, sehingga persetujuan paralel
  pada task berbeda tidak dapat melewatkan penutupan laporan. Event task dan laporan
  dikunci ke transisi PRD melalui CHECK dan trigger append-only.

## T20 — Lease upload bertujuan untuk bukti tugas

- **Status:** accepted dan diuji lokal, 31 Oktober 2026.
- **Keputusan:** migration kesebelas menambah `purpose` (`report`/`task_evidence`) dan
  `task_id` pada `report_uploads`. Lease bukti hanya dibuat oleh
  `reserve_task_evidence_upload` untuk assignee task `in_progress` di areanya. Trigger
  menolak lease bukti sebagai foto laporan, serta lease laporan atau lease task lain sebagai
  bukti. Route upload warga tetap khusus resident; kader memakai
  `POST /api/v1/tasks/:id/evidence-uploads` dengan pipeline M3 yang sama (signature, batas
  ukuran, re-encode WebP tanpa EXIF).
- **Alasan:** pemeriksaan `created_by` saja tidak mencegah replay foto antar task milik
  kader yang sama. API hanya mengembalikan penanda `assignedToMe`/`submittedByMe`, bukan ID
  profil kader lain.

## T21 — Definisi ringkasan pengelola M7-A

- **Status:** accepted dan diuji lokal, 31 Oktober 2026.
- **Keputusan:** `get_manager_report_summary` (security invoker, RLS tetap berlaku) menghitung
  KPI dari `reports`, `report_events`, dan `action_tasks` di area manager terverifikasi. Kohort
  adalah laporan yang dikirim pada rentang tanggal WIB (default 30 hari, maksimal 366 hari);
  status adalah snapshot saat `as_of`. Ember status: menunggu pemeriksaan
  (`pending_verification`, `needs_information`), dalam penanganan (`verified`, `in_action`,
  termasuk yang dibuka kembali), selesai (`resolved`), tidak diproses lanjut (`rejected`,
  `duplicate`). Tingkat penyelesaian = selesai / (dalam penanganan + selesai); `null` bila
  pembagi nol. Task yang dibatalkan tidak dihitung langsung; pengaruhnya hanya melalui
  status laporan. Median keputusan kader = dikirim → keputusan kader pertama; median
  penyelesaian = verifikasi pertama → `resolved_at` saat ini.
- **Alasan:** angka deterministik dari database, tanpa Gemini, tanpa identitas, foto, atau
  koordinat dalam payload.

## T22 — Target deployment: VPS self-hosted + Supabase Cloud

- **Keputusan:** satu instance Next.js (`next start`, bind `127.0.0.1:3000`) di VPS Linux
  2 vCPU/4 GB di belakang Nginx (TLS, hanya port 80/443 publik); Supabase Cloud untuk
  PostgreSQL/Auth/Storage; Gemini tetap eksternal. Bukan Vercel. Batas foto asli tetap 5 MiB
  tanpa kompresi client; Nginx `client_max_body_size 8m`, aplikasi tetap membatasi body 6 MiB
  dan file 5 MiB. Di production origin publik dipatok ke `APP_BASE_URL` (`requestOrigin`, fail-closed bila tidak valid) karena `request.url` pada `next start` memakai alamat bind; header proxy hanya dipakai di development. Cleanup lease
  dan retensi AI berjalan lewat systemd timer dengan opt-in `ALLOW_HOSTED_CLEANUP=true` dan `CLEANUP_PROJECT_REF` yang harus cocok dengan URL.
- **Alasan:** hemat biaya dan RAM, tanpa melonggarkan RLS/RPC, private Storage, atau audit.
  Rincian: `docs/DEPLOYMENT_VPS.md`.

## T23 — Art direction landing publik

- **Keputusan:** pemilik produk membuka kunci desain UI untuk landing publik. Landing memakai
  palet natural yang di-scope ke `.landing` (krem, hutan, tanah liat, tombol pill; token
  aplikasi tidak berubah). Struktur terinspirasi shot "Nature Landing Page!" (robiulalam6)
  tanpa menyalin visualnya: hero foto penuh dengan navigasi di atas foto, kalimat dengan pil
  foto, tiga kartu (alur, penanggung jawab, aturan 2 kader), kategori laporan dengan foto dan
  kartu contoh laporan, empat tahap Temukan/Tindak/Tuntaskan/Pantau, jenis temuan dan
  penanganannya, kegiatan pencegahan, banner CTA, peran, templat tim, batasan, FAQ, footer
  gelap dengan templat kontak (nilai kosong tidak ditampilkan), serta halaman
  `/kebijakan-privasi` dan `/syarat-layanan` yang isinya mengikuti fitur yang ada. Angka hanya
  aturan sistem, bukan klaim dampak. Landing tidak memuat catatan demo atau keterangan foto.
- **Identitas:** simbol tetesan air dengan centang (`BrandMark`) di samping wordmark, juga
  sebagai favicon (`src/app/icon.svg`) dan ikon layar utama (`src/app/apple-icon.png`).
- **Tetap berlaku:** WCAG 2.2 AA, Bahasa Indonesia, tanpa klaim diagnosis, kemitraan, atau
  hasil epidemiologis. Label SIMULASI di dalam aplikasi tetap mengikuti data (`is_demo`).

## T24 — Sistem desain aplikasi yang konsisten dengan landing

- **Keputusan:** palet natural dipromosikan ke token global; aplikasi memakai kit komponen
  bersama (`PageHeader`, `StatusBadge`, `Card`, `EmptyState`, `LoadingState`) dan `AppShell`
  baru (simbol brand, chip peran, navigasi berikon dengan halaman aktif, bar wilayah).
  Label kecil di atas judul dihapus. Status laporan dan tugas memakai satu pemetaan nada.
  Antrean verifikasi menampilkan penanda umur "Menunggu N hari". Beranda warga menampilkan
  laporan terbaru dan alur pemrosesan. Batas input memakai `--control-border` agar memenuhi
  kontras non-teks 3:1. ESLint menolak warna hex mentah di `src`.
- **Tetap berlaku:** teks status, label, dan alur yang diuji E2E tidak berubah; RLS, RPC, dan
  logika fitur tidak disentuh.

## T25 — Satu saran AI per laporan dan retensi 24 jam

- **Keputusan:** trigger `link_ai_analysis_to_report` hanya menautkan analisis sukses terbaru
  untuk foto sampul ke laporan; kader melihat satu saran. Percobaan lain tetap tidak tertaut
  dan ikut dihitung kuota. `reserve_ai_analysis` menghapus analisis tidak tertaut yang berumur
  lebih dari 24 jam (di luar jendela kuota harian) untuk semua akun. Migration
  `202611030001` melepas tautan saran lama pada laporan yang sudah ada.
- **Alasan:** kader butuh satu saran yang tegas; riwayat permintaan ulang tidak membantu
  keputusan dan sejalan dengan retensi metadata terbatas (FR-24).
- **Tetap berlaku:** cleanup hanya menghapus catatan di luar jendela 24 jam (kuota per akun
  yang dulu bergantung padanya dihapus oleh T32); saran yang tertaut mengikuti cleanup 30 hari.

## T26 — Navbar publik liquid glass yang melayang

- **Keputusan:** `SiteHeader` menjadi satu varian: pill `fixed` di atas semua section landing
  dan halaman legal, dengan `.glass-nav` (latar surface 76%, blur 20px, saturasi 160%,
  sorot tepi putih, bayangan lembut). Teks gelap dipakai di atas foto maupun section terang.
  `scroll-padding-top` menjaga judul section tidak tertutup. Di bawah 380px hanya simbol brand
  yang tampil; nama tetap terbaca pembaca layar. Halaman aplikasi tidak memakai kaca.
- **Fallback:** latar padat bila `prefers-reduced-transparency: reduce` atau browser tidak
  mendukung `backdrop-filter`.
- **Alasan:** permintaan product owner; satu-satunya pengecualian aturan tanpa glassmorphism.

## T27 — Alur dipimpin pengelola: verifikasi, penugasan, dan pemeriksaan bukti

- **Status:** diputuskan product owner, 4 November 2026. Menggantikan aturan peran pada PRD
  6.2–6.3 dan T18/T19 yang menyebut kader memverifikasi serta pengelola hanya memantau.
- **Keputusan:** laporan warga masuk ke antrean pengelola area (`/pengelola/verifikasi`).
  Pengelola memverifikasi, meminta informasi, menolak, atau menandai duplikat; membuat task
  dan menugaskan kader terverifikasi area itu (`action_task_assignees`, kolom
  `assigned_to` dihapus); memeriksa bukti; serta membatalkan atau membuka kembali task.
  Setiap kader yang ditugaskan dapat memulai task dan mengirim bukti (sejak T33 setiap kader
  wajib mengirim bukti sendiri). Kader hanya melihat
  task yang ditugaskan kepadanya dan laporan terkait (foto, lokasi privat). Migration
  `202611040001` mengganti RPC M5/M6 (`review_report`, `create_action_task(uuid[])`,
  `review_task_evidence`, `cancel_action_task`, `reopen_action_task`,
  `get_report_ai_suggestions`, `reserve_task_evidence_upload`), `can_read_report`,
  `can_read_task`, dan menambah `list_area_cadres` serta `list_task_assignees` (nama tanpa ID).
- **Tetap berlaku:** RPC atomik, optimistic concurrency, idempotency, audit append-only,
  pengirim bukti tidak pernah memeriksa buktinya sendiri (CHECK), aturan penutupan laporan
  T19, dan scope area. Kader di luar daftar penugasan menerima 404, bukan 403.
- **Alasan:** rantai komando yang jelas (pengelola membagi tugas, kader mengerjakan) dan
  wilayah dengan satu kader tetap dapat menuntaskan laporan.

## T28 — Penugasan kader tanpa batas, tenggat tanggal wajib, semua tugas wajib

- **Status:** diputuskan product owner, 4 November 2026. Mengubah batas 1–10 kader dari T27
  dan field `dueAt`/`isMandatory` pada API pembuatan task.
- **Keputusan:** pengelola memilih kader satu per satu (dropdown nama + "Tambah kader"),
  minimal satu dan tanpa batas tetap; batas praktisnya jumlah kader terverifikasi area, dan
  RPC tetap memeriksa setiap ID. Tenggat wajib berupa tanggal (`dueDate`, `YYYY-MM-DD`),
  dari hari ini sampai 366 hari ke depan menurut WIB, disimpan sebagai 23.59.59 WIB pada
  `due_at`. Setiap task baru `is_mandatory = true`; field `isMandatory` dihapus dari API.
  Rentang tanggal diperiksa setelah pencarian idempotency, sehingga retry dengan kunci yang
  sama setelah tengah malam tetap mengembalikan task semula. Tombol "Buat tugas" nonaktif
  bila area belum punya kader terverifikasi.
- **Tetap berlaku:** task lama yang terlanjur opsional tetap tercatat dan diabaikan oleh
  aturan resolusi T19; UI hanya memberi label "Opsional" pada task tersebut.
- **Alasan:** semua tugas memang harus tuntas agar laporan selesai, dan tenggat tanpa jam
  lebih mudah dipilih serta dibaca kader.

## T29 — AI mengisi formulir laporan secara langsung

- **Status:** diputuskan product owner, 4 November 2026. Menggantikan panel "Saran AI"
  terpisah dan tombol "Bantu dengan Gemini" pada M4.
- **Keputusan:** memilih foto langsung mengunggah foto pertama secara privat dan meminta
  analisis AI. Hasilnya mengisi kategori, yang tampak pada foto, deskripsi, dan saran
  pencegahan, tetapi hanya pada kolom yang masih kosong atau masih berisi isian AI yang belum
  diubah (misalnya setelah foto diganti). Keempat kolom wajib (kolom baru
  `reports.visible_objects` 5–500 karakter dan `reports.prevention_advice` 10–500
  karakter; laporan lama tetap `NULL`) dan dapat diedit; kolom yang diisi AI diberi
  penanda sampai diubah. Batasan AI tidak lagi ditampilkan. Bila AI limit, gagal, atau
  dibatalkan, warga mengisi sendiri; tombol "Analisis ulang" memakai unggahan yang sama.
  Mengirim laporan saat analisis masih berjalan membatalkan analisis itu, sehingga AI yang
  lambat tidak pernah menghalangi pelaporan manual. Halaman pengelola tidak lagi memiliki
  panel saran; label "Diisi dengan bantuan AI" muncul bila minimal satu kolom teks masih
  identik dengan hasil AI yang tertaut, ditambah "tidak diubah warga" bila keempat kolom
  identik.
- **Tetap berlaku:** validasi output, guard klaim, kuota, satu analisis tertaut per
  laporan (T25), retensi, dan Gemini tidak pernah menerima lokasi atau data akun.
- **Alasan:** alur lebih singkat bagi warga, sementara kontrol isi tetap di tangan warga
  dan pengelola dapat melihat laporan yang dikirim apa adanya dari AI.

## T30 — Batas 10 laporan per jam dihapus

- **Status:** diputuskan product owner, 4 November 2026. Mengubah sebagian T13.
- **Keputusan:** RPC `create_environmental_report` tidak lagi menolak laporan ke-11 dalam
  satu jam, dan API tidak lagi memetakan `RATE_LIMIT` untuk pembuatan laporan.
- **Tetap berlaku:** membership area terverifikasi, idempotency, serta verifikasi manusia
  oleh pengelola. Kuota AI per akun kemudian dihapus oleh T32.
- **Risiko yang diterima:** satu akun dapat mengirim lebih banyak laporan. Batas unggah
  yang semula membatasinya secara tidak langsung juga dihapus (T31).

## T31 — Batas 30 unggahan foto per jam dihapus

- **Status:** diputuskan product owner, 4 November 2026. Menghapus sisa T13 dan T14.
- **Keputusan:** migration `202611040004` menghapus trigger
  `report_upload_quota_before_insert`, fungsi `private.enforce_report_upload_quota`, dan
  tabel ledger `report_upload_attempts`. API unggah foto laporan dan bukti tugas tidak lagi
  memetakan `RATE_LIMIT`.
- **Tetap berlaku:** pemilik terautentikasi, validasi signature/decode/dimensi, normalisasi
  WebP tanpa metadata, bucket privat, lease satu jam, dan cleanup lease tak terpakai. Kuota AI
  per akun kemudian dihapus oleh T32.
- **Risiko yang diterima:** tidak ada batas jumlah unggahan per akun, sehingga
  penyalahgunaan storage oleh akun terverifikasi hanya dibatasi oleh ukuran file dan masa
  lease. Sejak T29 setiap pemilihan foto langsung mengunggah, sehingga batas lama mudah
  tercapai saat demo.

## T32 — Tanpa kuota AI per akun

- **Status:** diputuskan product owner, 4 November 2026. Menghapus batas 10/jam dan 30/hari
  dari T16.
- **Keputusan:** migration `202611040005` mengganti `reserve_ai_analysis` tanpa pemeriksaan
  kuota per akun, sehingga akun demo dan akun asli berperilaku sama. Service tidak lagi
  memetakan `P0429` dari RPC.
- **Tetap berlaku:** satu analisis aktif per akun (409), membership area, kepemilikan dan
  lease foto, validasi output, retry provider, purge analisis tak tertaut setelah 1 hari,
  dan pemetaan batas dari Gemini sendiri (HTTP 429) ke pesan "Batas bantuan AI tercapai".
- **Risiko yang diterima:** kuota Gemini berlaku per project (free tier: 15 RPM, 500 RPD
  saat ini), sehingga satu akun dapat menghabiskan kuota untuk semua pengguna. Bila itu
  terjadi, warga tetap dapat mengisi formulir secara manual.

## T33 — Setiap kader pelaksana wajib mengirim bukti

- **Status:** diputuskan product owner, 4 November 2026. Mengubah sebagian T27.
- **Keputusan:** task dengan beberapa kader baru `completed` setelah **setiap** kader pelaksana
  memiliki bukti `approved` pada putaran berjalan. Migration `202611040006`:
  - `action_tasks.evidence_round` dan `task_evidence.evidence_round`; reopen menaikkan putaran
    sehingga semua kader mengirim ulang.
  - Satu bukti `pending` per kader (`idx_task_evidence_one_pending_per_cadre`); kader dengan
    bukti `pending`/`approved` di putaran ini ditolak (`EVIDENCE_ALREADY_SUBMITTED`, 422) saat
    memesan lease maupun mengirim bukti.
  - `review_task_evidence(task, evidence, decision, reason, expectedVersion)` memeriksa satu bukti.
    Status berikutnya: `completed` bila semua kader disetujui, `awaiting_review` bila masih ada
    bukti pending, selain itu `in_progress`. Metadata event menyimpan `remaining`.
  - `list_task_assignees` juga mengembalikan `profile_id` untuk dicocokkan server dengan bukti;
    ID itu tidak dikirim ke browser.
- **Tetap berlaku:** satu kader cukup untuk memulai task; revisi hanya untuk kader yang
  bersangkutan; bukti yang sudah disetujui tidak berubah; AC-42 dan larangan self review.
- **Risiko yang diterima:** kader yang kehilangan akses area menahan task terbuka; pengelola
  dapat membatalkan task lalu membuat task baru. Task lama yang sudah `completed` tidak dihitung
  ulang.
