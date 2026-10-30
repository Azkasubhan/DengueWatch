# Model Keamanan M1–M2

## Trust boundaries

Browser tidak dipercaya. FormData, query, callback `next`, metadata pendaftaran, role, dan
area ID harus dianggap dapat dipalsukan. Identity berasal dari Supabase Auth; role dan
membership berasal dari database.

## Defense in depth

| Lapisan         | Kontrol                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| UI              | Tidak ada pemilih role; navigasi hanya sesuai portal                    |
| Server Action   | Zod strict, error generik, safe redirect, tidak mencatat password/token |
| DAL             | `server-only`, `getClaims()`, DTO minimal profile/membership            |
| Route           | Role + membership type + `verified_at`; private content no-store        |
| Database grants | Authenticated hanya select sendiri dan update kolom `display_name`      |
| Trigger         | Role-membership harus cocok; perubahan role user biasa ditolak          |
| RLS             | Own row; area memerlukan role + tipe membership + verifikasi yang cocok |
| Seed            | Secret server-only, placeholder ditolak, production disabled            |

## Role dan membership

- Registrasi publik memicu profile dengan role default `resident`.
- `authenticated` tidak memiliki privilege UPDATE pada `profiles.role`; trigger juga
  menolak perubahan oleh `anon`/`authenticated` jika grant kelak melebar.
- User tidak memiliki INSERT/UPDATE/DELETE pada `area_memberships`.
- Trigger membership menolak tipe membership yang tidak sesuai dengan role profile.
- Cadre memerlukan role `cadre` dan membership `assigned_cadre` terverifikasi.
- Manager memerlukan role `manager` dan membership `manager` terverifikasi; role ini tidak
  memperoleh kewenangan kader.
- Policy area memakai function `SECURITY DEFINER` di schema `private`, `search_path=''`,
  nama relation schema-qualified, dan EXECUTE hanya untuk `authenticated`.

## Auth flow

- Login error tidak membedakan email tidak terdaftar dan password salah.
- Forgot-password selalu memberi respons yang sama untuk mencegah enumerasi akun.
- Callback memakai PKCE code exchange dan hanya menerima redirect lokal satu-origin.
- Proxy memanggil `getClaims()` untuk refresh/verification, tetapi protected page tetap
  melakukan authorization server-side.
- Logout membatalkan session melalui Supabase dan kembali ke halaman publik.

## Grants dan RLS tests

`supabase/tests/rls.sql` mendefinisikan 53 assertion untuk memeriksa:

- grants, RLS aktif dan dipaksa, serta batas EXECUTE function private;
- resident hanya membaca row sendiri dan tidak mendapat akses lintas-area;
- kader A/B hanya mengakses area tugasnya masing-masing;
- manager mengakses area kelola tetapi tidak memperoleh otoritas kader;
- membership belum diverifikasi tidak memberi akses operasional;
- perubahan role, pembuatan membership, dan self-verification tetap ditolak saat grant
  berbahaya disimulasikan sementara di dalam transaksi test;
- function `SECURITY DEFINER` menggunakan `search_path` kosong.
- `service_role` hanya memperoleh operasi tabel yang diperlukan seed dan tidak memperoleh
  `DELETE`.

Pada 30 Oktober 2026, suite ini dieksekusi terhadap PostgreSQL lokal setelah clean reset:
53/53 assertion lulus. Verifier live tambahan menjalankan 13 check dengan Auth/JWT/RLS
nyata, termasuk refresh token dan recovery PKCE melalui Mailpit. Browser live menjalankan
3/3 flow melalui Server Actions dan cookie SSR.

## Keterbatasan saat ini

- Rate limit Auth lokal dicatat eksplisit di `supabase/config.toml`. Konfigurasi hosted
  project tetap harus diperiksa di dashboard sebelum exposure publik; aplikasi belum
  menambahkan distributed rate limiter sendiri.
- Content Security Policy berbasis nonce belum diterapkan. Header `nosniff`, frame deny,
  referrer policy, dan permissions policy sudah aktif; CSP perlu diuji bersama deployment.
- Password minimum aplikasi dan Supabase lokal adalah 8 karakter. Password policy hosted
  harus diperiksa kembali saat deployment project dibuat.
- Belum ada media/upload pada M1–M2, sehingga secure media pipeline PRD belum relevan dan
  belum diimplementasikan.
