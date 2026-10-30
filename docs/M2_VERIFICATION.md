# M2 Verification Evidence

Tanggal verifikasi: 30 Oktober 2026. Target hanya Supabase lokal pada loopback melalui
OrbStack; repository tidak ditautkan ke project remote dan tidak ada operasi remote.

## Database dan RLS

```text
pnpm supabase:reset
  PASS — migration 001, 002, dan 003 diterapkan berurutan

pnpm test:db
  PASS — Files=1, Tests=53, Result: PASS
```

Matrix mencakup anonymous denial, own-row access, resident self-promotion/self-approval,
dua kader pada area berbeda, manager tanpa otoritas kader, unverified membership,
simulasi accidental grants, `FORCE RLS`, dan `SECURITY DEFINER` search path.

## Auth dan browser nyata

```text
pnpm test:auth:live
  PASS — 13/13 checks

pnpm test:e2e:live
  PASS — 3/3 browser tests
```

Verifier API menggunakan Supabase Auth dan JWT nyata untuk registration, profile trigger,
wrong/correct login, persisted session, refresh, logout, pending membership, anonymous
denial, cross-user/cross-area access, self-promotion, self-approval, manager approval denial,
Mailpit recovery email, PKCE exchange, dan login dengan password baru.

Browser live menggunakan Server Actions, SSR cookies, dan protected routes nyata untuk
registration, pending state, wrong/correct login, reload persistence, logout, serta portal
resident/cadre/manager.

## Regression

```text
pnpm format:check  PASS
pnpm lint          PASS
pnpm typecheck     PASS
pnpm test          PASS
pnpm build         PASS
pnpm test:e2e      PASS
pnpm audit --prod  PASS
```

Nilai credential tidak disimpan dalam dokumen atau output laporan. `.env.local` tetap
diabaikan Git.
