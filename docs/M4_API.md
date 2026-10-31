# Kontrak API M4 — Gemini SmartSpot

## POST `/api/v1/ai/analyze-report`

Hanya untuk resident yang login dan memiliki membership area terverifikasi. Header
`Origin` harus sama dengan origin aplikasi; body JSON maksimal 2 KiB:

```json
{ "areaId": "uuid-area", "uploadId": "uuid-foto-M3" }
```

`uploadId` berasal dari `POST /api/v1/report-uploads`. Browser tidak boleh mengirim
Storage path, URL publik, image bytes, role, koordinat, atau identitas pengguna. Foto
harus milik peminta, WebP ternormalisasi, belum kedaluwarsa/terpakai, dan objeknya ada.
Satu permintaan menganalisis satu foto. Kode `200`:

```json
{
  "data": {
    "analysisId": "uuid-analisis",
    "suggestion": {
      "visibleObjects": ["wadah air terbuka"],
      "suggestedCategory": "water_container",
      "draftDescription": "Foto tampak menunjukkan wadah yang berisi air.",
      "suggestedPrecaution": "Periksa dan kosongkan genangan bila aman.",
      "requiresHumanVerification": true,
      "limitations": "Foto tidak dapat memastikan adanya jentik."
    }
  }
}
```

Kategori mengikuti enum M3. Semua field wajib; objek/teks dibatasi dan unknown key
ditolak. Hasil hanya saran, tidak dikirim otomatis sebagai report. `analysisId` tidak
memberi izin mengubah status report atau isi final.

## Kode kegagalan

| HTTP | Code                                 | Makna                                         |
| ---- | ------------------------------------ | --------------------------------------------- |
| 400  | `MALFORMED_BODY`                     | JSON tidak valid                              |
| 401  | `UNAUTHENTICATED`                    | Tidak ada session                             |
| 403  | `FORBIDDEN`                          | Origin, role, atau area ditolak               |
| 404  | `NOT_FOUND`                          | Foto tidak ada, milik akun lain, atau expired |
| 409  | `CONCURRENT_REQUEST`                 | Satu analisis masih aktif                     |
| 413  | `BODY_TOO_LARGE`                     | Payload terlalu besar                         |
| 415  | `UNSUPPORTED_MEDIA_TYPE`             | Bukan JSON                                    |
| 422  | `VALIDATION_ERROR` / `INVALID_IMAGE` | Schema input atau foto ditolak                |
| 429  | `RATE_LIMIT`                         | Batas AI lokal/proyek tercapai                |
| 502  | `AI_INVALID_OUTPUT`                  | JSON model/safety gagal validasi              |
| 503  | `AI_UNAVAILABLE` / `AI_TIMEOUT`      | Konfigurasi atau provider gagal               |

Respons error mengikuti envelope M3 (`error.code`, `error.message`, `error.requestId`),
tanpa detail provider atau secret. `Cache-Control: private, no-store` berlaku untuk semua
respons. Kuota 10 permintaan/jam, 30/hari, satu aktif per resident, terpisah dari kuota
laporan dan upload. Satu provider call boleh mencoba ulang maksimal sekali untuk 429/5xx.
Timeout default 15 detik berlaku per percobaan (maksimal 30 detik plus backoff singkat).
Pembatalan browser diteruskan sebagai `AbortSignal` ke SDK bila request server masih aktif;
menurut SDK, pembatalan client tidak menjamin provider menghentikan pemrosesan atau biaya.
