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

---

## Round 1b report (§3.6 no fake controls) — 28 Nov 2026, writer: Claude

| Item | Check | Result |
|---|---|---|
| List filters / paging / saved views | Fixture 35 (date ranges, operators, paging, saved-view validation); browser on Partners: filter Country is Singapore → "3 of 8 items", saved view survives reload, "Last 7 days" filter applies | Pass |
| API tokens | Fixture 35 (hash only, bearer auth, altered token rejected, token can't manage tokens, revoke); production server: `curl -H "Authorization: Bearer …" /api/partners` → 200 with 8 partners; random token → 401; no auth → 401 | Pass |
| Self-billed invoice PDF | Fixture 35 (409 when off, real PDF, other partner → 404); browser download; PDF text shows 2 reward lines, total SGD 3,780.00 = payout PO-2026-04 | Pass |
| Password change | Fixture 35 (wrong/short refused, new works, old fails, other sessions revoked, current kept) | Pass |
| Program rename | Fixture 35 (partners show new name, empty name refused) | Pass |
| Toast-only buttons | `grep -rn "onClick={() => showToast(" src` | None left |
| Typecheck / 35 fixtures / build | cloud PostgreSQL 16 harness | Pass |

Judgement calls:
- Saved views are workspace-wide (stored in setting `saved_views`), like shared views in the reference product.
- Payout detail now lists only rewards linked to that payout (it previously listed every reward of the partner).
- A token acts as the administrator who created it and stops working if that person is disabled or no longer an administrator.

New dependency: `pdf-lib` (generates the self-billed invoice PDF).

---

## Round R2a report (§3.6 reward engine) — 28 Nov 2026, writer: Claude

| Item | Check | Result |
|---|---|---|
| Live engine follows rule settings | Fixture 36: 28 monthly transactions through `CREATE_TRANSACTION` on a Premium-style rule → paid months 4–27 only; 20% in months 4 and 15, 10% in months 16 and 27 | Pass |
| Conditions | Fixture 36: 3rd–5th transaction rule pays 3, 4, 5; monthly-plan customer rule pays monthly customer, not yearly; running-total rule pays at the 10th transaction | Pass |
| Triggers | Fixture 36: deal won pays the deal rule once (closing twice doesn't duplicate) and transaction rules don't fire on the deal; lead accepted pays its gift card | Pass |
| No double-paying, numbering | Fixture 36: re-running the engine creates 0 rewards; reward numbers unique `RW-<n>` | Pass |
| Existing amounts unchanged | Fixtures 3a–3d, 7 (Apex SGD 7,125 + 1,425), 13, 30 | Pass |
| Browser | Recorded SGD 10,000 for Apex's customer in the Transactions form → linked to the customer; rewards RW-1042 SGD 2,500 and RW-1043 SGD 500 created | Pass |
| Typecheck / 36 fixtures / build | cloud PostgreSQL 16 harness | Pass |

Behaviour changes and judgement calls:
- Closing a deal no longer pays the "% of every transaction" rules on the deal amount (they pay on transactions). Only rules whose trigger is "deal closed won" pay on a won deal. Before, a won deal and its transactions could both pay.
- Demo data: the Platinum "5% Annual Milestone Kickback" rule paid 5% on every transaction, which didn't match its title. It's renamed "5% Platinum Bonus on Every Transaction" in the demo seed (amounts unchanged). Existing databases keep the old title until re-seeded.
- A transaction with no customer counts as month 1 and the 1st transaction.
- A cancelled customer stops earning from the month it cancelled; earlier transactions still count.
- Deal page "+ Record Transaction" was sending the deal amount in cents as if it were whole currency (100× too large); fixed.
- Migration 0006 backfills `Transaction.customerId` by exact customer name (case-insensitive); it doesn't delete anything.

---

## Round R3 report (§3.6 reward rule form) — 28 Nov 2026, writer: Claude

| Item | Check | Result |
|---|---|---|
| Editing never changes amounts | Fixture 37: 23 rules (3 templates, every seeded rule, 5 older formats incl. free text) × 183 events (3 transaction triggers × months 1–30 × two amounts, deal won, lead accepted, agreed-rate cases) — same result before and after opening in the form; opening twice changes nothing | Pass (4,209 checks) |
| Summary sentence | Fixture 37: Premium template reads "20% (months 4–15) then 10% (months 16–27) … from month 4 to month 27"; one-off reads "… in month 4 only" | Pass |
| Save checks | Fixture 37: no label, 0%, over 100%, backwards range, missing field, overlapping rate periods are refused; 0% allowed only with "agreed in writing" | Pass |
| Browser | Built "10% on the customer's 3rd–15th transaction if billing frequency contains month" in the form → summary shown → saved → still there after reload → Edit loads trigger and 3/15 → changed to 12% → stored with no old duration fields → deleted | Pass, no page errors |
| Typecheck / 37 fixtures / build | cloud PostgreSQL 16 harness | Pass |

Judgement calls:
- Older rules keep their effect: start month / duration become a month-range condition the admin can see and edit. Older field conditions the form can't edit (e.g. "amount ≥ 500") are kept exactly as saved and shown as "Older condition" with Remove.
- Choosing "No, only when conditions are met" and saving with no conditions pays every time (the summary says so).
- Changing the trigger to deal won or lead accepted drops conditions that only work on transactions (month, count, total, transaction/customer fields) and rate periods.
- Manage → Commission templates: renaming a template no longer resets its timing to "recurring, 12 months".

Not done (stays open): custom properties on the reward itself — needs R2b custom fields.

---

## Round R2b report (§3.6 custom fields) — 28 Nov 2026, writer: Claude

| Item | Check | Result |
|---|---|---|
| Value checks | Fixture 38: number "1,250.50" → 1250.5, "yes" → true, email lower-cased, select matched case-insensitively, real dates only; 7 bad inputs (wrong option, text in number, bad yes/no, bad email, 30 Feb, archived field, unknown field) all refused | Pass |
| Definitions | Fixture 38: duplicate name on the same record type refused (server too); same name on another type allowed; select needs options; key, type and record type fixed on edit; rename keeps the key; removing an option still in use → 409; partners can't define fields | Pass |
| Stored and audited | Fixture 38: a bad value stops the whole create (no record); values stored on the record; edit writes an audit entry with before/after; partners get 403 on create-with-fields and on edit | Pass |
| Reward rules | Fixture 38: rule "10% of Setup fee if customer Region is Asia and transaction Plan type is Monthly" pays 40 on fee 400; Quarterly plan → nothing; Europe customer → nothing; after changing the customer to Asia → pays | Pass |
| Archive | Fixture 38: archived field keeps its stored value and can't be changed | Pass |
| Partner self-edit | Fixture 38: partner user changing its own level/status → 403, level unchanged; Sales Rep changing bank details → 403 | Pass |
| Browser | Properties: "needs an option" error shown; created 2 transaction fields + 1 customer field → listed in order. Add transaction form shows them → saved on the record. List filter "Plan is monthly" → 1 row (the new one). Detail page panel: Edit → 300 → Save → still 300 after reload. Rule form offers the number field in "% of" and the customer field in conditions. No page errors | Pass |
| Products | Fixture 38: product value saved inside the product's settings next to its SKU. Browser: Manage → Products → Edit shows the custom fields; Edit/Save inside the product form doesn't submit or close it; value saved | Pass |
| Typecheck / 38 fixtures / build | cloud PostgreSQL 16 harness | Pass |

Judgement calls and changes:
- Products: custom fields can be filled once the product exists (in its Edit form).
- Custom fields are team-only for now (not shown in the partner portal). Showing chosen fields to partners can be added later as a per-field switch.
- Values of an archived field stay on records and still show on detail pages marked "(archived)"; they can't be edited until restored.
- Migration 0007 adds an empty `customFieldsJson` ("{}") to nine tables; nothing is changed or deleted.
- Demo seed: the five old demo properties (which duplicated built-in lead/deal fields and had no options stored) are replaced by five demo fields with options; the two fake "API token" demo rows (with made-up "last used" times, never shown since real tokens arrived) are removed. Existing databases keep their rows until re-seeded.
- Manual "create reward" used a random reward number (could clash); it now uses the same sequence as generated rewards.
- The add partner / lead / deal / customer / transaction / task / contact forms now stay open when the server refuses the save, so typed values aren't lost.

Seen, not fixed (outside this round): Account defaults → the "Track leads and deals in multiple currencies" tick box isn't saved anywhere.
