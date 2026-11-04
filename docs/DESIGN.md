# Kontrak Desain DengueWatch

Dokumen ini merangkum aturan visual PRD tanpa membuat spesifikasi alternatif. Diperbarui
dengan T23 (landing) dan T24 (sistem desain aplikasi).

## Arah visual

Satu brand, dua kepadatan:

- **Halaman publik** (landing, kebijakan, auth) ekspresif: foto dokumenter permukiman,
  tipografi besar, ritme editorial, tombol pill.
- **Halaman aplikasi** tenang dan padat: fokus pada tugas, tanpa foto dekoratif. Foto muncul
  hanya jika memang isi (foto laporan dan bukti).

Palet natural hangat dengan satu warna aksi teal. Tanpa glow, glassmorphism, neumorphism,
kartu KPI warna-warni, emoji sebagai ikon, label kecil di atas setiap judul, atau animasi
dekoratif. Gradien hanya dipakai sebagai lapisan gelap di atas foto untuk menjaga kontras.
Satu pengecualian kaca: navbar publik melayang (`SiteHeader`, kelas `.glass-nav`) dengan
latar tembus pandang dan blur; jatuh ke latar padat bila transparansi dikurangi (T26).

## Token

Sumber tunggal: `src/styles/tokens.css`. Warna di TSX wajib lewat `var(--…)`; ESLint
menolak hex mentah di `src` (kecuali aset `BrandMark`).

| Token                               | Nilai                             | Pemakaian                            |
| ----------------------------------- | --------------------------------- | ------------------------------------ |
| `--background`                      | `#F3F0E8`                         | latar halaman                        |
| `--surface`                         | `#FBFAF6`                         | kartu, input                         |
| `--foreground`                      | `#17251F`                         | teks utama                           |
| `--muted-foreground`                | `#4F5D56`                         | teks sekunder                        |
| `--primary` / `--primary-hover`     | `#0F766E` / `#0B5F59`             | aksi utama, tautan                   |
| `--primary-subtle`                  | `#E2F1EA`                         | status berhasil                      |
| `--border`                          | `#DDD6C6`                         | pemisah dan kartu                    |
| `--control-border`                  | `#8B8473`                         | batas input (kontras non-teks ≥ 3:1) |
| `--sand`                            | `#E8E2D4`                         | permukaan sekunder, status netral    |
| `--forest` / `--forest-deep`        | `#1D3A2C` / `#13241B`             | blok gelap, status proses, footer    |
| `--clay`                            | `#974A26`                         | aksen kecil (ikon lokasi, label)     |
| `--mint`                            | `#9FE0D3`                         | aksen di atas foto atau latar gelap  |
| `--warning` / `--info` / `--danger` | `#7A4B00` / `#1F4E79` / `#B42318` | teks status, dengan varian `-subtle` |

Radius: kartu `1.25rem`, kontrol `0.75rem` (pill di `.landing`). Font Plus Jakarta Sans
self-hosted; ikon Lucide.

## Komponen inti

`src/components/ui`: `Button`, `LinkButton`, `PageHeader` (judul, deskripsi, meta, aksi,
tautan kembali), `StatusBadge` (satu pemetaan nada untuk status laporan dan tugas), `Card`,
`EmptyState` (apa ini, kenapa kosong, cara memulai). `src/components/feedback`: `Alert`,
`PendingArea`, `LoadingState`, `ServiceUnavailable`. Navigasi aplikasi: `AppShell` dan
`AppNav` (penanda halaman aktif dengan `aria-current`). Brand: `Brand` dan `BrandMark`.

## Komponen dan state

- Tombol memiliki default, hover, focus-visible, disabled, dan loading.
- Input selalu memiliki label permanen, helper/error terhubung melalui ARIA, serta state
  invalid.
- Feedback penting tetap inline; tidak hanya mengandalkan toast sementara.
- Focus ring terlihat dan motion non-esensial dihentikan oleh `prefers-reduced-motion`.
- Touch target kontrol utama minimal 44 px.

## Responsive

Page padding: 16 px mobile, 24 px tablet, 32 px desktop. Form maksimum 640 px dan page
container maksimum 1440 px. Pemeriksaan otomatis dan screenshot dilakukan pada 390, 768,
dan 1440 px. Layout tidak boleh memiliki horizontal overflow.

## Copy

Seluruh UI menggunakan Bahasa Indonesia yang singkat dan tidak menakut-nakuti. Data seed
ditandai simulasi; aplikasi tidak menyatakan diagnosis, prediksi wabah, data pasien, atau
afiliasi resmi.
