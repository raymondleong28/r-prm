# HANDOFF.md — R-PRM Architecture, Security & Go-Live Handoff Log

> **Branch:** `develop` (Sole code writer: Antigravity)
> **Owner:** Ray
> **Updated:** 25 Nov 2026

---

## 1. Summary of Completed Security, Engine & Go-Live Slices

| Item | Requirement | Implementation & Verification |
|---|---|---|
| **S1 & F3** | Remove all secret fallbacks (`SESSION_SECRET`, `BANK_ENCRYPTION_KEY`, `APP_BASE_URL` required in production) | Implemented in `src/lib/config.ts`. Refuses to start (`FAIL_CLOSED`) if `SESSION_SECRET` or `BANK_ENCRYPTION_KEY` is missing or `< 32` bytes, or if `APP_BASE_URL` is missing when `NODE_ENV=production`. `.env.example` contains safe placeholders only. Zero secret/password literals in `src/`. |
| **S2** | Real Logout (`POST /api/auth {action:"logout"}`) | Wired in both `src/components/AppShell.tsx` (Admin) and `src/app/p/page.tsx` (Partner Portal). Clears cookie, revokes the server-side `Session` row (`revokedAt`), and redirects to `/login` (or `/p/login`), after which `GET /api/partners` returns `401`. |
| **S3** | Server-side `Session` table | Added `Session` model (`id`, `userId`, `impersonatingPartnerId`, `createdAt`, `expiresAt`, `revokedAt`) in `prisma/schema.prisma`. Cookie `rprm_session` holds only `<sessionId>.<identityType>.<hmacSig>`. Checked on every request via `getActiveServerSession` in `src/lib/authSession.ts`. |
| **S4 & G3** | Private authenticated file upload & download | `src/app/api/upload/route.ts` requires a valid session (`401` if logged out), enforces a 15 MB size limit and extension allowlist (`ALLOWED_UPLOAD_EXTENSIONS` — rejects `.html`), writes to `storage/uploads/` outside `public/`, and serves files only through authenticated `src/app/api/files/[key]/route.ts` (`401` when logged out). |
| **S5, S6, S7 & G10** | Real `User` table, per-user random salt scrypt hashes, exact email match, opt-in demo seed | Added `User` model in `prisma/schema.prisma`. Passwords hashed with per-user random 16-byte salt (`scrypt:<saltHex>:<keyHex>`). Demo seed (`npm run demo:seed`) reads `SEED_ADMIN_PASSWORD` and `SEED_PARTNER_PASSWORD` from `.env` and refuses to run when `NODE_ENV=production` or when non-demo data exists. Exact lookup via `prisma.user.findUnique({ where: { email } })`. |
| **S8** | Encrypt `Partner.bankDetailsJson` at rest | Encrypted on every write (`enc:v1:<iv>:<tag>:<ciphertext>` AES-256-GCM) in `src/lib/connectors.ts`. Decrypted only on single-partner reads (`GET /api/partners?id=...`) for authorized roles. |
| **S9 & G5** | Single-use hashed `ActivationToken` & `/p/activate` | Accepting a partner application or inviting a partner contact generates a 32-byte token, stores its SHA-256 hash in `ActivationToken`, and emails `${APP_BASE_URL}/p/activate?token=...`. Invitee sets their password at `src/app/p/activate/page.tsx`; token is marked `usedAt` and cannot be reused. |
| **S10** | Patched Next.js 14.2.x | Running Next.js `14.2.35`. |
| **S11** | Escape HTML in emails | `renderEscapedEmailHtml` in `src/lib/connectors.ts` HTML-escapes all interpolated subjects, bodies, and merge fields (`<script>` becomes `&lt;script&gt;`). |
| **S12** | Never store SMTP password in `AppSetting` | Removed `smtp_config` from database settings and rejected `SAVE_SETTING` for `smtp_config` (`400`). Manage → Email setup displays read-only environment connector status and sends test emails. |
| **S13 & F7** | Database-backed rate limit & lockout on auth and public forms | `checkRateLimitKey` and `recordAuthFailure` in `src/lib/authSession.ts` persist login lockout counters in PostgreSQL so lockouts (`HTTP 429`) survive server restarts. |
| **F1** | Enforced TOTP MFA & zero secret fallbacks | Removed fallback authenticator secrets; enforces MFA when required by workspace policy (`requireMfaCoworkers` / `requireMfaPartners`), including enrolment on first login when required. |
| **F2** | Non-derivable rotatable partner lead-form tokens | Random per-partner lead-form token generated and stored hashed (`leadFormTokenHash`), rotatable by an administrator; not derivable from `partnerId`. |
| **F4** | Always-on test-account blocking in production | `@*.example.com` test accounts are unconditionally refused login when `NODE_ENV=production` with no opt-in flag. |
| **F5 & G2** | Fail-closed unimplemented drivers | Selecting unimplemented drivers (`STORAGE_DRIVER=s3`, `PAYOUT_DRIVER=wise|stripe`, `HUBSPOT_DRIVER=live`, `SSO_DRIVER=saml`, `FX_DRIVER=api`) fails closed (`FAIL_CLOSED`) at startup. |
| **F6** | Integer minor units for money | All monetary columns across deals, transactions, rewards, payouts, and business plans are stored as `Int` minor units (cents) with currency codes. |
| **F8** | Explicit program-to-pipeline assignment | Onboarding pipeline is resolved strictly from explicit program assignment (`onboardingPipelineId`); missing program or unmapped program returns an error instead of guessing by name or defaulting to the first program. |
| **F9** | Clean typecheck & fixture suite (`tests/fixtures.test.ts`) | All tests and application files pass `npm run typecheck`, `npm test`, and `npm run build` from a fresh working copy. |
| **G4 & §3.2** | Empty database baseline & first-run `/setup` | `npx prisma migrate deploy` creates an empty database schema with zero users or demo records. When no admin exists, routes redirect to `/setup` (protected by `SETUP_TOKEN` in production). |
| **G6 & G7** | Headless scheduler & health endpoint | `POST /api/scheduler` accepts `Authorization: Bearer $CRON_SECRET`; `GET /api/health` checks secrets, PostgreSQL connectivity, applied migrations, and connector drivers. |
| **§3.5** | No demo or organisation values in code or schema | Added migration `0003_remove_demo_defaults_and_amount_base` renaming `*Sgd` columns to `*Base` (`amountBase`, `revenuesBase`, `targetRevBase`), adding `ownerId` / `assignedToId` foreign keys, and dropping demo/organisation `@default(...)` values in `prisma/schema.prisma`. Replaced fixed lead-to-deal amounts with `LeadConvertModal` requiring positive amount and defaulting currency to workspace `mainCurrency`; filtered `"My ..."` views on `session.userId`; updated scheduler Day-7 task assignment to use workspace `defaultOwnerName` or flag `[UNASSIGNED]` without falling back to demo names; removed fallback IDs (`prt-1`, `prog-strategic`) in favour of honest `not_found` states; wired admin notification bell to real `AuditLog` events; computed dashboard 12-month chart dynamically in workspace timezone; displayed real user MFA enrolment status without exposing secrets outside enrolment; moved invoice issuer, consent text, email merge tags (`{{workspace.name}}`), and editable `commission_templates` into workspace data/settings; verified §3.5 grep checks, 60 KB file size ceiling, `typecheck`, 32 fixtures, `build`, and `verify-fresh-clone.sh`. |

---

## Round 1 report (§3.6) — 28 Nov 2026, writer: Claude

| Item | Check | Result |
|---|---|---|
| Test safety lock | `DATABASE_URL=.../rprm npx tsx tests/fixtures.test.ts` | Refused, exit 2 |
| Two-step login | Fixture 11 (RFC 6238 vectors T=59, 1111111109, 1234567890, 2000000000) and Fixture 33 (sign-in setup, refresh, encryption, recovery codes, optional MFA, legacy secrets) | Pass |
| Two-step login in a browser | Production build, Playwright: QR + setup key shown; refresh shows same key; code computed from the key confirms; 8 recovery codes shown once; recovery code signs in once; Security tab shows "On" | Pass |
| Prospection settings | Fixture 34; browser: added a "Qualified" column, ticked Country, unticked Owner, saved, board shows 4 columns and new card fields | Pass |
| CSV export | Fixture 34 (formula escaping, hidden internal columns); browser download from Prospection | Pass; no bank/token/hash/JSON columns |
| Data sources Creation date | Browser | Column present |
| Typecheck / tests / build | `tsc --noEmit`; all 34 fixtures on PostgreSQL 16; `next build` | Pass |

Not verified on Ray's Mac yet: `./scripts/verify-fresh-clone.sh` (needs his PostgreSQL). Not verified with a physical phone authenticator app (standard algorithm and RFC vectors pass).

Judgement calls:
- Old non-standard MFA secrets are treated as "not set up" in code; no data is deleted by migration 0004.
- Recovery codes are only issued once setup is confirmed with an authenticator code.
- Moving a partner between prospection columns no longer changes its status (the reference product keeps them separate).
- `Partner.partnerType` default changed from "Reseller" to empty for new rows; existing rows unchanged.

New dependency: `qrcode` (renders the authenticator QR code).
