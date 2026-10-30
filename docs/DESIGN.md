# Kontrak Desain M1–M2

Dokumen ini merangkum aturan visual PRD tanpa membuat spesifikasi alternatif.

## Arah visual

Functional minimalism untuk HealthTech komunitas: informasi dan aksi lebih penting daripada
dekorasi. Permukaan netral, satu aksen teal, border halus, tanpa gradient, glow,
glassmorphism, neumorphism, kartu KPI warna-warni, emoji sebagai ikon, atau animasi dekoratif.

## Token terkunci

| Token            | Nilai     |
| ---------------- | --------- |
| Background       | `#F7F9F8` |
| Surface          | `#FFFFFF` |
| Foreground       | `#162826` |
| Primary          | `#0F766E` |
| Primary subtle   | `#E6F5F0` |
| Muted foreground | `#596D67` |
| Border           | `#DDE5E2` |
| Danger           | `#B42318` |
| Danger subtle    | `#FFF3F1` |

Implementasi single-source berada di `src/styles/tokens.css`. Font Plus Jakarta Sans
disertakan secara self-hosted melalui package npm untuk menghindari ketergantungan jaringan
saat build.

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
