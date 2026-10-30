# DENGUEWATCH — PRODUCT REQUIREMENTS DOCUMENT (PRD)

> **Smart Community Dengue Prevention & Verified Action Platform**  
> **Tagline:** *Temukan. Tindak. Tuntaskan.*  
> **Kompetisi:** INVOFEST 2026 — National Web Design Competition  
> **Tema:** Smart Ecosystems: Digital Solutions for a Sustainable Future  
> **Subtema:** Health & Well-being for All (SDG 3)  
> **Status:** Spesifikasi produk / rancangan yang **belum** diimplementasikan  
> **Tanggal dokumen:** 29 Oktober 2026 (Asia/Jakarta)  
> **Target submission kompetisi:** 7 November 2026  
> **Audience:** Tim DengueWatch, coding agent **Antigravity**, reviewer UI/UX, developer, dan juri.  
> **Bahasa produk:** Bahasa Indonesia (`id-ID`); nama variabel/kode, schema database, endpoint, dan komentar teknis menggunakan bahasa Inggris yang konsisten.

---

### Navigasi dokumen

- **Fondasi dan produk:** bagian 0–8 (instruksi Antigravity, problem, user, fitur, workflow, state machine).
- **Spesifikasi teknis:** bagian 9–12 (arsitektur, database, kontrak API, validasi input lintas layer).
- **Desain dan engineering:** bagian 13–16 (design tokens anti-slop, sitemap, clean code, library/GitHub).
- **Reliability dan release:** bagian 17–23 (keamanan, NFR, testing, jadwal, demo, risiko, release checklist).
- **Panduan eksekusi dan sumber:** bagian 24–26 (cara pakai di Antigravity, referensi, prinsip penutup).

---

## 0. PETUNJUK WAJIB UNTUK ANTIGRAVITY — BACA TERLEBIH DAHULU

**Status instruksi:** Bagian ini adalah acceptance contract. Jangan langsung membuat semua halaman atau menjalankan generator template sebelum membaca seluruh PRD.

1. **PRD ini adalah source of truth** untuk cakupan produk, workflow, arsitektur, keamanan, validasi, design system, dan prioritas pengembangan. Jika ada konflik dengan contoh UI generik, **PRD menang**.
2. **Bangun aplikasi sungguhan, bukan showcase palsu.** Tombol harus berfungsi, data berasal dari database atau seed demo yang jelas, state harus persisten, dan role harus dicek server-side. Jangan membuat *fake AI result* lalu mengklaim itu respons API nyata.
3. **Kerjakan berurutan:** audit repo → implementation plan singkat → database + RLS → auth/role → laporan → verifikasi → action workflow → Gemini → dashboard/map → PSN → QA → demo. Tiap milestone wajib build dan test.
4. **Gunakan desain yang terkendali:** tanpa gradient dekoratif, glow, glassmorphism, neon, kartu KPI warna-warni, emoji pengganti ikon, grafik warna pelangi, animasi masuk massal, atau template dashboard generik. Jangan memaksakan style dari skill eksternal yang bertentangan dengan bagian Design System.
5. **Keamanan bukan pilihan:** validasi frontend, shared schema, API/server, izin akses, batasan business rule, constraint database, dan policy Supabase. Client dianggap tidak tepercaya; data keluaran Gemini juga tidak tepercaya.
6. **Pemisahan tanggung jawab:** UI tidak berisi business rules; Route Handlers melakukan orchestration; service menangani use case; repository/data access menangani query; schema validasi terpusat.
7. **Tidak boleh menampilkan data kesehatan atau lokasi rumah nyata pada peta publik.** Gunakan seed fiktif, strip metadata EXIF, private bucket, dan pembatasan akses per wilayah.
8. **Sistem tidak mendiagnosis DBD**, tidak memastikan spesies nyamuk atau keberadaan jentik dari foto, tidak membuat probabilitas penyakit dari Gemini, dan tidak mengklaim bisa mengurangi jumlah kasus tanpa evaluasi lapangan.
9. **Selesaikan alur vertikal** warga melapor → Gemini mengusulkan kategori → warga mengonfirmasi → kader verifikasi → tugas dibuat → bukti diunggah → kader menyetujui → dashboard memperlihatkan perubahan. Ini lebih penting daripada banyak halaman dekoratif.
10. **Sebelum menulis kode:** audit versi package dan dokumentasi terkini. Jangan mengunci atau menebak versi API/model Gemini; gunakan model ID yang tersedia pada akun saat implementasi melalui environment variable.
11. **Setelah setiap tahap:** jalankan lint, typecheck, unit/integration tests relevan, dan tinjau UI pada lebar 390/768/1440 px. Catat blocker dan pekerjaan tersisa secara jujur; jangan menyatakan selesai tanpa verifikasi.
12. **Jika environment/secrets layanan belum tersedia:** buat adapter dan *demo mode* yang jelas bertanda SIMULASI; jangan mengarang secret, API key, pengguna, integrasi, atau data nyata. Jalur demo harus menunjukkan perilaku yang benar, bukan keberhasilan palsu.
13. **Tidak boleh menyalin desain/implementasi SILANTIK, DengueChat, atau proyek Devpost**. Pelajari workflow dan problem, tetapi buat visual, source code, konten, data, dan alur yang orisinal serta patuhi lisensi.
14. Jangan menambahkan backend microservices, machine learning prediksi epidemiologi, payroll kader, live patient case surveillance, atau CMS tanpa kebutuhan yang eksplisit.
15. Untuk perubahan yang menyimpang dari PRD, masukkan catatan singkat ke `docs/DECISIONS.md` dengan alasan, dampak, alternatif, dan status.

**Definisi selesai:** fitur benar-benar dapat digunakan end-to-end dalam skenario acceptance test; validasi dan RLS diuji; layout responsif; tidak terdapat dead buttons, placeholder yang disamarkan sebagai fitur, atau data sintetis yang diklaim nyata.

---

## 1. EXECUTIVE SUMMARY

**DengueWatch** adalah platform web responsif yang membantu komunitas melakukan pencegahan dengue secara lebih terorganisasi. Fokusnya **bukan** prediksi medis atau diagnosis, melainkan menutup kesenjangan antara **temuan potensi habitat nyamuk → pelaporan → verifikasi kader → penugasan → tindak lanjut → verifikasi penyelesaian → pengukuran proses pencegahan**.

DengueWatch melibatkan tiga peran operasional:

- **Warga (`resident`)**: mencatat temuan lingkungan, melihat progres penanganan, dan menjalankan checklist pemberantasan sarang nyamuk (PSN) mingguan.
- **Kader Jumantik (`cadre`)**: memverifikasi temuan dalam wilayah tugas, mengoordinasikan penanganan, memeriksa bukti hasil, dan mengelola inspeksi terverifikasi bila modul tersedia.
- **Pengelola kesehatan/komunitas (`manager`)**: memantau agregat laporan, durasi penanganan, partisipasi PSN, serta membantu perencanaan aksi berbasis data tanpa mengakses informasi di luar wewenang.

**Gemini AI** digunakan sebagai *assistive intelligence*: analisis awal foto lingkungan dan penyusunan deskripsi/kategori yang dapat dikoreksi warga; ringkasan laporan agregat bagi pengelola. Seluruh keputusan penting tetap melalui validasi manusia. **Model AI bukan sumber kebenaran kesehatan.**

### 1.1 Nilai unik produk (*proposed differentiation*)

- **Verified Action Loop**: laporan tidak dianggap selesai hanya karena petugas menekan tombol; ada bukti tindak lanjut dan pemeriksaan hasil.
- **Citizen → Cadre handoff** yang transparan, disertai perubahan status dan audit trail.
- **PSN weekly habit** yang mendorong tindakan pencegahan berulang, tidak terbatas pada pelaporan ketika kasus meningkat.
- **Contextual Gemini assistance** yang mempercepat pengisian laporan tanpa membuat kesimpulan medis palsu.
- **Privacy-first community analytics**: publik hanya melihat ringkasan area, bukan titik rumah/identitas warga.

> **Klaim inovasi harus dirumuskan hati-hati:** DengueChat, SILANTIK, dan berbagai solusi surveilans telah mencakup sebagian aspek tersebut. Keunggulan DengueWatch harus dibuktikan melalui implementasi alur lokal RT/RW, kemudahan penggunaan, dan verifikasi tindakan — bukan klaim bahwa ide pelaporan/pemetaan DBD belum pernah ada.

### 1.2 Outcome yang diharapkan

1. Warga dapat membuat laporan lengkap dengan cepat dan memahami tindak lanjutnya.
2. Kader dapat memverifikasi, menugaskan, dan menutup laporan dengan jejak audit.
3. Pengelola memiliki statistik operasional untuk mengidentifikasi pekerjaan yang masih tertunda.
4. Kegiatan PSN mingguan mudah dicatat dan dipantau secara agregat.
5. Demo menunjukkan kualitas visual sekaligus fungsi nyata, sesuai bobot penilaian web design INVOFEST.

**Bukan outcome yang boleh dijanjikan untuk prototipe:** pengurangan kejadian dengue sejumlah persentase tertentu, prediksi wabah tervalidasi, identifikasi jentik dari gambar dengan akurasi medis, atau integrasi resmi dengan sistem kesehatan pemerintah.

---

## 2. SUMBER, DASAR MASALAH, DAN BATAS KEPASTIAN

### 2.1 Fakta dari sumber primer/terpercaya

- WHO Indonesia (30 Maret 2026) melaporkan **lebih dari 257.000 kasus** dan **lebih dari 1.400 kematian dengue di Indonesia pada tahun 2024**. WHO menyebut keterlambatan deteksi, keterbatasan kapasitas diagnostik, kesulitan koordinasi, dan partisipasi masyarakat yang rendah sebagai tantangan. **Sumber:** https://www.who.int/indonesia/id/news-room/item/30-03-2026-shaping-indonesia-s-path-towards-zero-dengue-deaths-by-2030
- Kementerian Kesehatan mengeluarkan **Surat Edaran HK.02.02/C/861/2026**, ditetapkan **18 Februari 2026**, mengenai kewaspadaan terhadap potensi KLB dengue. Dokumen menekankan kegiatan **PSN 3M Plus**, **Gerakan 1 Rumah 1 Jumantik (G1R1J)**, evaluasi lingkungan, dan pemantauan jentik secara berkala **setidaknya sekali setiap minggu**. **Sumber JDIH:** https://jdih.kemkes.go.id/documents/surat-edaran-direktur-jenderal-penanggulangan-penyakit-nomor-hk0202c8612026
- Informasi kesehatan resmi WHO: https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue
- Tujuan pembangunan berkelanjutan: SDG 3 (khususnya 3.3 dan 3.d sebagai hubungan konseptual), lihat https://sdgs.un.org/goals/goal3

### 2.2 Bukti dan inspirasi dari materi pengguna

1. **Guidebook Web Design INVOFEST 2026**: tema, subtema Health & Well-being for All (SDG 3), HTML/CSS/JS wajib, framework diperbolehkan, tidak boleh full template atau CMS; tenggat karya **7 November 2026**; rubrik penyisihan desain 30%, inovasi 25%, usability/responsiveness 20%, orisinalitas 15%, kesesuaian tema 10%; video demo 3–10 menit, minimal 720p, dokumentasi PDF, pernyataan orisinalitas, tautan cloud/repository. File sumber: `Guidebook Web Design.docx.pdf`.
2. **Pitch deck SILANTIK**: menunjukkan alur inspeksi Jumantik, laporan manual, konsolidasi laporan, digitalisasi form, AI report extraction, local-first, analytics, serta koordinasi Puskesmas. Ini **benchmark dan pembanding**, bukan spesifikasi DengueWatch. Nama file: `Salinan dari [ENG] Pitch Deck SILATIK.pdf`.
3. **ExCellera (NexusOne)**: benchmark pembuatan problem statement, value proposition, persona/journey, dampak, dan rancangan ekosistem — bukan sumber data epidemiologi DengueWatch.
4. **AksesKelas (Alaska)**: benchmark desain dua peran, pipeline Gemini dengan human review, aksesibilitas, arsitektur Next.js/TypeScript — bukan karya yang akan didaftarkan ulang.

### 2.3 Hipotesis yang masih memerlukan riset pengguna

Pernyataan berikut **belum boleh ditulis sebagai fakta universal** tanpa wawancara/observasi:

- Semua RT/RW masih melapor secara manual atau tidak punya saluran digital.
- Laporan warga secara rutin tidak ditangani atau tidak jelas statusnya.
- Kader Jumantik di lokasi target membutuhkan fungsi dashboard ini.
- Pengurus RT/RW bersedia memakai platform baru dan memberi akses data.
- Foto lingkungan cukup untuk mengidentifikasi seluruh objek/risiko dengan benar.
- Menggunakan DengueWatch akan menurunkan jumlah kasus DBD.

**Rencana validasi:** wawancara 1–3 warga, 1–2 kader/pengurus, dan bila memungkinkan 1 tenaga kesehatan/Puskesmas; validasi workflow aktual, frekuensi inspeksi, proses eskalasi, kepemilikan data, dan toleransi terhadap laporan palsu.

### 2.4 Problem statement

> Pencegahan dengue membutuhkan partisipasi masyarakat, pemantauan lingkungan yang berkelanjutan, serta koordinasi penanganan antara warga, kader, dan pengelola. Namun proses pelaporan, verifikasi, penugasan, dan konfirmasi penyelesaian berpotensi terfragmentasi. DengueWatch mengusulkan alur digital yang aman, terlacak, dan mudah digunakan untuk mengubah temuan lingkungan menjadi tindakan pencegahan yang terverifikasi, dengan AI hanya sebagai alat bantu.

### 2.5 Root cause (hipotesis desain)

| Gejala | Penyebab hipotesis | Solusi web | Bukti yang dibutuhkan |
|---|---|---|---|
| Temuan lingkungan tidak tercatat | Kanal laporan tidak mudah diakses | Form mobile dan AI-assisted draft | Interview warga |
| Detail laporan tidak seragam | Format pelaporan berbeda | Kategori tetap, foto, lokasi, schema | Review contoh laporan |
| Pekerjaan tersendat | Tidak ada penugasan/status jelas | Action task dan owner | Interview kader/pengurus |
| Penyelesaian sulit diverifikasi | Tidak ada catatan before/after | Evidence + re-review | Observasi alur tindak lanjut |
| Partisipasi PSN tidak konsisten | Pengingat dan feedback terbatas | Weekly checklist | Uji coba rumah tangga |
| Data sulit diolah | Tidak ada agregasi status | Dashboard statistik | Interview pengelola |

---

## 3. GOALS, NON-GOALS, DAN PRINSIP PRODUK

### 3.1 Product goals

- **G1 — Accessible reporting:** warga dapat melapor di ponsel tanpa memahami istilah epidemiologi.
- **G2 — Traceable coordination:** setiap laporan valid memiliki status dan pemilik tindakan yang jelas.
- **G3 — Verified completion:** tugas selesai setelah evidence ditinjau kader, bukan oleh AI otomatis.
- **G4 — Preventive habit:** warga bisa melakukan checklist PSN per minggu (sukarela, tanpa klaim inspeksi resmi).
- **G5 — Actionable insights:** dashboard menjawab pekerjaan apa yang harus dilakukan berikutnya.
- **G6 — Original web design:** desain khas, konsisten, mobile-first, anti-slop, dapat digunakan.
- **G7 — Defensible security:** tidak terjadi horizontal/vertical privilege escalation, lokasi/identitas privat terlindungi, input tervalidasi.

### 3.2 Non-goals (dilarang masuk ruang lingkup MVP tanpa perubahan PRD)

- Diagnosis dengue atau konsultasi klinis otomatis.
- Menghitung skor probabilitas tertular DBD berdasarkan satu foto.
- Menduga titik lokasi pasien/kasus DBD dari laporan lingkungan.
- Prediksi epidemiologi/wabah tanpa model, dataset, dan validasi ilmiah.
- Sistem informasi pasien, rekam medis, e-prescribing, fogging scheduling otomatis.
- Akses publik ke nama, nomor telepon, foto rumah, dan koordinat presisi warga.
- Payroll kader, integrasi pembayaran, marketplace, gamifikasi kompetitif yang mendorong laporan spam.
- Aplikasi native iOS/Android terpisah.
- Microservices, event bus kompleks, Redis cluster, Kafka tanpa justifikasi kebutuhan.

### 3.3 Prinsip desain produk

- **Human-in-the-loop:** keputusan verifikasi, penugasan, dan penutupan dilakukan manusia.
- **Privacy by design:** minimalisasi data, least privilege, retensi terukur.
- **Evidence before claims:** data operasional dibedakan dari data klinis dan simulasi.
- **Accessible by default:** label jelas, keyboard-friendly, contrast AA, mobile usability.
- **Progressive disclosure:** form mudah dahulu, opsi lanjutan kemudian.
- **Action-first:** tiap halaman mempunyai tujuan utama yang jelas.
- **Honest system status:** error, pending, empty, unavailable, dan simulation mode ditampilkan apa adanya.

---

## 4. USER PERSONAS, ACTORS, JOBS-TO-BE-DONE

### 4.1 Resident / Warga (`resident`)

- **Profil:** usia dan literasi digital beragam; menggunakan ponsel dengan koneksi seluler; mungkin tidak memahami istilah teknis.
- **JTBD:** “Ketika menemukan potensi genangan atau wadah bermasalah, saya ingin melaporkannya dengan cepat dan mengetahui apakah ada tindakan.”
- **Pain points:** tidak tahu kategori laporan; lokasi sulit dijelaskan; khawatir identitas tersebar; tidak mendapat status.
- **Kebutuhan:** upload sederhana, AI draft yang jelas hanya saran, preview, koreksi, status laporan, checklist mingguan.
- **Sukses:** dapat menyelesaikan laporan tanpa instruksi tim developer.

### 4.2 Jumantik Cadre (`cadre`)

- **Profil:** menangani area terbatas; membutuhkan informasi yang valid; bisa menggunakan smartphone dan laptop.
- **JTBD:** “Ketika warga membuat laporan, saya ingin tahu mana yang perlu ditindaklanjuti, mengelola tugas, dan memastikan hasilnya.”
- **Pain points:** laporan tidak lengkap, duplikasi, sulit menemukan lokasi, belum ada bukti selesai.
- **Kebutuhan:** inbox per wilayah, detail jelas, verifikasi/reject/request info, assignment, evidence, history, filter.
- **Sukses:** mampu menyelesaikan siklus satu laporan dan menemukan tugas overdue.

### 4.3 Community/Health Manager (`manager`)

- **Profil:** pengelola program tingkat kelurahan/organisasi/Puskesmas dalam skenario demo; akses sesuai area.
- **JTBD:** “Ketika memonitor pencegahan lingkungan, saya perlu mengetahui backlog dan pola kegiatan untuk merencanakan tindak lanjut.”
- **Kebutuhan:** area overview, agregat laporan, completion rate, median response time, PSN participation, export yang aman (opsional).
- **Sukses:** dapat mengidentifikasi area/jenis temuan dengan pekerjaan tertunda.

### 4.4 Guest (`anonymous`)

- Boleh membaca landing page, cara kerja, konten edukasi yang telah diverifikasi, dan informasi publik yang aman. Tidak boleh membuat atau melihat laporan privat.

### 4.5 Role provisioning

- Semua registrasi publik menghasilkan role **resident** secara server-side.
- Role `cadre` / `manager` **tidak boleh** ditentukan melalui request user dan **tidak boleh** diedit oleh pengguna sendiri.
- Role diangkat melalui *authorized seed/invite/admin process* yang diaudit; untuk demo boleh lewat script seed yang aman di environment development, bukan backdoor di produksi.
- Setiap user mempunyai `area_id` atau keanggotaan terverifikasi; akses kader dibatasi pada area yang menjadi tanggung jawabnya.
- Jangan memakai role yang dapat diubah di `user_metadata` tidak tepercaya untuk authorization.

---

## 5. RUANG LINGKUP PRIORITAS

| Tingkat | Deliverable | Definisi |
|---|---|---|
| **P0 — wajib vertical slice** | Auth, role & area | Login, daftar warga, role server-side, area membership, RLS |
| **P0** | Create report | Foto, kategori, deskripsi, lokasi privat, validasi, persistensi |
| **P0** | Gemini assistance | Foto → JSON terstruktur → draft editable → human confirmation + fallback |
| **P0** | Cadre verification | Queue, accept/reject/request_info dengan audit |
| **P0** | Action workflow | Task assignment → progress → evidence → cadre review → close/reopen |
| **P0** | Citizen tracking | Timeline laporan yang jujur dan status up-to-date |
| **P0** | Core UI quality | Responsif, design tokens, accessibility, states, usable flow |
| **P1 — kuat untuk lomba** | Community map | Peta privat kader + tampilan publik agregat, legenda dan filter |
| **P1** | Analytics | KPI, trend, laporan per kategori/status, durasi penanganan |
| **P1** | Weekly PSN | Checklist rumah tangga, ringkasan partisipasi agregat |
| **P1** | AI management summary | Ringkasan **data agregat** untuk pengelola, dengan fallback non-AI |
| **P1** | Notification center | In-app notification untuk verifikasi/status/tugas |
| **P1** | Education module | 3M Plus, keterbatasan AI, kapan menghubungi fasilitas kesehatan |
| **P2 — jika P0/P1 sudah stabil** | Offline draft | Draft laporan lokal dan retry manual, tidak langsung sinkronisasi multi-device |
| **P2** | Community activity | Jadwal kegiatan dan partisipasi relawan |
| **P2** | Verified larvae inspections | Data pemeriksaan jentik yang terpisah dan mengikuti definisi program |
| **Future (bukan demo claim)** | Official surveillance/prediction | Memerlukan perjanjian data, penelitian, evaluasi, dan persetujuan institusi |

**Aturan trade-off:** Jika waktu terbatas, sempurnakan P0 sebelum P1. Jangan membuat halaman P1 yang hanya dekoratif dengan data fiktif seolah data nyata.

---

## 6. USER JOURNEYS DAN BUSINESS WORKFLOWS

### 6.1 Alur warga — dari foto ke laporan

1. Pengguna masuk / daftar; memilih area demo (atau area disetujui manager).
2. Dari dashboard warga, pilih **Buat Laporan**.
3. Pilih foto lingkungan, izinkan geolokasi (opsional) atau pilih titik melalui peta/area yang tersedia. Tidak meminta lokasi presisi kecuali benar-benar diperlukan.
4. Input deskripsi ringkas, pilih kategori manual atau klik **Bantu dengan Gemini**.
5. Backend memvalidasi foto lalu Gemini mengusulkan `visible_objects`, `suggested_category`, `draft_description`, `suggested_precaution`, `limitations`.
6. Hasil AI ditandai **Saran AI — belum terverifikasi**, tidak disimpan sebagai fakta medis. Pengguna boleh edit atau abaikan.
7. Pengguna meninjau preview dan *privacy notice*, kirim laporan.
8. Backend membuat laporan `pending_verification`; event `report_created` ditulis dalam satu transaksi logis.
9. UI menampilkan nomor laporan, tanggal, status, dan history.
10. Saat kader meminta informasi atau memproses laporan, status diperbarui.

**Alternative paths:** AI timeout → form manual tetap bisa dikirim; foto gagal upload → tidak membuat laporan yatim; lokasi ditolak → pilih area/peta secara manual; data validasi gagal → field error spesifik.

### 6.2 Alur kader — verifikasi

1. Kader login dan membuka `Verification Queue` yang hanya menampilkan laporan area tugas.
2. Filter `pending_verification`, `needs_information`, tanggal/kategori/area.
3. Lihat foto melalui URL bertanda tangan terbatas, keterangan, waktu, peta privat, serta **AI draft sebagai suggestion**.
4. Putuskan `verified` / `rejected` / `needs_information`, dengan alasan wajib pada keputusan non-verified.
5. Jika verified, kader dapat membuat `action_task` (assigned user, tindakan, due date, prioritas operasional).
6. Semua keputusan membuat record audit yang tak bisa ditimpa warga.

**Alternative paths:** laporan duplikat → kaitkan `duplicate_of_report_id` pada laporan dan beri alasan; area berbeda → forbidden; race condition dua kader → conflict 409, UI refresh.

### 6.3 Alur action task — penyelesaian terverifikasi

1. Kader membuat task pada laporan verified.
2. Kader atau manager menugaskan ke pengguna yang berwenang dalam area (MVP: kader sendiri; P1: verified assignee).
3. Assignee memperbarui status `in_progress`, menambah catatan/bukti setelah tindakan.
4. Submit evidence mengubah task menjadi `awaiting_review`.
5. Kader berbeda/yang berwenang memeriksa bukti dan memilih `approved` (→ completed) atau `revision_required` (→ in_progress).
6. Jika masalah berulang, buat `task_reopened` dan history; jangan menghapus record sebelumnya.
7. Status laporan dapat diturunkan dari tugas yang terkait **dengan aturan deterministik**.

### 6.4 Alur checklist PSN mingguan

1. Warga membuka **Pencegahan Minggu Ini**.
2. Tampil daftar item berdasarkan pedoman PSN terverifikasi (mis. memeriksa tempat penampungan air, menutup wadah air, mengelola barang bekas; teks harus direview sumber Kemenkes).
3. Warga menandai item selesai/tidak dilakukan/tidak relevan. **Jangan otomatis menyatakan rumah bebas jentik.**
4. Sistem menyimpan entri **satu user–satu minggu ISO berdasarkan zona Asia/Jakarta**; edit dicatat `updated_at`.
5. Pengelola hanya melihat persentase partisipasi pada agregat yang aman; jangan melakukan public shaming bagi rumah tangga.

### 6.5 Alur dashboard manajer

1. Pilih rentang tanggal dan area yang diizinkan.
2. Ambil agregasi dari SQL/database views yang aman: created, verified, pending, completed, median completion time, checklist participation.
3. Display timestamp **as of**, zona WIB, sumber data, dan label **demo** jika data simulasi.
4. Tombol **Generate Insights** mengirim **statistik agregat minim data** ke Gemini; tampilkan output sebagai ringkasan AI, bukan kesimpulan medis.
5. Jika AI gagal, angka KPI dan grafik tetap tersedia tanpa AI.

### 6.6 Diagram workflow

```mermaid
flowchart TD
  A[Warga membuat laporan] --> B{Analisis Gemini dipakai?}
  B -->|Ya| C[AI membuat draft terstruktur]
  B -->|Tidak| D[Isi manual]
  C --> E[Warga konfirmasi dan kirim]
  D --> E
  E --> F[Pending verification]
  F --> G{Review kader}
  G -->|Butuh info| H[Needs information]
  H --> F
  G -->|Tidak valid| I[Rejected]
  G -->|Valid| J[Verified]
  J --> K[Create and assign task]
  K --> L[In progress]
  L --> M[Upload evidence]
  M --> N{Review evidence}
  N -->|Revisi| L
  N -->|Disetujui| O[Completed]
  O --> P[Update analytics and history]
```

---

## 7. SPESIFIKASI FUNGSIONAL BERDASARKAN EPIC

Format ID: `FR-XX` untuk requirement; `AC-XX` untuk acceptance criteria. Field dan detail payload dijelaskan di bagian API & Validation.

### EPIC 1 — Identity and Area Access

- **FR-01** Registrasi email/password untuk warga; email verification jika diaktifkan project Supabase.
- **FR-02** Login, logout, safe session refresh, forgot password.
- **FR-03** Profile berisi nama panggilan dan area; hindari identitas sensitif yang tidak diperlukan.
- **FR-04** RBAC pada server dan Supabase RLS; warga tidak bisa menetapkan role.
- **FR-05** Kader dan manager hanya melihat data area yang ditugaskan; manager bisa mencakup beberapa area jika dimodelkan demikian.
- **FR-06** Unauthorized dikembalikan sebagai HTTP 401, forbidden 403; halaman menampilkan penjelasan aman.

**AC-01:** warga baru tidak bisa memanggil endpoint verify walau mengirim request manual.  
**AC-02:** kader RT A tidak bisa membaca foto/koordinat laporan RT B (termasuk direct object URL).  
**AC-03:** pemalsuan `role: manager` pada body registration tidak meningkatkan hak akses.

### EPIC 2 — Environmental Reports

- **FR-10** Form meliputi `category`, `description`, `photo`, `area_id`, dan lokasi yang mematuhi privasi.
- **FR-11** Foto opsional atau wajib? **Keputusan MVP: 1 foto wajib** untuk pengalaman Gemini dan verifikasi visual; fallback manual boleh bila AI gagal, bukan tanpa foto. Batas maksimal 3 foto.
- **FR-12** Foto melalui private bucket dan metadata terpisah; ukuran dan tipe divalidasi sebelum upload.
- **FR-13** Dukungan kategori: `water_container`, `discarded_tire`, `clogged_drain`, `discarded_item`, `other` (nama tampilan Bahasa Indonesia).
- **FR-14** Pengguna dapat preview dan edit AI suggestion sebelum submit.
- **FR-15** Riwayat laporan pribadi dengan tanggal, status, deskripsi, dan timeline.
- **FR-16** Duplikasi: kader dapat menandai duplicate dengan referensi laporan sebelumnya; report tetap dapat diaudit.
- **FR-17** Setelah submit, warga hanya boleh menambah keterangan pada jalur yang diizinkan, **bukan** mengganti status atau keputusan kader.

**AC-10:** laporan valid muncul di inbox kader area yang benar dan `pending_verification`.  
**AC-11:** file `.svg`, `.pdf`, `.exe`, file masquerade, atau image melewati ukuran ditolak.  
**AC-12:** input `description` HTML/script dirender sebagai text, bukan HTML aktif.  
**AC-13:** laporan tidak boleh terkirim dua kali akibat double click/retry.

### EPIC 3 — Gemini SmartSpot

- **FR-20** Memanggil Gemini hanya lewat server/API, tidak dari browser.
- **FR-21** Mengirim image bytes yang sudah divalidasi dan dinormalisasi; membatasi ukuran, tipe, dan token/biaya.
- **FR-22** Meminta output sesuai schema `AiReportSuggestion`; enum kategori dibatasi, no novel keys.
- **FR-23** Menampilkan label `Saran AI, perlu verifikasi` dan disclaimer yang jelas.
- **FR-24** Menyimpan hasil AI terpisah dari input final warga: `ai_analyses` menyimpan output ringkas, model, status, timestamp; hindari log foto mentah dan data sensitif.
- **FR-25** AI unavailable → manual flow tetap bekerja.
- **FR-26** Rate limit per user dan pembatasan concurrent request untuk pengendalian biaya.
- **FR-27** Prompt harus eksplisit melarang diagnosis, deteksi spesies/jentik pasti, probabilitas dengue, dan rekomendasi medis personal.

**AC-20:** respons Gemini salah bentuk → schema reject dan fallback, tidak error 500 yang membocorkan prompt.  
**AC-21:** output yang menyatakan `100% ada jentik Aedes` tidak boleh dipresentasikan sebagai fakta.  
**AC-22:** API key tidak muncul pada bundle client, network browser, log, atau repository.

### EPIC 4 — Verification Queue

- **FR-30** Inbox paginated per area dengan filter status/date/category.
- **FR-31** Kader berwenang dapat memilih verify, reject, request information, atau mark duplicate.
- **FR-32** Reject/request-info wajib alasan bermakna (mis. 10–500 karakter).
- **FR-33** Keputusan membuat event audit; `version` increment untuk optimistic concurrency.
- **FR-34** Warga mendapat in-app notification perubahan status.

**AC-30:** transisi status ilegal ditolak HTTP 409/422.  
**AC-31:** dua kader mengubah laporan sama berdasarkan versi lama → satu perubahan gagal 409.  
**AC-32:** user yang bukan kader berwenang tidak bisa melihat private report queue.

### EPIC 5 — ActionLoop / Task Management

- **FR-40** Membuat tugas hanya dari report verified.
- **FR-41** Setiap task: title, description, due_at, assigned_to (authorized), status, created_by, report_id.
- **FR-42** Workflow draft/assigned/in_progress/awaiting_review/completed/reopened/cancelled dengan aturan tegas.
- **FR-43** Evidence foto/note diunggah sebagai private file; submit evidence tidak otomatis menutup tugas.
- **FR-44** Reviewer menolak evidence dengan reason; tugas kembali in_progress.
- **FR-45** Semua transisi dicatat sebagai task events append-only.
- **FR-46** Report dapat dianggap resolved hanya jika seluruh task wajib yang aktif selesai diverifikasi.

**AC-40:** user tidak bisa menutup tugas sendiri lewat PATCH arbitrer.  
**AC-41:** `completed_at` hanya diset saat approve evidence.  
**AC-42:** evidence terhapus/invalid → task tidak dianggap selesai.

### EPIC 6 — MySafeHome / PSN Checklist

- **FR-50** Checklist per minggu kalender Asia/Jakarta untuk user yang login.
- **FR-51** Opsi `done`, `not_done`, `not_applicable`, beserta catatan opsional.
- **FR-52** Idempotent upsert untuk satu pengguna + minggu + checklist item.
- **FR-53** Kegiatan pribadi bukan hasil pemeriksaan resmi. Jangan hitung sebagai ABJ.
- **FR-54** Data individual tidak tampil pada dashboard publik; analytics minimal area yang teragregasi.

**AC-50:** satu pengguna tidak bisa membuat dua record identik pada minggu sama.  
**AC-51:** warga tidak bisa mengubah checklist warga lain.  
**AC-52:** perhitungan partisipasi menggunakan definisi denominator yang tertulis (mis. jumlah rumah tangga terdaftar pada area demo), bukan angka sembarang.

### EPIC 7 — Map & Visualization

- **FR-60** Kader melihat laporan wilayah tugas di peta dan daftar alternatif.
- **FR-61** Data koordinat detail hanya didapat dari authenticated server dengan area scope.
- **FR-62** Peta publik memakai agregat/area centroid yang digeneralisasi; jangan mengirim exact coordinate rumah lalu menyembunyikannya di UI saja.
- **FR-63** Marker menandakan **laporan dan status**, bukan tingkat risiko klinis.
- **FR-64** Legend dan accessible table/list alternative, filter kategori/status/date.
- **FR-65** Tile provider legal/berizin dengan attribution yang benar dan limit kuota.

**AC-60:** tamu tidak dapat memperoleh raw GeoJSON titik privat melalui network calls.  
**AC-61:** data kosong menampilkan empty-state bukan peta palsu penuh pin.  
**AC-62:** peta gagal memuat tetap menyediakan daftar laporan yang bisa digunakan.

### EPIC 8 — Analytics & Gemini Insights

- **FR-70** KPI: number of reports, pending count, verified count, completed count, completion rate, median time-to-verify, median time-to-complete, weekly PSN participation.
- **FR-71** Semua metrik dihasilkan secara deterministik oleh query/database service, **bukan dihitung oleh Gemini**.
- **FR-72** Filter tanggal dan area di-validate dan di-scope server-side; date range dibatasi.
- **FR-73** Grafik memiliki label, satuan, timeframe, dan deskripsi; no rainbow colors.
- **FR-74** AI insights hanya menerima agregat tanpa PII dan ditandai AI-generated summary; hindari klaim kausal medis.
- **FR-75** Warga hanya melihat angka publik yang aman, jika disediakan.

**AC-70:** penyelesaian laporan mengubah KPI setelah fetch/revalidate.  
**AC-71:** grafik tidak menampilkan nilai dari contoh hard-coded setelah data nyata tersedia.  
**AC-72:** angka dan narasi tidak saling bertentangan; ringkasan salah → fallback deterministic text.

### EPIC 9 — Notification & Education

- **FR-80** Notifikasi in-app untuk request info, verified, rejected, task assignment, evidence reviewed, completed.
- **FR-81** Notifikasi hanya terlihat penerima dan tidak membocorkan identitas pelapor pihak ketiga.
- **FR-82** Konten edukasi PSN 3M Plus dan pengantar dengue berbasis referensi Kemenkes/WHO dengan tanggal review konten.
- **FR-83** Laman edukasi menampilkan sumber dan peringatan medis yang tepat: jika ada gejala berat/demam mencurigakan, hubungi tenaga kesehatan, bukan ikuti diagnosis AI.

### EPIC 10 — Admin Operations & Demo

- **FR-90** Seed demo deterministic untuk area fiktif, 3 peran, foto berlisensi/berizin, 20–30 laporan simulasi, dan beberapa task.
- **FR-91** Label visual `DATA SIMULASI` di setiap dashboard yang memakai seed.
- **FR-92** Pengisian database dan akun demo via script developer/CI yang aman; jangan expose admin key.
- **FR-93** Safe error logging dan observability dasar tanpa plaintext secrets/PII.
- **FR-94** README mencakup setup, env, migrations, seed, tests, demo flow, keterbatasan.

---

## 8. STATE MACHINES, TRANSITIONS, DAN AUDIT

### 8.1 Report statuses

| Dari | Ke | Aktor | Kondisi |
|---|---|---|---|
| `pending_verification` | `verified` | cadre | area valid, alasan optional, expected_version sama |
| `pending_verification` | `needs_information` | cadre | reason wajib |
| `pending_verification` | `rejected` | cadre | reason wajib |
| `pending_verification` | `duplicate` | cadre | `duplicate_of_report_id` valid dalam scope |
| `needs_information` | `pending_verification` | owner resident | submit informasi tambahan |
| `verified` | `in_action` | system/service | minimal satu task aktif dibuat |
| `in_action` | `resolved` | system/service | seluruh mandatory tasks completed oleh reviewer |
| `resolved` | `in_action` | cadre | recurrence/reopen reason tercatat |

*Catatan:* label UI Bahasa Indonesia; string database memakai snake_case di atas. Kata `cadre` pada tabel berarti aktor `cadre`, bukan penjadwalan otomatis.

### 8.2 Task statuses

`assigned` → `in_progress` → `awaiting_review` → (`completed` atau `in_progress` untuk revisi) → `reopened` jika masalah muncul kembali. `cancelled` hanya untuk tugas sah yang dibatalkan dengan alasan; tidak boleh dianggap `completed`.

### 8.3 Audit guarantees

- Append-only `report_events` dan `task_events`; event tidak boleh bisa diubah/deleted oleh warga/kader melalui client.
- Tiap event menyimpan `actor_id`, `action`, `old_status`, `new_status`, `created_at`, `reason`, `metadata` terbatas.
- Validasi transisi dilakukan dalam service/transaction atau database RPC untuk menjamin atomicity.
- Update status memakai optimistic concurrency `version` (`WHERE id=? AND version=?`). Jika 0 rows affected → HTTP 409.
- Hindari backend yang menyimpan `status=completed` sebelum evidence selesai diverifikasi.

---

## 9. SYSTEM ARCHITECTURE

### 9.1 Architecture Decision Record (ADR-001)

**Pilihan:** modular monolith dengan **Next.js App Router + TypeScript** sebagai presentation dan application layer, **Supabase PostgreSQL/Auth/Storage** sebagai data layer, **Gemini API** via server sebagai AI adapter, **MapLibre GL JS** untuk map rendering, **Recharts** untuk grafik.

**Alasan:** lebih sederhana diimplementasikan, mudah diuji, mendukung server authorization, memudahkan vertical slice, serta sesuai pengalaman tim (Next.js/Gemini). Backend tidak memerlukan layanan Express/Nest terpisah pada tahap kompetisi.

**Yang tidak dipilih:** microservices; client-side Gemini invocation; Firebase + Supabase bersamaan; third-party CMS/full template; menyimpan foto sebagai base64 di DB; public bucket untuk foto laporan.

### 9.2 Diagram komponen

```mermaid
flowchart TB
    actor[Citizen / Cadre / Manager]
    subgraph client[Presentation Layer - Browser]
      web[Next.js Responsive UI / Optional PWA]
      map[MapLibre Client + licensed tiles]
      forms[Forms / React Hook Form + Zod]
    end
    subgraph server[Application Layer - Next.js Server]
      api[Route Handlers / Server Actions]
      auth[Session + RBAC + area scope]
      services[Domain services / state transitions]
      schemas[Validation schemas]
      repos[Repository / data access]
      aiAdapter[AI Adapter + JSON parse/validate]
    end
    subgraph data[Data Layer - Supabase]
      pg[(PostgreSQL with RLS)]
      storage[(Private Image Storage)]
      supaAuth[Auth]
    end
    gemini[Gemini API via @google/genai]
    actor --> web
    web --> forms
    web --> map
    web --> api
    api --> auth
    api --> schemas
    auth --> supaAuth
    api --> services
    services --> repos
    repos --> pg
    repos --> storage
    services --> aiAdapter
    aiAdapter --> gemini
```

**Rule:** AI dan server credential tidak pernah masuk ke browser bundle. Map library boleh client-side, tetapi *raw private report coordinates* tidak boleh dikirim ke guest.

### 9.3 Layer responsibility / separation of concerns

| Layer | Boleh melakukan | Tidak boleh melakukan |
|---|---|---|
| `components` | render, local interaction, accessible feedback | database query langsung sembarang, RBAC keputusan final, Gemini key |
| `features/*/hooks` | client fetching/cache, optimistic UI setelah server contract jelas | mengubah status tanpa API |
| `schemas` | Zod input/output schemas; normalisasi bentuk | side effect / database writes |
| `app/api/*` | auth context, parse request, validate, invoke service, format HTTP | query kompleks/business logic berulang |
| `services` | use case, state machine, domain invariant, orchestrate transaction | import React atau depend pada styling |
| `repositories` | scoped SQL queries, storage operations, CRUD rendah-level | business decisions kompleks |
| `integrations/gemini` | prompt, model call, JSON validation, timeout and retry | mark task completed, direct DB admin |
| `supabase/migrations` | DDL, constraints, grants, RLS, SQL functions | UI logic |

### 9.4 Trust boundaries

1. **Browser → API:** zero trust; seluruh input wajib diverifikasi, tidak memercayai role, user_id, area_id, due time, maupun coordinates dari client sebagai otoritatif.
2. **API → DB:** gunakan user-scoped Supabase client/RLS; jangan membypass RLS dengan service key untuk operasi rutin.
3. **AI → API:** hasil Gemini adalah untrusted data; strict schema, length limits, sanitization, moderation and human confirmation.
4. **Storage → Client:** foto via short-lived signed URL sesuai authorization, bukan URL publik permanen.
5. **Guest/Public → Map:** hanya data yang telah dianonimkan/diagregasikan; hindari reverse geocoding titik rumah.

### 9.5 Availability and offline constraints

- MVP online-first. Semua form menunjukkan status saving/error/retry.
- Simpan draft form secara lokal **hanya jika** tidak mengandung foto/detail sensitif tanpa perlindungan yang sesuai; default jangan persist foto di localStorage.
- Tidak mengklaim aplikasi mendukung offline penuh tanpa implementasi service worker, outbox, conflict resolution, dan tes sinkronisasi.
- PWA installable boleh fase P2; jangan menambahkan service worker yang secara tidak sengaja meng-cache API privat atau signed URLs.

### 9.6 Environment configuration

```dotenv
# server only
GEMINI_API_KEY=replace_me
GEMINI_MODEL=select_supported_model_at_setup
SUPABASE_SECRET_KEY=server_only_if_truly_needed

# safe-to-expose client config (still guard with RLS)
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace_me
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_MAP_STYLE_URL=https://your-licensed-provider/style.json

# operational config
APP_BASE_URL=http://localhost:3000
AI_REQUEST_TIMEOUT_MS=15000
MAX_IMAGE_BYTES=5242880
```

- Tidak boleh commit `.env*` berisi secret. Commit `.env.example` placeholder saja.
- Jangan membuka `SUPABASE_SECRET_KEY` / legacy `service_role` pada client; gunakan bila memang perlu pada skrip migrasi/seed admin yang terpercaya saja.
- Konvensi `NEXT_PUBLIC_*` berarti dapat terekspos publik; jangan pernah menaruh kredensial sensitif di sana.
- Gunakan `process.env.GEMINI_MODEL`; jangan hard-code ID model yang mungkin usang.

---

## 10. DATABASE DESIGN / ENTITY MODEL

### 10.1 Prinsip umum DB

- PostgreSQL, kolom `id uuid` dan FK eksplisit; `created_at`/`updated_at timestamptz`, simpan UTC, render WIB.
- Gunakan migrations version-controlled; tidak mengandalkan perubahan manual di Dashboard yang tidak tercatat.
- `NOT NULL`, `CHECK`, `UNIQUE`, FK, dan index sesuai query.
- Semua tabel yang terekspos memiliki RLS dan grants minimum.
- Semua field status yang sensitif hanya berubah lewat domain service / RPC yang diaudit.
- Hindari menyimpan redundansi seperti `report_count` per user tanpa alasan; hitung agregasi/query atau materialized view bila diperlukan.
- Gunakan snake_case untuk tabel dan kolom; singular/plural konsisten (dokumen ini memakai plural tables).

### 10.2 Logical ERD

```mermaid
erDiagram
  AREAS ||--o{ AREA_MEMBERSHIPS : includes
  PROFILES ||--o{ AREA_MEMBERSHIPS : belongs
  PROFILES ||--o{ REPORTS : creates
  AREAS ||--o{ REPORTS : scopes
  REPORTS ||--o{ REPORT_IMAGES : has
  REPORTS ||--o{ AI_ANALYSES : suggests
  REPORTS ||--o{ REPORT_EVENTS : records
  REPORTS ||--o{ ACTION_TASKS : generates
  ACTION_TASKS ||--o{ TASK_EVENTS : logs
  ACTION_TASKS ||--o{ TASK_EVIDENCE : includes
  PROFILES ||--o{ PSN_CHECKLISTS : records
  AREAS ||--o{ PSN_CHECKLISTS : groups
  PROFILES ||--o{ NOTIFICATIONS : receives
```

### 10.3 Schema detail

**`profiles`**
- `id uuid PK REFERENCES auth.users(id)`
- `display_name varchar(100) NOT NULL`
- `role enum('resident','cadre','manager') NOT NULL DEFAULT 'resident'`
- `created_at, updated_at timestamptz`
- Role immutable dari client; perubahan role audited and managed server-side.

**`areas`**
- `id uuid PK`, `code varchar(32) UNIQUE NOT NULL`, `name varchar(120) NOT NULL`
- `parent_id uuid NULL REFERENCES areas(id)` jika diperlukan kelurahan/RT hierarki
- `public_centroid geometry/lat-lng generalized NULL` boleh digunakan untuk peta publik; jangan memakai precise house point.
- `is_demo boolean NOT NULL DEFAULT false`

**`area_memberships`**
- `id uuid PK`, `profile_id uuid FK`, `area_id uuid FK`
- `membership_type enum('resident','assigned_cadre','manager')`
- `verified_at timestamptz NULL`, `created_at`
- `UNIQUE(profile_id,area_id,membership_type)`; hak akses harus membaca keanggotaan verified/assigned, bukan field area yang dikirim browser.

**`reports`**
- `id uuid PK`, `public_reference varchar(20) UNIQUE` seperti `DW-2026-000123` yang dihasilkan server (jangan jadikan sequence predictable sebagai authorization)
- `reporter_id uuid FK profiles`, `area_id uuid FK areas`
- `category report_category NOT NULL`, `description varchar(1000) NOT NULL`
- `status report_status NOT NULL DEFAULT 'pending_verification'`
- `latitude numeric(9,6) NULL`, `longitude numeric(9,6) NULL` **private only**
- `location_note varchar(250) NULL`, `is_demo boolean NOT NULL DEFAULT false`
- `duplicate_of_report_id uuid NULL REFERENCES reports(id)`, `version int NOT NULL DEFAULT 1`
- `submitted_at timestamptz NOT NULL`, `resolved_at timestamptz NULL`, `created_at`, `updated_at`
- Lat `CHECK(-90<=lat AND lat<=90)`; lng `CHECK(-180<=lng AND lng<=180)`, nullable pair rule; `version > 0`.

**`report_images`**
- `id uuid PK`, `report_id uuid FK`, `storage_path text UNIQUE NOT NULL`, `mime_type`, `byte_size integer CHECK(0<byte_size AND byte_size<=5242880)`
- `width`, `height` positive ints if known; `created_by`, `created_at`.
- Private bucket; no arbitrary external URL for report photos.

**`ai_analyses`**
- `id uuid PK`, `report_id uuid NULL FK` (analysis preview sebelum submit bisa bersifat transient)
- `request_user_id uuid FK`, `model_id text`, `input_hash text` (tanpa konten gambar), `result_json jsonb` yang sebelumnya divalidasi
- `status enum('success','rejected','timeout','error')`, `created_at`, `duration_ms`, `error_code NULL`.
- Hindari menyimpan prompt yang berisi identitas/koordinat; retensi metadata terbatas.

**`report_events`**
- `id uuid PK`, `report_id uuid FK`, `actor_id uuid FK NULL`, `event_type enum`, `old_status`, `new_status`, `reason varchar(500) NULL`, `created_at`, `metadata jsonb DEFAULT '{}'`
- Append-only, timestamps dari server.

**`action_tasks`**
- `id uuid PK`, `report_id uuid FK`, `title varchar(140)`, `description varchar(1000)`
- `assigned_to uuid FK profiles`, `created_by uuid FK profiles`
- `status task_status`, `due_at timestamptz NULL`, `completed_at timestamptz NULL`, `version int DEFAULT 1`
- `is_mandatory boolean DEFAULT true`, `created_at`, `updated_at`.
- `CHECK (due_at IS NULL OR due_at >= created_at)` bila sesuai business rule; jangan menolak task yang sudah overdue akibat edit timeline yang sah tanpa aturan khusus.

**`task_events`**
- `id uuid PK`, `task_id uuid FK`, `actor_id uuid FK`, `event_type`, `old_status`, `new_status`, `reason`, `created_at`
- No client update/delete.

**`task_evidence`**
- `id uuid PK`, `task_id uuid FK`, `submitted_by uuid FK`, `storage_path private`, `description varchar(500)`
- `reviewed_by uuid FK NULL`, `review_status enum('pending','approved','revision_required')`, `review_reason`, `created_at`, `reviewed_at`.

**`psn_checklists`**
- `id uuid PK`, `user_id uuid FK`, `area_id uuid FK`, `iso_year smallint`, `iso_week smallint CHECK(1<=week<=53)`
- `item_code varchar(40)`, `answer enum('done','not_done','not_applicable')`, `note varchar(300) NULL`, `created_at`, `updated_at`
- `UNIQUE(user_id, iso_year, iso_week, item_code)`.
- Tidak menyimpan data pasien/diagnosis.

**`notifications`**
- `id uuid PK`, `recipient_id uuid FK`, `title`, `body`, `type`, `link_path` (internal route only), `read_at timestamptz NULL`, `created_at`.

### 10.4 Indexes yang disarankan

```sql
CREATE INDEX idx_reports_area_status_created
  ON reports (area_id, status, created_at DESC);
CREATE INDEX idx_reports_reporter_created
  ON reports (reporter_id, created_at DESC);
CREATE INDEX idx_action_tasks_assigned_status
  ON action_tasks (assigned_to, status);
CREATE INDEX idx_events_report_created
  ON report_events (report_id, created_at DESC);
CREATE INDEX idx_memberships_profile_area
  ON area_memberships (profile_id, area_id);
CREATE UNIQUE INDEX uq_psn_week_item
  ON psn_checklists(user_id, iso_year, iso_week, item_code);
```

**Catatan:** nama kolom harus disesuaikan migration final. Jangan menjalankan snippet parsial ini sebelum tabel dan enum tersedia.

### 10.5 RLS design (mandatory, test deny cases)

- `profiles`: own profile read/update hanya field aman; user tidak boleh update role.
- `area_memberships`: user dapat melihat membership sendiri; hanya admin terpercaya yang create/change membership berwenang.
- `reports`: warga SELECT own, INSERT hanya dengan `reporter_id=auth.uid()` dan area membership active; kader/manager SELECT dalam assigned area; `UPDATE` status tidak diekspos sebagai general-purpose update.
- `report_images`/Storage: private bucket; user mengakses own atau official in-scope, server membuat signed URL hanya setelah authorization.
- `action_tasks`: kader/manager in-scope bisa read/write melalui use-case; assignee hanya operasi progres yang diizinkan.
- `report_events`/`task_events`: read authorized, append hanya melalui server function/use-case, **no public delete/update**.
- `psn_checklists`: user hanya own; manager membaca **aggregate view** yang menyembunyikan individu.
- `notifications`: recipient-only.

**Contoh pola sederhana, bukan kebijakan lengkap:**

```sql
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Warga hanya boleh membaca laporan miliknya.
CREATE POLICY reports_select_own
ON reports FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = reporter_id);

-- Kader-area scoped SELECT memerlukan helper function
-- yang aman, non-recursive, dan diuji; jangan memakai USING (true).
```

Untuk akses role lintas area, implementasikan helper DB function yang **tidak menyebabkan recursive RLS**, atau gunakan server query terotorisasi + RLS dengan grants yang tepat. Cek `security definer` search_path, schema, dan prinsip least privilege jika memakai function. Menambahkan policy tidak otomatis menghapus broad grants. Dokumentasi Supabase: https://supabase.com/docs/guides/database/postgres/row-level-security

### 10.6 Data retention and deletion

- Prototipe: data seed bisa di-reset; untuk data sungguhan wajib ada privacy policy dan kebijakan retensi yang diumumkan.
- Usulan awal (perlu keputusan tim/hukum): original report photos disimpan maksimal 90 hari setelah resolved kecuali untuk audit yang sah; riwayat status dianonimkan bila laporan dihapus sesuai permintaan yang valid.
- Jangan menyatakan patuh penuh UU PDP hanya karena terdapat checkbox consent; lakukan peninjauan hukum jika menggunakan orang/data nyata.
- Database backups/logging tidak boleh mengekspos foto dan identitas.

---

## 11. HTTP API CONTRACT — NEXT.JS ROUTE HANDLERS

### 11.1 Konvensi API

- Prefix `app/api/v1/`; semua private endpoints require authenticated user, authorization, area scope, rate limits, Zod validation.
- REST-ish routes; body JSON untuk metadata; image upload via controlled upload workflow / signed upload path dengan policy.
- Semua respons mengembalikan UTC timestamp ISO 8601; frontend tampilkan WIB.
- Server generate ID, user_id, status, version, timestamp; jangan menerima fields ini untuk di-overwrite client.
- Paginasi cursor atau page+limit maksimum 50; batasi date range, hindari `GET all` tanpa limit.
- Error format standar (tanpa stacktrace/secret):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Periksa kembali data yang diisi.",
    "fieldErrors": {
      "description": "Deskripsi harus berisi 10–1000 karakter."
    },
    "requestId": "trace-safe-id"
  }
}
```

- `400` malformed input, `401` unauthenticated, `403` forbidden, `404` missing or hidden resource, `409` version/state conflict, `413` oversized file, `415` unsupported media type, `422` business validation, `429` rate limit, `502/503` dependency unavailable.
- `Idempotency-Key` pada create report/task request untuk retry; scoped per user and operation.

### 11.2 Endpoint inventory

| Method + path | Actor | Request | Response | Security |
|---|---|---|---|---|
| `POST /api/v1/ai/analyze-report` | Resident | private validated photo upload reference | AI suggestion | user rate limit, photo owner, schema |
| `POST /api/v1/reports` | Resident | category, description, area, location, upload refs, idem key | report ID + status | area membership, RLS |
| `GET /api/v1/reports` | Resident/Cadre/Manager | filters, cursor | scoped paginated list | scope by server |
| `GET /api/v1/reports/:id` | owner/in-scope cadre | id | detail + event history + signed images | object-level auth |
| `POST /api/v1/reports/:id/add-information` | owner | note; expectedVersion | status updated | only needs_information |
| `POST /api/v1/reports/:id/review` | cadre | decision, reason, expectedVersion | updated report/event | transition, area |
| `POST /api/v1/reports/:id/tasks` | cadre | title, desc, assignee, dueAt | task | verified report, scope |
| `GET /api/v1/tasks` | cadre/manager/assignee | filters | scoped tasks | role+scope |
| `POST /api/v1/tasks/:id/start` | assignee | expectedVersion | updated task | task ownership |
| `POST /api/v1/tasks/:id/evidence` | assignee | note, image refs, expectedVersion | awaiting_review | private storage |
| `POST /api/v1/tasks/:id/review` | reviewer | decision, reason, expectedVersion | completed/in_progress | scoped reviewer |
| `GET /api/v1/psn/checklist` | Resident | ISO week | own entries | owner |
| `PUT /api/v1/psn/checklist` | Resident | week+items | saved entries | owner + unique constraint |
| `GET /api/v1/map/reports` | Cadre/Manager | bounds/filters | scoped GeoJSON | private exact points |
| `GET /api/v1/map/aggregate` | authorized/public limited | filters | generalized counts | privacy threshold |
| `GET /api/v1/analytics` | manager | date range/area | aggregate KPI/chart series | manager scope |
| `POST /api/v1/ai/insights` | manager | filters (no raw PII) | AI narrative | rate limit + no PII |
| `GET /api/v1/notifications` | authenticated | cursor | own notifications | recipient |
| `PATCH /api/v1/notifications/:id` | recipient | mark_read | updated | recipient |

**HTTP method semantics:** operational transitions intentionally use POST actions to avoid arbitrary status PATCH. Optionally align with team conventions, but keep invariants.

### 11.3 Example create report

```json
{
  "category": "discarded_tire",
  "description": "Ada ban bekas menampung air di area fasilitas umum.",
  "areaId": "valid-area-uuid",
  "location": {
    "latitude": -6.976321,
    "longitude": 110.409874,
    "note": "Di dekat saluran air umum"
  },
  "imageUploadIds": ["valid-owned-upload-uuid"]
}
```

**Security note:** contoh lokasi hanya nilai dummy sintaks dan **bukan** rujukan untuk memetakan pengguna/rumah. Client tidak boleh mengirim `reporterId`, `status`, atau `isDemo` yang dipercaya server.

### 11.4 Example report review

```json
{
  "decision": "verify",
  "reason": "Kondisi terlihat perlu pemeriksaan dan pembersihan.",
  "expectedVersion": 3
}
```

**Server logic:** resolve `userId` dari trusted session; cek role + area; cek `expectedVersion` & state; update atomik; insert event; create notification; return sanitized DTO.

### 11.5 Example AI suggestion contract

```json
{
  "visibleObjects": ["ban bekas", "air terlihat menggenang"],
  "suggestedCategory": "discarded_tire",
  "draftDescription": "Foto menunjukkan ban bekas yang tampak berisi air.",
  "suggestedPrecaution": "Perlu pemeriksaan dan penghilangan genangan oleh pihak yang berwenang.",
  "requiresHumanVerification": true,
  "limitations": "Foto saja tidak dapat memastikan adanya jentik atau spesies nyamuk."
}
```

Use no `infectionRiskPercent`, `dengueProbability`, `medicalDiagnosis`, or automated `safeToIgnore` fields.

### 11.6 API service pseudocode

```ts
async function verifyReport(input: VerifyReportInput, actor: AuthContext) {
  const data = verifyReportSchema.parse(input); // syntax + type check
  assertRole(actor, ['cadre', 'manager']);
  const report = await reportRepo.findScoped(data.reportId, actor);
  assertAllowedTransition(report.status, data.decision);
  assertVersion(report.version, data.expectedVersion);

  return db.transaction(async (tx) => {
    const next = await reportRepo.updateStateCAS(tx, report.id, data);
    if (!next) throw new DomainConflictError('STALE_VERSION');
    await eventRepo.append(tx, buildReviewEvent(report, data, actor));
    await notificationRepo.enqueue(tx, buildNotification(report, data));
    return toSafeReportDto(next);
  });
}
```

Actual transaction strategy must match Supabase access pattern (possibly PostgreSQL RPC for atomic operations). **Do not pretend multiple independent REST calls form a DB transaction.**

---

## 12. VALIDATION SPEC — WAJIB MULTI-LAYER (KRITIKAL)

### 12.1 Prinsip dasar

> **Tidak cukup hanya menambahkan `required` pada HTML.** Setiap input harus melalui:  
> **Browser interaction constraints → Shared schema (Zod) → Server request validation → Business validation → Database constraints/RLS → Output encoding/safe rendering.**

Client-side validation meningkatkan UX, tetapi **bukan security boundary**. Semua request dapat dipalsukan melalui DevTools, curl, Postman, Burp, atau script. Setiap layer harus mampu menolak data invalid tanpa mengandalkan layer sebelumnya.

### 12.2 Keputusan khusus: field angka tidak boleh menerima huruf

Untuk field yang **hanya mengizinkan bilangan bulat non-negatif**, misalnya jumlah wadah, minggu, tahun, page/limit, atau jumlah item:

1. Gunakan input **controlled string** dengan `type="text"`, `inputMode="numeric"`, `pattern="[0-9]*"`, `autoComplete="off"`, label serta helper text. Alasan: HTML `type="number"` pada beberapa browser dapat mengizinkan `e`, `E`, `+`, `-` (notasi ilmiah), yang tidak sesuai kebutuhan form integer.
2. Pada input handler, **hanya terima karakter ASCII `0–9`**; tolak input huruf/simbol ketika mengetik, paste, drag/drop, autofill, maupun perubahan programmatic via validation. Jangan memakai regex yang hanya memblokir huruf tetapi meloloskan simbol.
3. Tetap izinkan **empty string saat pengguna menghapus input**; validasi required baru saat submit/blur. Jangan memaksa angka `0` ketika field masih kosong.
4. Terapkan batas digit/angka dengan feedback; bukan hanya maxlength pada UI.
5. Saat submit, ubah ke integer yang valid melalui parsing eksplisit dan `Number.isSafeInteger`, **bukan** `parseInt('12abc')` yang menghasilkan 12.
6. Di server, JSON value harus bertipe `number` integer (Zod `z.number().int()`), bukan menerima string numeric secara diam-diam kecuali endpoint secara sadar mendefinisikan format string. Reject `NaN`, `Infinity`, `1.5`, `-1`, `"12e3"`, `"12abc"`, `null`, boolean, arrays/objects.
7. DB memberi `CHECK`, integer data type, serta batas nilai dan `NOT NULL` sesuai field.
8. Untuk lat/lng, jangan gunakan same digits-only rule: ini bilangan desimal bertanda dari geolocation/map picker. Validasi domain berbeda, lebih baik user memilih dari peta daripada mengetik koordinat mentah.
9. No data-loss: UI memberi error eksplisit jika paste berisi karakter tidak valid, bukan mengubah `12abc` diam-diam menjadi `12` lalu menyimpannya tanpa konfirmasi.
10. E2E test wajib menguji keyboard, paste, mobile input, IME, dan forged network requests.

**Contoh helper frontend (konsep; sesuaikan compositional events):**

```ts
const DIGITS_ONLY = /^[0-9]*$/;

export function acceptDigitsOnly(nextValue: string, maxDigits = 5): string | null {
  if (nextValue.length > maxDigits) return null;
  if (!DIGITS_ONLY.test(nextValue)) return null;
  return nextValue; // null -> reject, '' allowed during editing
}

export function parseRequiredInteger(raw: string, min: number, max: number) {
  if (!/^[0-9]+$/.test(raw)) throw new Error('Only ASCII digits allowed');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error('Integer outside allowed range');
  }
  return value;
}
```

```tsx
<label htmlFor="containerCount">Jumlah wadah</label>
<input
  id="containerCount"
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  autoComplete="off"
  value={containerCount}
  onChange={(e) => {
    const accepted = acceptDigitsOnly(e.target.value, 3);
    if (accepted !== null) setContainerCount(accepted);
    else setError('Hanya angka 0–9 yang diperbolehkan.');
  }}
  aria-invalid={Boolean(error)}
  aria-describedby="container-count-error"
/>
<p id="container-count-error" role={error ? 'alert' : undefined}>{error}</p>
```

**Important:** contoh kode harus disesuaikan dengan composition/paste events, focus management, React Hook Form Controller, aksesibilitas, dan server schema. Jangan menambahkan handler `onKeyDown` yang memblokir Tab, Backspace, panah, Ctrl/Cmd+A, dan keyboard shortcuts. Biarkan native navigation berjalan; validasi nilai final pada change & submit.

### 12.3 Field validation matrix

| Field | Frontend constraint | Server shared Zod | DB/business constraint |
|---|---|---|---|
| `displayName` | 2–100 karakter, label | `z.string().trim().min(2).max(100)` | NOT NULL; escape display |
| `email` | type email + blur error | canonical email validation, max 254 | Supabase Auth handles uniqueness |
| `password` | password control; feedback | policy Auth; check no arbitrary trim | Supabase Auth, never log |
| `role` | tidak bisa dipilih saat register | ignored/rejected if sent | protected role field/admin policy |
| `areaId` | select dari scoped list | UUID | FK + verified membership |
| `category` | controlled select | strict enum | PostgreSQL enum/check |
| `description` | required, 10–1000 chars, count | trim, min/max, reject unsafe control chars | NOT NULL + varchar bound |
| `locationNote` | optional, max 250 | string trim/max | varchar(250) |
| `latitude` | map picker/geolocation | finite number in [-90,90] | numeric CHECK |
| `longitude` | map picker/geolocation | finite number in [-180,180] | numeric CHECK |
| `image` | JPEG/PNG/WebP, max 5 MiB each, max 3 | magic bytes, decoded image, size, dimensions | private storage, metadata bounds |
| `reason` (review) | 10–500 when required | conditional schema | service transition prerequisite |
| `taskTitle` | 5–140 chars | Zod min/max | varchar NOT NULL |
| `taskDescription` | 10–1000 chars | Zod min/max | varchar bound |
| `dueAt` | datetime picker | valid ISO date, timezone explicit | valid timestamp/business rule |
| `assignedTo` | allowed scoped users | UUID | FK + area/role rule |
| `expectedVersion` | hidden numeric state | positive safe integer | atomic version check |
| `page`, `limit` | numbers UI/select | integer, page ≥1, limit 1–50 | server cap regardless query |
| `isoWeek` | derived from date | integer 1–53, valid ISO-year/week pair | CHECK + unique |
| `isoYear` | derived from date | integer 2020–2100 (product bound) | smallint/check |
| `checklistAnswer` | radio choice | enum | DB enum + unique |
| `dateFrom/dateTo` | picker, inline errors | ISO format, from ≤ to, bounded span | scoped query, index |
| `status` | display only for resident | transition-based server-only | enum + protected update path |
| `storagePath` | never arbitrary path input | owned upload reference UUID only | private bucket RLS |

**Location pair invariant:** keduanya wajib ada atau keduanya null. Field lokasi tidak boleh menyimpan titik `[0,0]` sebagai default palsu. User dapat menyetujui lokasi sebelum submit.

### 12.4 Example Zod schema (concept)

```ts
import { z } from 'zod';

export const reportCategory = z.enum([
  'water_container',
  'discarded_tire',
  'clogged_drain',
  'discarded_item',
  'other',
]);

export const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  note: z.string().trim().max(250).optional(),
}).strict();

export const createReportSchema = z.object({
  category: reportCategory,
  description: z.string().trim().min(10).max(1000),
  areaId: z.string().uuid(),
  location: locationSchema.nullable(),
  imageUploadIds: z.array(z.string().uuid()).min(1).max(3),
}).strict();

export const integerCountSchema = z.number()
  .int().min(0).max(999)
  .refine(Number.isSafeInteger, 'Harus bilangan bulat aman');
```

**`strict()`** menolak field yang tidak dikenal (mis. `role` atau `status` yang disisipkan). Jalur parsing form yang memakai `FormData` harus mengkonversi tipe secara eksplisit dan divalidasi ulang; jangan langsung percaya string `quantity='12e3'`.

### 12.5 Validation anti-patterns yang dilarang

- `parseInt(value) || 0` untuk required numeric input.
- `Number(value)` tanpa check `isFinite`/`isSafeInteger`.
- HTML `type=number` sebagai satu-satunya pengamanan.
- Mengandalkan disable button tanpa API validation.
- Menerima arbitrary `userId`, `role`, `status`, `areaId`, `storagePath` dari client tanpa scoped verification.
- `dangerouslySetInnerHTML` untuk output pengguna/AI.
- Hanya menolak file berdasarkan ekstensi atau `Content-Type` header.
- Validasi nilai di frontend saja, atau SQL constraint saja, tanpa error handling.
- Menghapus karakter invalid lalu menyimpan diam-diam tanpa pengguna mengetahui.

---

## 13. DESIGN SYSTEM / ANTI-SLOP UI CONTRACT (WAJIB)

> **Visual direction:** *functional minimalism*, *data-first information architecture*, *restrained motion*, *community-oriented HealthTech*.  
> **Bukan:** medical emergency app yang dominan merah; SaaS template generik; futuristik neon dashboard; warna random per fitur.

### 13.1 Design principles dan evidence base

1. **Nielsen Norman Group: visibility of system status.** Selalu tampilkan saving, sent, pending verification, verified, retry, failed, dan error yang spesifik.
2. **Match between system and real world.** Gunakan istilah warga: *Buat Laporan*, *Menunggu Pemeriksaan*, *Perlu Keterangan*, *Sedang Ditangani*, *Selesai*. Jangan memperlihatkan internal enum.
3. **Error prevention.** Konfirmasi tindakan irreversible; preview sebelum laporan terkirim; validasi inline; tidak menghapus data pengguna saat error.
4. **Recognition over recall.** Status, legenda peta, dan aksi terlihat tanpa pengguna harus menghafal arti warna/ikon.
5. **Aesthetic & minimalist design.** Hanya data/action relevan per halaman; tidak memaksakan empat KPI, tiga feature cards, lima chart di semua dashboard.
6. **Consistency and standards.** Satu set token, font, komponen, label, ikon, pola form dan tabel.
7. **WCAG 2.2 AA target.** Keyboard, focus visible, contrast, accessible name, descriptive errors, touch target, reduced motion.
8. **Data-first UI.** Grafik ada hanya jika menjawab pertanyaan operasional, dengan sumber data, periode, denominator, dan empty state.
9. **Contextual motion.** Interaksi cepat dan tidak mengganggu; tidak ada animasi dekoratif kontinu.
10. **Accessibility on low-end mobile.** Form sederhana, tombol nyaman disentuh, tidak mengandalkan hover atau navigasi peta sebagai satu-satunya cara.

Sumber: https://www.nngroup.com/articles/ten-usability-heuristics/ · https://www.w3.org/TR/WCAG22/ · https://designsystem.digital.gov/design-tokens/color/overview/

### 13.2 HARD NO-SLOP RULES (BLOCKING)

- **No gradients** untuk background, hero, card, buttons, charts, map overlay kecuali dibutuhkan visualisasi data spesifik yang disetujui (default: tidak).
- **No glassmorphism, neumorphism, glow, neon borders, aurora background, blurry blob, floating 3D emoji, rainbow palette, glass navigation.**
- **No “four colors four numbers”:** jangan memberi satu warna berbeda pada masing-masing kartu KPI. KPI cenderung berbasis teks dan angka netral.
- **No card-in-card-in-card** tanpa kebutuhan informasi.
- **No icon badge circle pada semua item**; ikon digunakan untuk navigasi/fungsi, bukan hiasan repetitif.
- **No fake dashboard data** yang tidak diberi label SIMULASI atau tidak berasal dari DB.
- **No gratuitous large hero** di dashboard; halaman public boleh punya hero editorial yang proporsional.
- **No animated counters**, parallax scrolling, hover-scale setiap card, shimmer berlebihan, permanent pulsing dot, glowing loading ring.
- **No excessive shadows**: gunakan border + spacing; shadow hanya untuk popover/modal/elevated surface yang memang melayang.
- **No horizontal scrolling** pada seluruh halaman mobile; untuk tabel besar sediakan layout list/card yang alternatif, bukan memaksa kolom sempit.
- **No tiny gray text** untuk informasi kritis. Jangan menurunkan opacity teks hanya agar tampak estetis.
- **No important actions hidden behind hover-only interactions.**
- **No red/green-only signals**; status harus menggunakan teks dan/atau simbol.
- **No copy-paste landing page** dari template, tutorial, atau repo pihak lain. Komponen open-source boleh digunakan sesuai lisensi tetapi wajib dikustomisasi.

### 13.3 Locked brand palette (light-mode first)

| Token | HEX | Pemakaian |
|---|---|---|
| `--background` | `#F7F9F8` | background page |
| `--surface` | `#FFFFFF` | card/table/dialog |
| `--foreground` | `#162826` | heading, body, KPI |
| `--primary` | `#0F766E` | primary CTA, selected nav, focus accent |
| `--primary-subtle` | `#E6F5F0` | subtle non-critical background; secukupnya |
| `--muted-foreground` | `#596D67` | descriptions, metadata |
| `--border` | `#DDE5E2` | outline card, input, separators |
| `--danger` | `#B42318` | error/destructive only |
| `--danger-subtle` | `#FFF3F1` | error background sparingly |

**Status design:** default status badges berbasis neutral surfaces, teks + icon; warna brand hanya untuk action aktif. Warna merah khusus error/destructive/alert yang benar-benar perlu, bukan kategori lokasi DBD. Bila perlu warna semantik tambahan (success/warning), tambahkan setelah uji contrast dan diskusi alasan; **jangan** menjadikan semua status rainbow.

### 13.4 Color distribution

- Mayoritas luas permukaan = background/surface netral.
- Deep ink untuk hierarki teks.
- Teal hanya untuk tindakan/brand/selected state yang harus menonjol.
- Outline dan subtle surface untuk grouping sekunder.
- Peta menggunakan basemap muted/desaturated, marker minimal. Hindari heatmap merah/hijau yang diklaim sebagai peta risiko DBD.
- Jangan memakai gradient/heatmap untuk *aesthetic only*; jika suatu saat terdapat data valid yang cocok untuk density heatmap, dokumentasikan metodologinya.

### 13.5 Typography (satu family, konsisten)

**Font:** Plus Jakarta Sans via `next/font/google` (self-hosted by Next where appropriate). Fallback `system-ui, sans-serif`; font weights 400, 500, 600, 700. Tidak menambahkan font dekoratif kedua tanpa ADR.

| Token | Desktop | Mobile | Weight | Line-height |
|---|---:|---:|---:|---:|
| `display` (public hero) | 52–60px | 32–38px | 700 | 1.1–1.2 |
| `page-title` | 26–30px | 22–26px | 700 | 1.25 |
| `section-title` | 20–22px | 18–20px | 600 | 1.3 |
| `card-title` | 16–18px | 16px | 600 | 1.4 |
| `body` | 16px | 16px | 400 | 1.5–1.65 |
| `body-sm` | 14px | 14px | 400/500 | 1.45 |
| `meta` | 12–13px | 12–13px | 500 | 1.4 |
| `kpi` | 30–36px | 28–32px | 700 | 1.1 |

- `font-variant-numeric: tabular-nums` pada semua KPI/tabel tanggal/angka.
- Tidak semua heading diberi uppercase atau tracking lebar. Gunakan heading case Bahasa Indonesia yang natural.
- Jangan mengecilkan font di bawah 12px untuk informasi penting.
- Teks harus reflow pada 320px dan zoom 200%; long words/errors tidak boleh terpotong.

### 13.6 Spacing, radius, layout

- Grid spacing berbasis skala 4px: 4/8/12/16/24/32/40/48/64; jangan nilai random.
- Page padding mobile 16px, tablet 24px, desktop 32px (sesuaikan layout).
- Content max width: app 1440px, article/education 760px, form 640px.
- Card border radius 14–16px; input 10px; button 10px; pill hanya untuk filters/badges jika semantik memerlukan.
- Default card: surface putih + 1px border. No shadow kecuali overlay/elevation.
- Sidebar desktop sekitar 240–256px; collapse on tablet and bottom/nav drawer on mobile if usable.
- Forms: satu kolom pada mobile; dua kolom desktop hanya bila kedua field berkaitan.
- Tabel: header jelas, row hover subtle, empty/loading/errors; line-height nyaman.
- Jangan memaksa simetri tiga kolom pada konten yang secara informasi membutuhkan satu kolom.

### 13.7 Component states wajib

Setiap komponen interaktif memiliki: `default`, `hover` jika pointer, `focus-visible`, `active`, `disabled`, `loading` bila async, `invalid/error` bila input, dan appropriate empty/success feedback.

- **Button:** satu CTA dominan per view/section; secondary outline/ghost; destructive button dengan konfirmasi.
- **Input:** label permanen, helper, error, required indicator; jangan placeholder sebagai label.
- **File uploader:** image size/type guidance, progress, preview, remove, retry, cancel.
- **Map:** skeleton/empty/unavailable, zoom controls, marker list alternative, accessible legend.
- **Table:** sort/filter/pagination, semantic headers, keyboard accessible.
- **Status pill:** teks jelas; tidak tergantung warna.
- **Dialog:** focus trap, accessible title, Escape behavior, restore focus.
- **Toast:** informasi singkat; error kritis tetap terlihat di context, bukan hanya toast yang hilang.
- **Loading:** skeleton pada konten yang memerlukan; jangan animate seluruh dashboard pada mount.

### 13.8 Motion specification

- Default: **no motion unless it communicates state change**.
- Hover state: CSS color/border 120–180ms; tidak mengubah layout.
- Dialog/popover: 150–220ms subtle opacity/translate 4–8px (jika tidak mengganggu).
- Success: check/icon atau updated status tanpa confetti atau bounce.
- Task transitions: status label dan event timeline update langsung; tidak memerlukan bouncy spring.
- Chart: no animated mount; perubahan data boleh smooth seperlunya.
- Respect `prefers-reduced-motion: reduce`: nonessential motion disabled.
- Jangan install animation library hanya untuk dua transitions yang CSS dapat tangani. `motion` opsional jika jelas diperlukan.

### 13.9 Iconography

- Satu icon family: **Lucide React**, ukuran standar 16/18/20/24 dan stroke konsisten.
- Pilih icon yang membantu scan action (report, map, review, tasks, check), bukan setiap judul.
- Tidak menggunakan emoji untuk ikon produk; text label tetap tersedia.

### 13.10 Per-page art direction

| Layar | Pertanyaan utama pengguna | Visual hierarchy | Hal yang tidak boleh |
|---|---|---|---|
| Landing | “Ini apa dan bagaimana membantu?” | manfaat + 1 CTA + alur 3 langkah + credibility | giant empty gradient hero, icon card spam |
| Citizen home | “Apa tindakan saya berikutnya?” | CTA Buat Laporan, status laporan, PSN minggu ini | 6 KPI tak relevan |
| Report form | “Bagaimana mengirim temuan dengan benar?” | foto → lokasi → rincian → AI suggestion → review | chat UI default untuk semua tindakan |
| AI draft review | “Apakah hasil AI benar?” | image/source vs draft fields, edit controls, limitations | AI confidence palsu, auto-submit |
| Citizen report detail | “Sedang diproses sampai mana?” | status + timeline + next action | detail internal kader yang sensitif |
| Cadre queue | “Apa yang perlu diverifikasi?” | filter + list/table + aging signal | map besar tanpa daftar |
| Report verification | “Buktinya cukup untuk keputusan?” | foto, lokasi private, timeline, actions | modal dengan terlalu banyak hidden content |
| Task workspace | “Siapa menangani apa?” | grouped status/table, owner, due | setiap task menjadi kartu gradient |
| Analytics | “Di mana backlog dan hambatannya?” | backlog + trend + completion + filters | four colors four numbers |
| Community map | “Di mana temuan aktif di area saya?” | map + list alternative + legend/status | peta pasien, heatmap klinis palsu |
| PSN | “Apa yang perlu saya lakukan minggu ini?” | concise checklist, progress plain text | streak/gamification manipulatif |
| Education | “Informasi apa yang terpercaya?” | source dated content, clear headings | diagnosis chatbot tanpa guardrail |

### 13.11 UI design acceptance

- Semua halaman memakai tokens; tidak ada hex/spacing random tersebar di feature components.
- Screenshot 390, 768, 1440px tanpa overflow/clipping; zoom 200% usable.
- Keyboard Tab order logis, focus ring terlihat, modal trap/return focus.
- WCAG AA minimum untuk contrast text 4.5:1 (normal), komponen non-text relevant 3:1, bukan warna saja.
- UI state loading/empty/error/success dicoba secara nyata.
- Manusia yang tidak mengenal kode dapat membuat laporan tanpa bimbingan lisan dalam usability test.
- Screenshots menjalani **look-and-fix loop**: temukan 3 masalah terbesar → perbaiki → screenshot ulang, maksimal tiga iterasi per milestone.

### 13.12 Design skill references & precedence

| Resource | URL | Gunakan untuk | Catatan |
|---|---|---|---|
| Taste Skill | https://github.com/leonxlnx/taste-skill | art direction **public-facing landing**, screenshot audit | skill v2 khusus public pages; untuk app dashboard pakai review prinsip, jangan memaksakan marketing style |
| UI UX Pro Max | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | accessibility, typography, layout, component/UX audit | jangan terapkan otomatis palette/style rekomendasinya bila bertentangan dengan token DengueWatch |
| Awesome Claude Design | https://github.com/VoltAgent/awesome-claude-design | inspirasi `DESIGN.md` dan workflow governance | daftar referensi, bukan standar ilmiah |
| Design Motion Principles | https://github.com/kylezantos/design-motion-principles | audit motion dan anti-slop | utamakan restraint untuk dashboard |
| Skiper UI | https://skiper-ui.com | seleksi micro-interactions bila memang berguna | jangan mengimpor efek dekoratif tanpa kebutuhan |
| Nielsen Norman Group | https://www.nngroup.com/articles/ten-usability-heuristics/ | evaluasi usability | stronger empirical/research-oriented base |
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | accessibility acceptance | normative accessibility standard |
| USWDS Color | https://designsystem.digital.gov/design-tokens/color/overview/ | use of color and semantic tokens | government design system guidance |

**Perintah opsional untuk skill Antigravity** (ikuti readme yang berlaku sebelum menjalankan):

```bash
# Optional design reference, not prerequisite to build
npm install -g ui-ux-pro-max-cli
uipro init --ai antigravity
```

Install skill hanya setelah membaca sumber dan memutuskan tidak bertentangan dengan style guide. Jangan memberikan coding agent izin mengeksekusi script third-party tanpa review keamanan. Karena skill dan versi berubah, dokumentasi repo resmi adalah otoritas instalasi terkini.

---

## 14. FRONTEND INFORMATION ARCHITECTURE & ROUTES

### 14.1 Route structure

```text
/
├── /tentang
├── /cara-kerja
├── /edukasi
├── /login
├── /daftar
├── /lupa-password
├── /app
│   ├── /beranda
│   ├── /laporan
│   │   ├── /buat
│   │   └── /[id]
│   ├── /pencegahan
│   ├── /peta-komunitas
│   ├── /notifikasi
│   └── /profil
├── /kader
│   ├── /ringkasan
│   ├── /verifikasi
│   │   └── /[reportId]
│   ├── /tugas
│   │   └── /[taskId]
│   ├── /peta
│   └── /riwayat
└── /pengelola
    ├── /ringkasan
    ├── /analitik
    ├── /laporan
    └── /pengguna       # guarded, only if needed
```

`/api/v1/**` memiliki struktur endpoint tersendiri seperti pada Bagian 11. Jangan membuat seluruh halaman berstatus `use client`; gunakan server components untuk read-only data, client components hanya ketika perlu interaksi/browser API/map.

### 14.2 Navigation & permissions

- Guest: top nav ringkas landing/edukasi/cara kerja/login; mobile drawer accessible.
- Resident: main nav Beranda, Laporan Saya, Pencegahan, Peta Komunitas, Profil. Aksi Buat Laporan paling mudah ditemukan.
- Cadre: nav Ringkasan, Verifikasi, Tugas, Peta, Riwayat.
- Manager: Ringkasan, Analitik, Laporan, Pengguna bila berwenang.
- Jangan menampilkan nav yang mengarah ke halaman forbidden, tetapi **jangan menganggap nav hiding cukup sebagai security**.

### 14.3 Responsive behavior

- **320–480px:** single-column, CTA besar, no horizontal overflow, status timeline compact, filter drawer.
- **481–767px:** card/grid adaptif, readable form, nav drawer/bottom depending usability.
- **768–1023px:** side navigation collapsible, tablet map/list tabs.
- **1024–1440px:** desktop sidebar + content, split-pane verification, maps and tables where relevant.
- **>1440px:** container max width, avoid excessive stretched text.

### 14.4 Copywriting style

- Bahasa Indonesia natural, singkat, empatik, tidak menggurui atau menakut-nakuti.
- Contoh: “Foto telah dianalisis. Periksa kembali saran AI sebelum mengirim.”
- Jangan: “AI mendeteksi sarang dengue berbahaya dengan akurasi 99%.”
- Contoh error: “Foto maksimal 5 MB dan harus berupa JPG, PNG, atau WebP.”
- Contoh unauthorized: “Akun ini tidak memiliki izin melihat laporan tersebut.”
- Contoh empty state: “Belum ada laporan yang perlu diverifikasi di wilayah ini.”
- Jika data demo: tulis jelas “Data simulasi untuk demonstrasi, bukan data kasus DBD sebenarnya.”

---

## 15. CODE QUALITY, CLEAN ARCHITECTURE, DAN ENGINEERING STANDARDS

### 15.1 Coding principles (enforced)

1. **Separation of Concerns (SoC):** UI, validation, business service, data access, integrations dipisah.
2. **Single Responsibility Principle (SRP):** function/module memiliki satu tujuan; split ketika logic mulai multi-purpose.
3. **DRY, but no premature abstraction:** jangan duplikasi business logic; tidak perlu abstraction besar untuk satu use case yang sederhana.
4. **KISS:** prioritaskan alur yang mudah dipahami, bukan pattern kompleks demi terlihat enterprise.
5. **YAGNI:** implementasi fitur sesuai P0/P1; jangan menulis generic framework untuk fitur masa depan.
6. **SOLID pragmatically:** dependency inversion pada external integrations, cohesion kuat pada domain services; jangan over-engineer class hierarchies.
7. **Clean Code:** naming bermakna, function kecil dan teruji, early return untuk error, tanpa magic values, no dead code.
8. **Type safety:** TypeScript strict, no `any` kecuali documented escape hatch, infer types from Zod where practical.
9. **Fail closed:** error authorization → deny, AI fail → fallback/manual; tidak auto-approve laporan.
10. **Explicit state machine:** status change melalui domain methods, bukan arbitrary setter.
11. **Idempotency:** create/report/task untuk retry aman, tidak duplikat.
12. **Least privilege:** minimal permission pada API, DB, storage, config.
13. **Observability:** structured logs dengan request ID dan error code, tanpa secrets/PII.
14. **Testability:** dependency injection untuk Gemini adapter, clock, repo, uploader supaya mock mudah dibuat.
15. **Maintainability:** migrations, docs, README, consistent lint/format, small commits dan review.
16. **Accessibility as engineering quality:** a11y regression adalah bug, bukan cosmetic change.
17. **No premature optimization:** optimasi saat profil data/test menunjukkan bottleneck; tetap lakukan indexes dan pagination dasar.
18. **Secure defaults:** semua resource private kecuali eksplisit public; cache private response di-disable.
19. **Predictable error handling:** domain errors dipetakan ke status HTTP dan UX message jelas.
20. **No silent failures:** semua error async dilog aman; UI menunjukkan retry/fallback.

### 15.2 Recommended repository structure

```text
denguewatch/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   ├── (auth)/
│   │   ├── (resident)/app/
│   │   ├── (cadre)/kader/
│   │   ├── (manager)/pengelola/
│   │   └── api/v1/
│   ├── components/
│   │   ├── ui/                 # curated shadcn/Radix primitives
│   │   ├── layout/
│   │   ├── forms/
│   │   └── feedback/
│   ├── features/
│   │   ├── auth/
│   │   ├── reports/
│   │   │   ├── components/
│   │   │   ├── schemas/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   ├── verification/
│   │   ├── tasks/
│   │   ├── psn/
│   │   ├── maps/
│   │   ├── analytics/
│   │   └── notifications/
│   ├── integrations/
│   │   ├── gemini/
│   │   ├── supabase/
│   │   └── maps/
│   ├── lib/
│   │   ├── auth/
│   │   ├── errors/
│   │   ├── validation/
│   │   ├── rate-limit/
│   │   ├── logger/
│   │   ├── dates/
│   │   └── utils.ts
│   ├── styles/
│   │   ├── tokens.css
│   │   └── globals.css
│   └── test/
│       ├── factories/
│       └── fixtures/
├── supabase/
│   ├── migrations/
│   ├── tests/
│   └── seed.sql  # only sanitized deterministic sample data
├── e2e/
├── public/
├── docs/
│   ├── PRD.md
│   ├── DESIGN.md
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── API.md
│   ├── SECURITY.md
│   └── DEMO.md
├── .env.example
├── eslint.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

**Catatan:** struktur ini template referensi, bukan kewajiban membuat folder kosong. Tambahkan file/folder hanya jika ada implementasi. Gunakan feature-first untuk domain; UI primitives reusable disimpan di shared components.

### 15.3 File and function conventions

- React component PascalCase (`ReportForm.tsx`); hooks `useReportForm.ts`; functions camelCase; DB snake_case.
- DTO & validation schema di dekat use case; avoid duplicate schemas.
- No barrel exports yang menyebabkan circular imports jika dapat dihindari.
- No business logic di JSX panjang. Max satu concern per function; jika component >250 lines audit pemisahan, bukan aturan absolut.
- Do not create generic `utils.ts` yang menjadi dumping ground.
- Config constants seperti max upload size dibuat single-source dari environment/schema.
- Enums/status mapped via centralized typed mapping untuk UI labels.
- Date library/use timezone consistently. Simpan UTC, render `Asia/Jakarta`.
- No use of arbitrary `console.log` user input, photo URLs, API keys; use safe structured logger.

### 15.4 Git workflow

- Branch `main` protected if possible; feature branches `feat/report-submission`, `feat/cadre-verification`, `fix/upload-validation`, etc.
- Small commits, meaningful conventional messages (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`).
- PR checklist: scope, screenshot 390/768/1440, accessibility, tests, security, DB migrations, no secret.
- Never commit generated build, `.next`, credentials, user images with unverified rights, or personal medical records.
- Use `pnpm` **atau** npm, bukan campuran; contoh roadmap menggunakan `pnpm` apabila tersedia.

### 15.5 Code review gates

- Reviewer menjelaskan **why** solusi diperlukan, bukan hanya what changed.
- Tipe/input/schema: updated? server validation? DB constraints? tests?
- Route: authorized? area-scoped? rate-limited? stale state protected?
- Storage: private? exif stripped? signed URL lifetime? file type sniffed?
- UI: focus, error, loading, no-slop, mobile screenshot?
- AI: model usage safe, output parsed, injection handled, prompt not leaking PII?
- Analytics: source dan denominator benar? no fabricated claims?

---

## 16. TECHNOLOGY STACK, LIBRARIES, DAN GITHUB REPOSITORIES

> **Version policy:** gunakan current compatible stable versions pada waktu implementasi; baca changelog dan lock dependencies. Jangan memasang seluruh daftar jika tidak dipakai. Hindari gonta-ganti library tanpa ADR.

| Layer | Teknologi / package | Tujuan | GitHub / docs |
|---|---|---|---|
| Framework | **Next.js** | App Router, Route Handlers, server rendering | https://github.com/vercel/next.js · https://nextjs.org/docs |
| Language | **TypeScript** | strict typing | https://github.com/microsoft/TypeScript |
| UI runtime | **React** | components and interactions | https://github.com/facebook/react |
| CSS | **Tailwind CSS** | token-based utility styling | https://github.com/tailwindlabs/tailwindcss |
| UI primitives | **shadcn/ui** (curated) | accessible building blocks, customize design | https://github.com/shadcn-ui/ui |
| Accessibility primitives | **Radix UI** (via shadcn) | Dialog, Select, Tabs, Dropdown | https://github.com/radix-ui/primitives |
| Icon | **Lucide React** | consistent outline icons | https://github.com/lucide-icons/lucide |
| Fonts | **Plus Jakarta Sans** | unified typography via next/font | https://fonts.google.com/specimen/Plus+Jakarta+Sans |
| Form | **React Hook Form** | input state, form submission | https://github.com/react-hook-form/react-hook-form |
| Validation | **Zod** | shared runtime schemas, output parsing | https://github.com/colinhacks/zod |
| Data fetching (optional) | **TanStack Query** | cache, retries, invalidation | https://github.com/TanStack/query |
| Backend/DB/Auth/Storage | **Supabase** | Postgres, Auth, Storage, RLS | https://github.com/supabase/supabase · https://supabase.com/docs |
| Supabase SSR | **@supabase/ssr** | cookie/session helpers | https://github.com/supabase/ssr |
| Gemini SDK | **@google/genai** | model calls server-side | https://github.com/googleapis/js-genai · https://ai.google.dev/gemini-api/docs |
| Map | **MapLibre GL JS** | geospatial visualization | https://github.com/maplibre/maplibre-gl-js · https://maplibre.org/maplibre-gl-js/docs/ |
| Chart | **Recharts** | minimal, labeled charts | https://github.com/recharts/recharts |
| Date | **date-fns** (optional) | date formatting and helpers | https://github.com/date-fns/date-fns |
| Motion | **CSS** (default), **Motion** optional | purposeful interaction only | https://github.com/motiondivision/motion |
| Unit tests | **Vitest** | pure services/schemas/component units | https://github.com/vitest-dev/vitest |
| Component tests | **Testing Library** | user-facing interaction tests | https://github.com/testing-library/react-testing-library |
| E2E | **Playwright** | cross-browser workflows, visual screenshots | https://github.com/microsoft/playwright |
| Accessibility audit | **axe-core** / `@axe-core/playwright` | automated a11y checks | https://github.com/dequelabs/axe-core |
| Code lint | **ESLint** | static checks | https://github.com/eslint/eslint |
| Code format | **Prettier** | consistent style | https://github.com/prettier/prettier |
| Deploy | **Vercel** | Next.js deployment | https://vercel.com/docs |

### 16.1 Official documentation that overrides old tutorials

- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Supabase SSR sessions (server/client separation): https://supabase.com/docs/guides/auth/server-side/creating-a-client?environment=route-handler&framework=nextjs
- Supabase RLS + grants: https://supabase.com/docs/guides/database/postgres/row-level-security
- Gemini image understanding: https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- MapLibre setup and tiles: https://maplibre.org/maplibre-gl-js/docs/
- OWASP validate all inputs: https://devguide.owasp.org/en/04-design/02-web-app-checklist/05-validate-inputs/
- OWASP file upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

**Dependency reminder:** Some official APIs/packages can change. As of the documented sources, use maintained `@google/genai` instead of mixing deprecated tutorials; use `@supabase/ssr` rather than old auth helper packages. For Next.js 16+ the auth refresh convention uses `proxy.ts`; older Next.js uses `middleware.ts`. Implement according to installed framework version.

### 16.2 Avoid unnecessary dependencies

- No Material UI + Ant Design + shadcn concurrently.
- No multiple icon systems.
- No `framer-motion` purely for appearing cards.
- No third-party “AI dashboard template” or complete theme.
- No rich text editor unless real content authoring needs it.
- No external geospatial ML library for fake “risk score”.
- No generic CMS, per INVOFEST competition rule.

---

## 17. SECURITY, PRIVACY, AI SAFETY, DAN ABUSE PREVENTION

### 17.1 Threat model ringkas

| Threat | Attack surface | Mitigasi wajib | Test |
|---|---|---|---|
| IDOR / Broken Object Level Authorization | `/reports/:id`, `/tasks/:id`, images | owner/area scoping server+RLS, opaque ID not auth | user A can't read B |
| Broken Function Level Authorization | `/review`, `/admin` | server role checks, no client-supplied role | resident POST verify = 403 |
| Privilege escalation | `profiles.role`, memberships | restricted writes/admin flow, audited | mutate role rejected |
| Input injection/XSS | descriptions, AI text, comments | Zod, React escape, no raw HTML, CSP | `<script>` rendered inert |
| SQL injection | list filters, sorting | parameterized queries, allowlisted sort keys | invalid order field rejected |
| Malicious file upload | report/evidence photos | extension+magic bytes+decode, size, pixels, rename, private bucket | polyglot/SVG/exe rejected |
| EXIF privacy leak | photos | strip GPS EXIF on server/transcode before storage | uploaded EXIF absent |
| Prompt injection | image text, Gemini response | untrusted input treated as data, fixed system task, output schema, no tool privileges | malicious image text not obeyed |
| AI hallucination | photo analysis | human confirmation and disclaimer | no disease/probability claims |
| API key leakage | Next client bundle/logs | server-only env, log redaction, secret scanning | inspect bundles/logs |
| Spam/abuse | report submission and AI requests | per-user/IP rate limits, image quotas, moderation, duplicate review | 429 upon abuse |
| CSRF | cookie-auth mutations | safe auth pattern, SameSite, Origin check/CSRF for relevant flows | forged cross-origin rejected |
| Session theft/fixation | auth cookies | secure HTTP-only where supported, framework SSR guidance, no tokens in logs | auth tests |
| Map privacy leak | GeoJSON, tile/custom overlays | public generalized aggregate, private points via scoped API | guest payload has no exact coordinates |
| Data scraping | bulk queries | scoped pagination, rate limits, min aggregation threshold | no full dataset export |
| Stored PII in analytics | AI insights prompt | aggregated numeric data only | no names/phones/location in prompt |
| Double-submit/race condition | reports, task state | idempotency keys, optimistic locking, transaction/RPC | repeated POST no duplicates |

### 17.2 Secure media pipeline

1. Authenticated user requests an upload; server validates allowed purpose and ownership.
2. Upload only JPEG/PNG/WebP, max **5 MiB/photo**, up to **3 photos/report** (configuration centralized), choose sensible pixel count cap to prevent decompression bombs.
3. Verify actual file signature and decode; distrust filename and `Content-Type` header alone.
4. Re-encode/transcode server-side to safe output and strip EXIF/GPS metadata where tooling permits; generate random path (UUID), never trust original filename.
5. Store in **private** Supabase bucket with restrictive Storage policies.
6. Server checks scope before generating short-lived signed URL. Never put signed URL in long-lived public cache/log.
7. Use abort/timeout/size limit for image processing; reject malformed/corrupt files.
8. If using browser direct-to-storage upload, use scoped signed upload path and **validate again server-side before accepting report**; unsigned upload path cannot bypass verification.
9. Orphan cleanup and retention policy for aborted submissions.
10. Images used in demo should be original, generated with appropriate rights, or sourced from openly licensed datasets with attribution.

### 17.3 Authentication and authorization

- Supabase Auth handles identity; Next server checks user via current validated session (`getClaims()` or fresh `getUser()` as justified), never rely on raw `getSession()` user object as sole proof of authorization.
- RLS enforced at DB; grants narrowed; storage policy separate.
- Backend checks role and scope for **every mutation**, not only protected page layout.
- On not-found or forbidden, minimize information leakage (may return 404 for resources outside scope).
- Session/auth responses containing private data: `Cache-Control: private, no-store` where appropriate.
- Role-management is a privileged admin operation only, and event logged.
- Use secure cookies, TLS in production, CSRF-aware protections, restrictive CORS, and appropriate headers (CSP, HSTS where HTTPS, `X-Content-Type-Options: nosniff`, etc.).

### 17.4 Gemini-specific rules

- Use **Gemini API as the only generative AI provider** in MVP; no hidden OpenAI/Claude fallback or automatic third-party services.
- Prompt contains clearly limited task: describe visually observable objects, use allowed category enum, identify uncertainty. Do not assert DBD/larva/species or health condition.
- Treat instructions embedded in photos/text as **untrusted content**, not higher-priority instructions.
- Schema must reject unexpected output keys and overlong strings; errors use fallback rather than invented content.
- No automatic state change/notifications based exclusively on Gemini output.
- Avoid passing reporter name, exact house address, phone number, patient details, or precise GPS to AI. Only necessary cropped/normalized image and non-identifying context.
- Track request token usage/cost where available, model name, latency, success/failure; never store raw confidential prompt or secret in logs.
- Set timeout and limited retry with exponential backoff for transient errors; avoid infinite retry loops.
- Include user-facing notice that photos may be processed by an external AI service, require appropriate consent/privacy disclosure before enabling real-user use.
- If AI result is unsafe, contradictory, or fails validation, show “Analisis AI tidak tersedia, lanjutkan laporan secara manual.”

### 17.5 Data minimization/privacy

- No patient identity, symptoms, medical diagnosis, exact household participant list in public dashboard.
- Avoid collecting NIK, date of birth, exact home address, phone unless separately justified and documented.
- Photo may inadvertently include faces/license plates; warn user and provide crop/blur capability or refuse sensitive images for the demo.
- Public map: area-level aggregations with minimum sample threshold (recommended policy: do not display small cell counts below 5; consult disclosure risk, not a guarantee of anonymization).
- Consent is specific to photo processing, user report visibility, and AI processing; no broad checkbox pretending to confer legal compliance.
- Use neutral “lingkungan membutuhkan pemeriksaan” instead of a label identifying residence as infected.

### 17.6 Secure development standards

- Follow OWASP API Security Top 10, OWASP input validation/file upload cheat sheets, and relevant ASVS controls.
- Scan dependencies (`pnpm audit`/supported package scanner), secrets, and source code before deployment.
- No unsafe `eval`, `new Function`, direct HTML injection, insecure redirects, broad CORS `*` for authenticated endpoints.
- Avoid logging form data or full signed media URLs in analytics.
- Audit security-sensitive flows manually using browser DevTools / direct HTTP requests.

Security resources:
- https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- https://supabase.com/docs/guides/database/postgres/row-level-security

---

## 18. NON-FUNCTIONAL REQUIREMENTS (NFR)

| ID | Attribute | Target / constraint | Verification |
|---|---|---|---|
| NFR-01 | Responsive | 320–1440+ px, no horizontal overflow, touch targets usable | Playwright screenshot/interaction |
| NFR-02 | Accessibility | WCAG 2.2 AA *target*, zero critical axe violations; manual keyboard test | axe + manual |
| NFR-03 | Performance | Aim LCP ≤2.5s on representative mobile test, CLS ≤0.1, interactions responsive; measure rather than claim | Lighthouse/browser profiling |
| NFR-04 | API performance | Basic CRUD p95 <800ms under demo load excluding AI/network; aspirational | timed integration test |
| NFR-05 | AI latency | display loading and cancellation; app usable if AI unavailable | simulated timeout/failure |
| NFR-06 | Security | 100% private endpoints auth+scope validated; no high/critical known vulns at release | negative tests and audit |
| NFR-07 | Data integrity | no orphaned records, duplicate report under retry, invalid transitions | DB integration tests |
| NFR-08 | Reliability | recoverable dependency failures; no silent data loss | fault injection |
| NFR-09 | Maintainability | strict TS, consistent architecture, automated lint/tests | CI |
| NFR-10 | Observability | safe request IDs, error codes, deployment logs; no PII in logs | log audit |
| NFR-11 | Privacy | no public exact location/image; signed access | authorization/network audit |
| NFR-12 | Internationalization | UI Bahasa Indonesia, date WIB, consistent terminology | content audit |
| NFR-13 | Browser support | current Chrome, Safari, Firefox, mobile browsers | manual tests; smoke suite |
| NFR-14 | SEO public pages | meaningful title/metadata and semantic headings, avoid SEO demands on private dashboard | page audit |
| NFR-15 | Cost guardrails | AI rate limits, image size, query pagination, tile quota | configuration review |

**Performance numbers are engineering targets, not measured facts about the prototype.** Benchmarks should specify device/network and stage of deployment.

### 18.1 Analytics definitions (do not mislead)

- `reports_created`: count reports submitted in range, not number of dengue infections.
- `reports_verified`: verified by authorized cadre, not laboratory-confirmed dengue cases.
- `completion_rate`: number of eligible, validated reports that meet completed definition / eligible validated reports in same cohort. Document how cancelled/duplicate/reopened reports are handled.
- `median_verification_time`: median difference first submitted → first valid cadre review; exclude invalid anomalies and document methodology.
- `median_completion_time`: median verified → fully resolved, or submitted → resolved (choose and label consistently).
- `psn_participation`: unique eligible registered resident users with a weekly checklist / eligible registered resident users in that area/week. This is **digital participation**, not all homes in RT.
- `ABJ`: **not** from resident PSN checklist; only if verified inspections with valid denominator are captured in future module.
- `active_reports`: define statuses (e.g. pending/verified/in_action/needs_information); no counting status blindly.
- AI-generated narrative cannot override calculated values.

---

## 19. TEST STRATEGY — UNIT, INTEGRATION, E2E, SECURITY, UX

### 19.1 Test pyramid

- **Unit tests (Vitest):** numeric parsers, Zod schemas, state transitions, role policy helpers, statistics, date week logic, Gemini response parsing, safe text sanitizer.
- **Component tests (Testing Library):** form validation, accessible errors, file preview, status display, modal focus, role navigation.
- **Integration tests:** Supabase policies, transaction or RPC, authenticated API, storage authorization, task workflow, idempotency.
- **E2E (Playwright):** full resident → cadre → assignee → reviewer workflow and mobile keyboard/navigation.
- **Accessibility:** axe scans + manual keyboard/screen-reader sampling; automated testing doesn't cover every issue.
- **Visual regression:** screenshots 390/768/1440 px, compare differences and review manually.
- **Security tests:** OWASP-oriented negative cases and direct unauthorized API calls.

### 19.2 Mandatory validation test cases

| ID | Input/action | Expected result |
|---|---|---|
| VT-001 | numeric UI type `12abc` | no acceptance of invalid characters, readable field error |
| VT-002 | numeric UI paste `12e3` | reject; not interpreted 12000 |
| VT-003 | numeric UI paste `-5` | reject for nonnegative integer field |
| VT-004 | numeric UI paste `1.5` | reject for integer-only field |
| VT-005 | numeric UI empty input | editing allowed; submit required validation fails |
| VT-006 | forged JSON `{"count":"12"}` | reject if API expects numeric JSON type |
| VT-007 | forged JSON `{"count":12.5}` | 400 validation |
| VT-008 | forged JSON `{"count":-1}` | 400 validation |
| VT-009 | forged JSON `{"count":true}` | 400 validation |
| VT-010 | forged JSON `{"count":null}` | 400 where required |
| VT-011 | forged JSON `{"count":100000000000000000000}` | fail range/safe-int validation |
| VT-012 | report with latitude 91 | 400 validation / DB rejects |
| VT-013 | only latitude but no longitude | fail location pair validation |
| VT-014 | script tag in description | harmless displayed text, no XSS |
| VT-015 | JPEG file renamed `.png` with wrong magic | refuse or process safely after content sniff |
| VT-016 | `.svg` upload | 415/400 unsupported |
| VT-017 | photo >5 MiB | 413/validation error, no DB write |
| VT-018 | image has GPS EXIF | EXIF removed/restricted before persistence/serving |
| VT-019 | `role=manager` register payload | no role elevation |
| VT-020 | resident tries verify endpoint | 403 |
| VT-021 | cadre A fetches report B | 403/404, no signed URL |
| VT-022 | duplicate idempotency key | one report/task only |
| VT-023 | stale expectedVersion | 409 conflict |
| VT-024 | task complete with no evidence review | rejected |
| VT-025 | Gemini malformed JSON | fallback with no invented analysis |
| VT-026 | Gemini timeout/rate limit | manual flow remains usable |
| VT-027 | prompt injection in uploaded photo text | AI must not execute instructions/modify permissions |
| VT-028 | unauthorized request to private map GeoJSON | denied |
| VT-029 | browser zoom 200% / width 320 | content reflows, no loss of action |
| VT-030 | keyboard-only report submission | reachable labels, focus, errors, submit works |

### 19.3 End-to-end acceptance scripts

**E2E-A — Happy path (must pass)**
1. Register/login demo resident (or use seeded account).
2. Submit photo + valid details; optionally call Gemini; confirm draft.
3. See `pending_verification` with history.
4. Login cadre in same area; verify report.
5. Create task; start; upload evidence; request review.
6. Cadre approves evidence → task completed; report resolved by rule.
7. Resident sees status/history; manager dashboard count updates.
8. Peta/list does not reveal private residential coordinate to guest.

**E2E-B — AI unavailable**
1. Simulate Gemini timeout or missing key in demo mode.
2. UI explicitly indicates assistance unavailable.
3. Resident completes manual form; report persists and workflow proceeds.

**E2E-C — Unauthorized access**
1. Resident attempts direct POST cadre verify endpoint; server refuses.
2. Cadre outside area attempts read report media; server refuses.
3. View source/network: no `GEMINI_API_KEY`, secret service key, or public storage image URL.

**E2E-D — Invalid forms**
1. Numeric field rejects characters/paste; forged request fails API.
2. Wrong file, oversized image, missing required field, invalid coordinates all show targeted errors.
3. Invalid submit causes no partial side effects.

**E2E-E — Mobile usability**
1. Resident submits report on 390px viewport.
2. Kader verifies on 768px viewport.
3. Dashboard readable on 1440px without arbitrary gradients/colored KPI tiles.

### 19.4 Definition of Done per feature

- FR+AC implemented with real persistence and correct states.
- Unit tests for schema/domain, integration for auth/DB side effects, E2E for critical path.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass (substitute the package manager chosen by team).
- RLS authorization negative tests pass.
- Loading/empty/error/success states exist.
- Responsive 390/768/1440 screenshot inspected.
- Keyboard accessibility and labels checked.
- No unwanted libraries, secrets, mocked success, no-slop violations.
- README/docs updated; change recorded in implementation notes.

---

## 20. DELIVERY PLAN, MILESTONES, DAN WORKFLOW ANTIGRAVITY

> Deadline: **7 November 2026** berdasarkan guidebook. Jadwal berikut adalah *proposed plan*, bukan janji seluruh P1 akan selesai. P0 harus diselesaikan dan diuji lebih dulu.

| Tanggal | Milestone | Output minimum | Gate |
|---|---|---|---|
| **29 Oct** | Repository audit + scaffold + design tokens | Next.js TS, Tailwind, env template, layout skeleton, `DESIGN.md`, lint/test setup | server boots, build clean |
| **30 Oct** | DB migrations, Auth, roles, RLS | tables, policies, seeded demo users, login, guards | RLS deny tests |
| **31 Oct** | Resident report workflow | upload/private storage, report form validation, my reports | submission E2E |
| **1 Nov** | Gemini SmartSpot | image→suggestion, editable, fallbacks | output schema/security tests |
| **2 Nov** | Cadre verification | queue, review, event timeline, version control | cross-role/area tests |
| **3 Nov** | ActionLoop | tasks, assignment, evidence, human closure | full vertical E2E |
| **4 Nov** | P1 essentials | analytics, map, PSN as time permits | data correctness + no PII |
| **5 Nov** | UX+security audit | screenshots, a11y, mobile, rate limits, hardened validation | no critical failures |
| **6 Nov** | Documentation & video | description PDF, demo video, origin declaration, repo/link | submission rehearsal |
| **7 Nov** | Deadline buffer | final link/permissions review and submission | confirmed access |

### 20.1 Execution protocol for Antigravity

**Milestone 0 — Inspect and plan**
- Check repository state/branch, existing files, package manager, dependencies, `.env.example` and docs.
- Do not overwrite existing user code or files silently. Present short proposed file change list and dependencies.
- Copy this file into `docs/PRD.md`; extract visual rules to `docs/DESIGN.md`, not duplicate inconsistent variants.

**Milestone 1 — Foundation**
- Scaffold project with strict TS, base theme tokens, global layout, semantic components, form primitives, lint/test/Playwright.
- Make one representative Citizen screen and one Cadre screen visually before proliferating pages.
- Write `docs/DECISIONS.md` with actual framework/package versions chosen.

**Milestone 2 — Secure Data + Auth**
- Create migrations, Storage policies, RLS, area membership, seeded demo accounts and sample area.
- Run DB tests before endpoints are added.
- No service key inside frontend.

**Milestone 3 — Vertical Slice**
- End-to-end one report: citizen create → cadre verify → task → evidence → review → report resolution.
- Verify authorization and persistence at each step.
- Integrate Gemini after manual report flow works; AI failure cannot block submission.

**Milestone 4 — Polish**
- Dashboard with real aggregation and transparent demo label, optional community map, PSN.
- Loaders, empty states, errors, mobile and accessibility checks.
- Visual QA: screenshot → critique → fix; no generic template slop.

**Milestone 5 — Ship**
- CI lint/typecheck/tests/build; migrations documented; private resources secure.
- Deploy, run seed/demo scenario, capture screenshots, verify links.
- Write technical documentation + demo script + known limitations.

### 20.2 Rules for coding agents

- One task at a time: implement → test → run → screenshot → summarize changed files and remaining issues.
- Never claim a feature is implemented if only UI mockup exists.
- Never invent database results, stats, health impact numbers, third-party API success.
- Don't silently change locked palette, typography, role model, status names, or stack.
- Don't install skill scripts from unverified external code without user review; external skills provide advice, not authority over this PRD.
- Prioritize maintainable code; small and meaningful commits; stop and explain environmental blockers.
- If a requested change expands scope, put it in P2/future unless team explicitly approves.

### 20.3 Suggested agent prompts (copy/paste)

**Prompt 1 — Initialization**

```text
Read docs/PRD.md completely before writing code. Treat sections 0, 12, 13, 15, 17 and 19 as mandatory constraints. First inspect the repository and make an implementation plan for Milestone 1. Use Next.js + TypeScript + Tailwind with DengueWatch locked design tokens. No gradients, no colorful KPI cards, no full templates, no fake data presented as real. Do not implement unrelated P1/P2 features. After code changes, run lint, typecheck, build, inspect 390/768/1440 screenshots and report results.
```

**Prompt 2 — Auth and database**

```text
Implement Milestone 2 from docs/PRD.md: Supabase migrations, Auth/SSR integration, area memberships, role authorization, private storage policies and RLS. Residents must not self-upgrade role. Do not use service-role client for normal user flows. Add negative authorization tests covering cross-user and cross-area access. Do not touch marketing UI except as needed for login. Show migrations and tests actually run.
```

**Prompt 3 — Report and Gemini**

```text
Implement report creation and Gemini SmartSpot from sections 6, 7, 11, 12, 17 of docs/PRD.md. First make a fully functional manual flow, then optional image analysis through server-side @google/genai returning validated JSON that users can edit. All numeric inputs reject letters/e/E via controlled UI AND strict Zod/API/DB validation. Private images, EXIF removal, magic-byte checks and AI fallback are mandatory. Add unit/integration/E2E tests and verify no secrets are leaked.
```

**Prompt 4 — ActionLoop**

```text
Implement Cadre Verification and ActionLoop with enforced state machine, area-based authorization, optimistic locking, append-only audit history, task evidence and human approval. Resident must not modify report status; AI must not mark a report verified. Include failed/race/unauthorized tests. Build one complete resident→cadre→resolved demo scenario; do not add unrelated decorations or fake interactive buttons.
```

**Prompt 5 — UI review / anti-slop**

```text
Audit all DengueWatch pages against sections 13, 18 and 19 of docs/PRD.md. Visual direction: functional minimalism, Plus Jakarta Sans, neutral surfaces, single teal accent, no gradients/glow/glass, no four-color KPI cards, subtle borders, restrained motion. Inspect browser screenshots at 390/768/1440 px; test keyboard, focus, contrast, error/loading/empty states, reduced motion and 200% zoom. Prioritize the three most impactful fixes, implement, and recheck.
```

---

## 21. DEMO STRATEGY, MEASUREMENT, DAN LOMBA DELIVERABLES

### 21.1 Official competition alignment

**INVOFEST 2026 guidebook** (attached to the project) specifies:
- Work must match **Smart Ecosystems: Digital Solutions for a Sustainable Future** and chosen subtheme **Health & Well-being for All (SDG 3)**.
- Work must use HTML/CSS/JavaScript; frameworks allowed, but **full templates and CMS prohibited**.
- Submission includes: source/folder link Google Drive or GitHub, PDF work description following official template, statement of originality, and public demo video 3–10 minutes (≥1280×720).
- Preliminary scoring: UI/design **30%**, creativity/innovation **25%**, usability/responsiveness **20%**, originality **15%**, theme fit **10%**.
- Final presentation if selected: 5 minutes presentation + 10 minutes Q&A; follow event's current technical instructions.
- Deadline from guidebook: **7 November 2026**. Resolve any contradictory web page/registration details with organizers.

### 21.2 Demo seed data (fictitious only)

- One **fictional** neighborhood area (do not use real homeowner's precise coordinates).
- 3–5 demo accounts: resident, cadre A (assigned), cadre B (unassigned), manager, optional task assignee.
- 20–30 synthetic reports: status mix; image assets licensed or produced for demo, no actual confidential private properties.
- 5–10 tasks with evidence and some overdue/needs-review situations.
- PSN checklists for 3–4 weeks (demo only), properly labeled.
- All synthetic dashboards contain a visible `SIMULASI` label. No patient case data.

### 21.3 Demo video storyboard (suggested ~5–6 min)

1. **0:00–0:35** — Problem: WHO/Kemenkes statistics with year/source and workflow gap.
2. **0:35–1:10** — DengueWatch value proposition and roles; show landing briefly.
3. **1:10–2:15** — Resident report; upload photo; Gemini suggestion; edit; submit.
4. **2:15–3:30** — Cadre queue; review; task assignment; action evidence; approve.
5. **3:30–4:20** — Resident sees completion timeline and notification.
6. **4:20–5:10** — Manager dashboard and map, label simulation, PSN checklist.
7. **5:10–5:45** — Originality, privacy, human verification, SDG 3 impact measurement.

### 21.4 Required repo/docs deliverables

- Deployed responsive website with functional demo.
- GitHub source (ensure repository visibility and access per competition rules).
- `docs/PRD.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/DEMO.md`, `README.md`.
- Migrations, seed scripts, `.env.example`, automated tests, screenshots.
- Video public link, proposal description PDF in guidebook format, originality statement (download official template).
- Feature checklist showing implemented vs not implemented, known issues, and honest impact metrics.

### 21.5 Suggested evaluation goals for usability pilot

These are **targets to evaluate**, not claims of proven effects:
- 80% of 5 test participants can complete sample report without facilitator instruction (small formative test, not statistically representative).
- Kader can find a pending report and process it correctly in an observed scenario.
- Zero critical accessibility defects in sampled flows.
- No security regression in cross-area/role test matrix.
- All demo KPI values traceable to seeded rows; completion counts reconcile with query.
- Track task completion time and success rate; don't promise fewer dengue cases without appropriate study.

---

## 22. RISK REGISTER, DECISION LOG, DAN OPEN QUESTIONS

| Risk | Severity | Mitigation / decision |
|---|---|---|
| Sempitnya waktu kompetisi | High | prioritize P0 vertical slice; P1 optional |
| Produk mirip SILANTIK/DengueChat | High | original UI/workflow; focus verified action + PSN; document competitive positioning |
| Foto berisi identitas/lokasi orang | High | private storage, EXIF removal, moderation, permission review |
| Gemini hallucination | High | draft-only AI, structured schema, human verification, no clinical claims |
| Malicious upload | High | multi-stage file verification + limits + private bucket |
| Role or RLS mistakes | Critical | scoped authorization + direct negative tests |
| Inaccurate dashboard statistics | High | deterministic SQL, documented denominator, fixtures reconciliation |
| No real partner data | Medium | clearly marked simulation; interview/validation, no fake impact |
| Expensive AI calls | Medium | rate limits/quotas, manual fallback |
| Map tile provider cost/legal | Medium | licensed provider + attribution + quota |
| UI becomes AI slop | High | locked tokens, no-slop checklist, screenshot review |
| Scope creep | High | phase gates and change log |
| Internet downtime during demo | Medium | pre-recorded demo video and tested fallback scenarios; don't falsely claim fully offline app |

### 22.1 Resolved decisions

- Full-stack web, not native mobile; optional PWA.
- Next.js + TypeScript + Tailwind + Supabase + Gemini + MapLibre + Recharts.
- One primary teal accent, neutral palette, Plus Jakarta Sans.
- No gradients, no colorful KPI cards, no gimmicky animation.
- Three primary roles: resident, cadre, manager.
- AI advisory only; cadre verifies; task evidence reviewed before completion.
- Locations/photos private, public map generalized or aggregated.
- Strict multi-layer numeric validation (letters and scientific notation rejected for integer-only fields).
- Prioritize P0 before P1/P2.

### 22.2 Open questions requiring human/organizer decision

1. Pilot area: apakah menggunakan wilayah fiktif sepenuhnya atau mengajak RT/RW lokal secara resmi?
2. Registration: bebas daftar sebagai resident atau memerlukan invitation/approval untuk area tertentu?
3. Who can perform action task: cadre only for MVP, or verified volunteer role later?
4. File privacy retention: durasi dan penghapusan foto final untuk penggunaan nyata.
5. Peta: pilih penyedia tiles legal, kuota, dan style peta desaturated.
6. Apakah ada consent/izin menggunakan foto lingkungan nyata untuk demo video publik?
7. Resource dan versi Gemini mana yang tersedia dalam akun dan budget developer?
8. Perbedaan deadline pendaftaran dan deadline karya dari guidebook: konfirmasi ke panitia.
9. Apakah AI-generated assets / AI-assisted coding diperbolehkan secara eksplisit menurut ketentuan penyelenggara? Tanyakan, jangan berasumsi.
10. Apakah pihak Puskesmas akan menjadi pengguna sungguhan? Jangan memakai logo/menyatakan afiliasi resmi tanpa izin.

---

## 23. FINAL RELEASE CHECKLIST (MUST PASS)

### Functionality

- [ ] Resident dapat login, buat laporan, preview/edit hasil AI, submit, lihat history.
- [ ] Gemini dapat memberi saran yang tervalidasi; manual fallback bekerja.
- [ ] Cadre dapat verifikasi/reject/request info sesuai area.
- [ ] Task memiliki assignment, evidence, human review, state transitions valid.
- [ ] Manager analytics mengambil query DB dan tidak mengklaim data simulasi sebagai nyata.
- [ ] Tidak ada tombol inert yang seolah berfungsi.

### Security and validation

- [ ] Numeric-only field menolak `a`, `e`, `E`, `+`, `-`, `.` saat integer non-negative required; server juga menolak forged payload.
- [ ] Zod schema strict dan DB constraints menyaring invalid ranges/types.
- [ ] Cross-role, cross-area dan cross-user read/write tests pass.
- [ ] Supabase RLS and storage policies enabled, verified grants, no public photos.
- [ ] EXIF removed, file signature checked, size/pixel/type capped.
- [ ] No sensitive env key in Git, client bundle, server logs, or demo screenshots.
- [ ] AI output cannot mutate DB status/permissions or make clinical diagnosis claims.
- [ ] Race/idempotency and invalid transitions tested.

### UX/UI

- [ ] Locked palette and typography consistent across public + three portals.
- [ ] No gradient/glow/glass, no colorful KPI cards, no fake chart rainbow.
- [ ] Contrast, keyboard focus, labels, errors, empty/loading states audited.
- [ ] Screenshots 390, 768, 1440 px inspected; 200% zoom usable.
- [ ] Mobile report flow tested by human not familiar with product.
- [ ] No excessive animation; `prefers-reduced-motion` respected.

### Competition submission

- [ ] Website builds and deploys; preview/prod URLs verified by browser.
- [ ] README + `.env.example` + migrations + tests included.
- [ ] Demo video 3–10 min, ≥720p, public access confirmed.
- [ ] PDF deskripsi karya follows official naming/template.
- [ ] Originality declaration and accessible source link provided.
- [ ] All real statistics cite source+year, demo data clearly marked.

---

## 24. QUICK START: CARA MENGGUNAKAN PRD INI DI ANTIGRAVITY

1. Buat folder project Git (mis. `denguewatch/`) atau buka repo kosong di Antigravity.
2. Letakkan berkas ini di **`docs/PRD.md`** (atau `PRD.md` di root lalu sesuaikan prompt).
3. Baca Bagian **0, 5, 12, 13, 15, 17, 19, 20** sebagai batasan wajib sebelum generate app.
4. Di chat Antigravity, gunakan **Prompt 1** pada Bagian 20.3; minta implementasi milestone satu per satu.
5. Setelah Milestone 1, minta agent menurunkan `docs/DESIGN.md` dari Bagian 13 dan `docs/ARCHITECTURE.md` dari Bagian 9–11. Jangan menciptakan desain alternatif yang bertentangan.
6. Masukkan Supabase/Gemini credentials sendiri di environment lokal/deployment melalui secret manager; tidak perlu membagikan secrets dalam chat.
7. Jalankan tests dan visual review pada tiap milestone. P0 vertical slice menjadi **release candidate** sebelum P1.
8. Simpan daftar apa yang sudah/belum selesai, jangan menandai seluruh PRD completed hanya karena tampilan sudah dibuat.

### Implementation progress tracking (agent fills during implementation)

| Milestone | Status | Date | Evidence (commit/tests/screenshot) |
|---|---|---|---|
| M1 Foundation + UI tokens | Not started | — | — |
| M2 Auth/DB/RLS | Not started | — | — |
| M3 Reports + Gemini | Not started | — | — |
| M4 Verification + ActionLoop | Not started | — | — |
| M5 Analytics/Map/PSN | Not started | — | — |
| M6 Security/UX/Submission | Not started | — | — |

---

## 25. SOURCE REGISTER / CITATION LINKS

**Produk, panduan, dan risiko:**

1. WHO Indonesia, 30 March 2026: https://www.who.int/indonesia/id/news-room/item/30-03-2026-shaping-indonesia-s-path-towards-zero-dengue-deaths-by-2030
2. Kemenkes JDIH, Surat Edaran HK.02.02/C/861/2026 (18 Feb 2026): https://jdih.kemkes.go.id/documents/surat-edaran-direktur-jenderal-penanggulangan-penyakit-nomor-hk0202c8612026
3. WHO dengue fact sheet: https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue
4. UN SDG 3: https://sdgs.un.org/goals/goal3
5. User-supplied INVOFEST Web Design Guidebook 2026 (attached PDF; not a public verified URL).
6. User-supplied SILANTIK Pitch Deck (attached PDF; conceptual comparison, not a public verified URL).
7. User-supplied ExCellera and AksesKelas proposals (attached PDFs; benchmark approach only).

**Design and engineering:**

8. Taste Skill: https://github.com/leonxlnx/taste-skill
9. UI UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
10. Awesome Claude Design: https://github.com/VoltAgent/awesome-claude-design
11. Design Motion Principles: https://github.com/kylezantos/design-motion-principles
12. Skiper UI: https://skiper-ui.com
13. Nielsen Norman Group usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
14. WCAG 2.2: https://www.w3.org/TR/WCAG22/
15. USWDS color: https://designsystem.digital.gov/design-tokens/color/overview/
16. Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
17. Supabase SSR and session handling: https://supabase.com/docs/guides/auth/server-side/creating-a-client?environment=route-handler&framework=nextjs
18. Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
19. Gemini image understanding: https://ai.google.dev/gemini-api/docs/image-understanding
20. Gemini structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
21. MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/
22. OWASP validation: https://devguide.owasp.org/en/04-design/02-web-app-checklist/05-validate-inputs/
23. OWASP file upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

---

## 26. CLOSING PRODUCT PRINCIPLE

**DengueWatch bukan “AI yang mengetahui daerah berbahaya”.** DengueWatch adalah aplikasi komunitas yang membantu **manusia** menemukan potensi masalah lingkungan, memverifikasi informasi, mengambil tindakan, dan memastikan penanganan tercatat. **Gemini membantu menyusun informasi; kader memutuskan; sistem menjaga data dan status; UI memudahkan warga mengambil tindakan.**

> **Build the smallest complete, secure, usable, and visually intentional end-to-end workflow first. No fake capabilities. No AI slop. No unsafe shortcuts.**
