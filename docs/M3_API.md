# Kontrak HTTP Environmental Reports M3

Semua endpoint menggunakan session Supabase Auth dan mengembalikan JSON dengan
`Cache-Control: private, no-store`. Write endpoint memerlukan header `Origin` yang sama
dengan origin aplikasi. Laporan dan foto tidak tersedia untuk anonymous.

## POST `/api/v1/report-uploads`

`multipart/form-data` dengan tepat satu field `photo`. Menerima JPEG, PNG, atau WebP
valid hingga 5 MiB; server memeriksa isi dan mengubahnya menjadi WebP tanpa metadata.
Resident harus memiliki area terverifikasi. Respons `201`:

```json
{
  "id": "uuid",
  "mimeType": "image/webp",
  "byteSize": 12345,
  "width": 800,
  "height": 600
}
```

`id` adalah referensi lease upload milik user yang berlaku satu jam, bukan storage path.
`DELETE /api/v1/report-uploads/:id` menghapus lease yang belum digunakan oleh pemilik.
Ledger server tetap menghitung reservasi yang sudah dihapus untuk batas 30 upload per jam.

## POST `/api/v1/reports`

Header: `Content-Type: application/json`, `Idempotency-Key: <8–128 alphanumeric/_/->`.
Body:

```json
{
  "areaId": "uuid",
  "category": "water_container",
  "description": "Wadah air terbuka terlihat di area bersama.",
  "imageUploadIds": ["uuid"],
  "location": {
    "latitude": null,
    "longitude": null,
    "note": "dekat saluran umum"
  }
}
```

`location` boleh `null`. Jika koordinat diberikan, keduanya harus finite dan dalam
rentang lintang −90..90 serta bujur −180..180. Kategori lain: `discarded_tire`,
`clogged_drain`, `discarded_item`, `other`. Respons `201`:

```json
{
  "data": {
    "id": "uuid",
    "public_reference": "DW-2026-000001",
    "status": "pending_verification",
    "submitted_at": "ISO-8601"
  }
}
```

Retry dengan key dan payload identik mengembalikan report yang sama. Key sama dengan
payload berbeda menghasilkan `409`. Area, ownership foto, expiry, dan batas rate diperiksa
lagi dalam RPC PostgreSQL user-scoped.

## GET `/api/v1/reports`

Query opsional: `page` (1..10000), `limit` (1..50), `category` (enum resmi). Respons
`200`: `{ "data": [...], "pagination": { "page": 1, "limit": 10, "total": 3 } }`.
Rows dibatasi oleh RLS: resident hanya miliknya, cadre/manager hanya area terverifikasi.

## GET `/api/v1/reports/:id`

UUID report. Respons `200` berisi `{ "data": { ...report, "images": [...],
"events": [...] } }`. Tiap `images[].url` adalah signed URL Storage dengan masa berlaku
60 detik, dibuat setelah report/image lolos RLS. Report yang tidak ada atau disembunyikan
RLS mengembalikan `404` yang sama. Status dan event hanya dibaca pada M3.

## Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Periksa kembali data yang diisi.",
    "fieldErrors": {},
    "requestId": "uuid"
  }
}
```

Kode yang dipakai: `401` session tidak ada, `403` role/area/origin ditolak, `404`
resource tersembunyi/tidak ada, `409` upload/key bentrok, `413` body/foto terlalu besar,
`415` media type salah, `422` validasi, `429` batas laju, `503` layanan gagal. Detail
database/Storage internal tidak dikirim ke browser.
