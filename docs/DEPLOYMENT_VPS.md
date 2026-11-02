# Deployment VPS Staging — DengueWatch (T22)

Target: Ubuntu 24.04, 2 vCPU / 4 GB, satu instance Next.js di belakang Nginx, Supabase Cloud
(PostgreSQL, Auth, Storage, RLS), dan Gemini API eksternal. Dokumen ini berisi contoh
konfigurasi dan runbook. Belum ada server, project cloud, atau database yang diubah. Ganti
`dw.example.id` dan `<ref>` dengan domain dan project ref sebenarnya.

```
Internet ──443/80──▶ Nginx (TLS, 8 MiB body) ──▶ 127.0.0.1:3000 next start (denguewatch)
                                                   ├─▶ Supabase Cloud (HTTPS)
                                                   └─▶ Gemini API (HTTPS, server-only)
systemd timers (DynamicUser) ──▶ scripts/cleanup-*.mjs ──▶ Supabase Cloud
```

**Gate persetujuan.** Langkah bertanda ⛔ (push Git, `db push`, seed, perubahan cloud/VPS)
hanya dijalankan setelah persetujuan eksplisit.

## 1. Model kepercayaan origin

- `next start` membentuk `request.url` dari alamat bind (`localhost:3000`), bukan dari
  domain publik.
- Di production, `appOrigin()`/`requestOrigin()` memakai `APP_BASE_URL` sebagai origin
  kanonik. Nilainya wajib `https://`; `http://` hanya diterima untuk `localhost`/`127.0.0.1`.
  `Host`, `X-Forwarded-*`, dan `Forwarded` yang di-spoof tidak berpengaruh.
- Tanpa `APP_BASE_URL` yang valid, sistem fail-closed: mutation ditolak (403), daftar dan
  pemulihan kata sandi menampilkan "Layanan akun belum dikonfigurasi" (link email tidak
  pernah mengarah ke localhost), dan callback Auth memakai redirect relatif. Bila valid,
  callback selalu redirect ke origin kanonik.
- Header dari proxy tetap wajib, karena Server Actions Next.js (login/daftar) membandingkan
  `Origin` dengan `X-Forwarded-Host`/`Host`. Nginx menimpa header tersebut. Node hanya
  bind ke `127.0.0.1`, dan `server_name` default menolak host lain.
- Bukti lokal (build production): origin valid → 401 (lolos origin); Host, origin, dan
  `Forwarded` di-spoof → 403; tanpa header `Origin` → 403; tanpa `APP_BASE_URL` → 403;
  callback di-spoof → `https://dw.example.test/...`.

## 2. Pengguna, file, dan izin

| Path / user                       | Pemilik         | Mode | Isi                                        |
| --------------------------------- | --------------- | ---- | ------------------------------------------ |
| user `dwdeploy`                   | —               | —    | clone, install, build; pemilik `releases/` |
| user `denguewatch` (nologin)      | —               | —    | runtime; kode read-only                    |
| `/srv/denguewatch/releases/<sha>` | `dwdeploy`      | 755  | rilis; `.next/cache` milik `denguewatch`   |
| `/srv/denguewatch/current`        | symlink         | —    | rilis aktif                                |
| `/etc/denguewatch/build.env`      | `root:dwdeploy` | 0640 | hanya `NEXT_PUBLIC_*` (tanpa secret)       |
| `/etc/denguewatch/app.env`        | `root:root`     | 0600 | runtime, dibaca systemd sebelum turun hak  |
| `/etc/denguewatch/cleanup.env`    | `root:root`     | 0600 | khusus timer cleanup                       |

Build terbukti lulus hanya dengan `NEXT_PUBLIC_SUPABASE_URL` dan
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, tanpa `.env.local` atau secret (puncak RSS sekitar
0,9 GB di macOS).

`app.env`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable>
APP_BASE_URL=https://dw.example.id
SUPABASE_SECRET_KEY=<secret>
GEMINI_API_KEY=<key>
GEMINI_MODEL=<model>
AI_REQUEST_TIMEOUT_MS=30000
```

`cleanup.env`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=<secret>
ALLOW_HOSTED_CLEANUP=true
CLEANUP_PROJECT_REF=<ref>
```

Jangan simpan `ALLOW_DEMO_SEED`, `DEMO_ACCOUNT_PASSWORD`, atau flag cleanup di `app.env`.

## 3. `denguewatch.service`

```ini
[Unit]
Description=DengueWatch Next.js (staging)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=denguewatch
Group=denguewatch
WorkingDirectory=/srv/denguewatch/current
EnvironmentFile=/etc/denguewatch/app.env
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=NODE_OPTIONS=--max-old-space-size=1024
Environment=MALLOC_ARENA_MAX=2
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
MemoryHigh=1280M
MemoryMax=1536M
TasksMax=256
NoNewPrivileges=true
CapabilityBoundingSet=
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictSUIDSGID=true
LockPersonality=true
ReadWritePaths=-/srv/denguewatch/current/.next/cache

[Install]
WantedBy=multi-user.target
```

- Next.js dijalankan langsung lewat `node`, tidak melalui shim `pnpm`/`.bin`.
- Bind ke `127.0.0.1` ditetapkan di `ExecStart`.
- Kalau gagal start 5 kali dalam 5 menit, systemd berhenti mencoba agar tidak crash-loop.
- `MALLOC_ARENA_MAX=2` menekan fragmentasi RSS akibat `sharp`.
- Ukuran idle sekitar 130 MB RSS.

## 4. Nginx

```nginx
limit_req_zone $binary_remote_addr zone=dw_api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=dw_upload:10m rate=20r/m;
server_tokens off;

server {
    listen 80 default_server;
    listen 443 ssl default_server;
    ssl_reject_handshake on;
    return 444;
}

server {
    listen 80;
    server_name dw.example.id;
    return 301 https://dw.example.id$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name dw.example.id;
    # ssl_certificate / ssl_certificate_key diisi certbot.

    add_header Strict-Transport-Security "max-age=31536000" always;
    client_max_body_size 8m;          # foto 5 MiB + multipart; aplikasi menolak > 6 MiB
    client_body_timeout 30s;
    proxy_request_buffering on;       # Node menerima body utuh, bukan upload lambat

    # Ditetapkan oleh proxy tepercaya; nilai dari klien selalu ditimpa.
    proxy_http_version 1.1;
    proxy_set_header Host dw.example.id;
    proxy_set_header X-Forwarded-Host dw.example.id;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Forwarded "";
    proxy_read_timeout 60s;           # di atas AI_REQUEST_TIMEOUT_MS

    location / {
        proxy_pass http://127.0.0.1:3000;
    }
    location /api/ {
        limit_req zone=dw_api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }
    location ~ ^/api/v1/(report-uploads|tasks/[^/]+/evidence-uploads)$ {
        limit_req zone=dw_upload burst=6 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }
}
```

`proxy_set_header` didefinisikan di level server dan diwarisi semua `location` karena tidak
ada `location` yang menimpanya. Validasi upload tidak berubah: signature, WebP, EXIF,
Storage privat, lease, kuota, role, dan area.

## 5. Timer cleanup

```ini
# /etc/systemd/system/dw-cleanup-uploads.service
[Unit]
Description=DengueWatch expired upload-lease cleanup
[Service]
Type=oneshot
DynamicUser=yes
WorkingDirectory=/srv/denguewatch/current
EnvironmentFile=/etc/denguewatch/cleanup.env
Environment=ALLOW_UPLOAD_CLEANUP=true
ExecStart=/usr/bin/node scripts/cleanup-report-uploads.mjs
RuntimeMaxSec=300
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
RestrictAddressFamilies=AF_INET AF_INET6

# /etc/systemd/system/dw-cleanup-uploads.timer
[Timer]
OnCalendar=hourly
RandomizedDelaySec=300
Persistent=true
[Install]
WantedBy=timers.target
```

`dw-cleanup-ai.service` dan `dw-cleanup-ai.timer` sama, dengan
`Environment=ALLOW_AI_CLEANUP=true`, `ExecStart=/usr/bin/node scripts/cleanup-ai-analyses.mjs`,
dan `OnCalendar=*-*-* 03:00:00 Asia/Jakarta`.

Pengaman:

- Run hosted wajib memenuhi tiga syarat: `ALLOW_HOSTED_CLEANUP=true`, `CLEANUP_PROJECT_REF`
  20 karakter, dan URL tepat `https://<ref>.supabase.co`. Lookalike seperti
  `<ref>.supabase.co.evil.test` ditolak sebelum ada koneksi jaringan.
- `CLEANUP_DRY_RUN=true` hanya menghitung baris tanpa menghapus.
- Setiap run maksimal 100 baris.
- `DynamicUser` memisahkan proses cleanup dari user aplikasi.
- Tidak ada endpoint HTTP baru dan tidak ada perubahan grant.

## 6. Bootstrap Supabase staging dari project kosong (mesin admin)

```bash
supabase login
supabase link --project-ref <ref>                    # minta password database
supabase migration list                              # Local 001–006, Remote kosong
supabase db push --dry-run                           # tinjau: 6 migration, tanpa seed
# ⛔ minta persetujuan, lalu:
supabase db push
supabase migration list                              # Local = Remote = 6
```

Verifikasi lewat SQL Editor atau `psql` (read-only):

```sql
-- Semua tabel public: rls = true dan force = true
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1;
-- report-photos | public = false | 5242880 | {image/webp}
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
-- Tidak ada INSERT/UPDATE/DELETE langsung untuk anon/authenticated (mutation lewat RPC)
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
```

Pemeriksaan HTTP:

- `GET <url>/rest/v1/reports?select=id` dengan publishable key tanpa sesi harus kosong atau
  ditolak.
- `GET <url>/storage/v1/object/public/report-photos/x` tidak boleh 200.

Opsional ⛔: pgTAP (`supabase/tests/*.sql`, setiap file berakhir `rollback`) bisa dijalankan
ke staging kosong. Cek flag lebih dulu dengan `supabase test db --help`.

Lalu atur Auth:

- Site URL: `https://dw.example.id`.
- Redirect URLs: `https://dw.example.id/auth/callback**`.
- Password minimal 8.
- SMTP kustom, atau samakan pengaturan konfirmasi email dengan lokal.

⛔ Seed akun demo dari mesin admin:

```bash
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… ALLOW_DEMO_SEED=true DEMO_ACCOUNT_PASSWORD=… node scripts/seed-demo.mjs
```

## 7. Bootstrap VPS dan rilis

```bash
# root
apt update && apt -y upgrade && apt -y install nginx certbot python3-certbot-nginx ufw git
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt -y install nodejs && corepack enable
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
ufw default deny incoming && ufw allow from <ip-admin> to any port 22 proto tcp
ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
useradd --system --create-home --home-dir /home/dwdeploy --shell /bin/bash dwdeploy
useradd --system --no-create-home --shell /usr/sbin/nologin denguewatch
install -d -o dwdeploy -g dwdeploy /srv/denguewatch/releases
install -d -m 0755 /etc/denguewatch   # isi ketiga env file sesuai bagian 2

# dwdeploy (⛔ butuh commit lokal sudah di-push; main saat ini ahead 4)
SHA=<commit>; R=/srv/denguewatch/releases/$SHA
git clone <repo> "$R" && git -C "$R" checkout --detach "$SHA"
cd "$R" && pnpm install --frozen-lockfile
set -a && . /etc/denguewatch/build.env && set +a
NODE_OPTIONS=--max-old-space-size=2048 pnpm build

# root
install -d "$R/.next/cache" && chown -R denguewatch:denguewatch "$R/.next/cache"
ln -sfn "$R" /srv/denguewatch/current
systemctl daemon-reload && systemctl enable --now denguewatch
nginx -t && systemctl reload nginx && certbot --nginx -d dw.example.id
systemctl start dw-cleanup-uploads.service dw-cleanup-ai.service   # uji sekali
systemctl enable --now dw-cleanup-uploads.timer dw-cleanup-ai.timer
```

Sebelum menyalakan timer, uji dulu dengan dry run:
`systemd-run --wait -p EnvironmentFile=/etc/denguewatch/cleanup.env -p DynamicUser=yes -E ALLOW_UPLOAD_CLEANUP=true -E CLEANUP_DRY_RUN=true --working-directory=/srv/denguewatch/current /usr/bin/node scripts/cleanup-report-uploads.mjs`.

## 8. Backup dan rollback

- **Rollback aplikasi:**

  ```bash
  ln -sfn /srv/denguewatch/releases/<sha-lama> /srv/denguewatch/current
  systemctl restart denguewatch
  ```

  Simpan 3 rilis terakhir.

- **Symlink bukan rollback database.** Migration bersifat forward-only. Rilis lama hanya
  aman bila migration baru bersifat aditif. Urutan rilis: migration (aditif) lebih dulu, lalu
  aplikasi.
- **Database:** jangan reset, `migration repair`, atau hapus migration remote. Perbaikan
  dilakukan dengan migration baru yang sudah diuji lokal.
- **Backup:** sebelum setiap `db push` setelah data ada, jalankan
  `pg_dump "<db-url>" -Fc -f dw-staging-<tanggal>.dump` dari mesin admin. Versi `pg_dump` harus
  ≥ versi server. Periksa plan Supabase: backup otomatis/PITR tidak tersedia di free tier.
  Objek Storage tidak ikut `pg_dump`.
- **Staging kosong:** kalau bootstrap gagal, jalan pulih tercepat adalah membuat project baru,
  bukan memperbaiki skema secara manual.

## 9. Checklist smoke test live

| #   | Skenario                                                              | Harapan                                             |
| --- | --------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Login 4 akun demo, logout                                             | masuk portal sesuai role                            |
| 2   | Daftar warga, pemulihan kata sandi (bila SMTP aktif)                  | link email ke `https://dw.example.id/auth/callback` |
| 3   | `curl -X POST /api/v1/reports -H 'Origin: https://evil.test'`         | 403                                                 |
| 4   | Sama, dengan `-H 'Host: evil.test' -H 'X-Forwarded-Host: evil.test'`  | 444 (Nginx) atau 403                                |
| 5   | Warga: laporan dengan foto JPG 4,8–5 MiB                              | sukses; foto WebP privat; URL publik ≠ 200          |
| 6   | Foto > 5 MiB, dan file PDF berganti nama `.jpg`                       | 413 / `INVALID_IMAGE`, isian form tetap             |
| 7   | Saran Gemini pada laporan                                             | saran dapat diedit; bila gagal, form manual jalan   |
| 8   | Kader Satu: verifikasi, buat task, mulai, unggah bukti ±5 MiB         | `in_action`, bukti menunggu pemeriksaan             |
| 9   | Kader Satu mencoba menyetujui buktinya sendiri                        | form tidak tampil; API 403                          |
| 10  | Kader Dua menyetujui                                                  | task `completed`, laporan `resolved`                |
| 11  | Pengelola: `/pengelola/ringkasan`                                     | KPI berubah, label DATA SIMULASI                    |
| 12  | Pengelola membuka `/kader/tugas`; warga memanggil `GET /api/v1/tasks` | `/forbidden`; 403                                   |
| 13  | Tanpa sesi: `GET /api/v1/reports`                                     | 401                                                 |
| 14  | `nmap -p- dw.example.id` dari luar                                    | hanya 80/443 (+22 dari IP admin)                    |

## 10. Pemeriksaan resource

```bash
free -m; uptime; df -h /; du -sh /srv/denguewatch/releases/*
systemctl show denguewatch -p MemoryCurrent -p MemoryPeak -p NRestarts
systemd-cgtop -1 -n 1
journalctl -u denguewatch -p warning --since -1h
journalctl -u 'dw-cleanup-*' --since -1d
tail -n 50 /var/log/nginx/error.log
ss -tlnp     # 3000 hanya di 127.0.0.1
```

- **Dua upload bersamaan:** dua sesi mengunggah foto ±5 MiB secara serentak sambil memantau
  `MemoryPeak` dan `top`. Harapan: kedua respons sukses, tanpa 502/413, `MemoryPeak` di bawah
  1,2 GB, `NRestarts` tetap 0.
- Batasi journald (`SystemMaxUse=500M`). Pertahankan disk bebas di atas 20%.

## 11. Keterbatasan terbuka

- SMTP kustom belum dikonfigurasi.
- Seed laporan demo 20–30 laporan beserta task (PRD FR-90) belum ada; `seed-report-demo`
  hanya untuk localhost dan membuat 3 laporan.
- Zoom native 200% dan Safari (iOS/macOS) belum diuji.
- Retensi hosted baru berupa rencana timer; belum berjalan di server.
- Fresh bootstrap migration 001–006 ke project kosong belum diverifikasi.
- Satu instance tanpa failover; `maxDuration` tidak berlaku di VPS (batas AI lewat
  `AI_REQUEST_TIMEOUT_MS`).
