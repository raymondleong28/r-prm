# AGENTS.md — R-PRM

> Instruction file for any AI coding agent working on this repository (Antigravity, Claude Code, Codex or other).
> Version 2 — 24 Nov 2026. Replaces every earlier version of this file in full.
> Owner: Ray. Ray approves every gate, every merge and every release.

---

## 0. What this is

**R-PRM** is an independent, self-hosted partner relationship management (PRM) application for **one organisation** — the organisation that installs it. It manages partner programs, tiers and commission rules, partner applications and onboarding, leads, deals, customers and transactions, rewards and payouts, enablement content, and a separate partner portal.

- **Self-use, single organisation.** There is no vendor super-admin, no customer sign-up, no subscriptions and no billing. The installing organisation's own admins run everything.
- **Starts empty.** A fresh install has no partners, programs or data. The first person to open it creates the workspace and the first admin account (§3.2).
- **Independent.** R-PRM is its own product. It must not name, reference, imitate the branding of, or contain identifiers from any other PRM vendor or product — in code, comments, UI text, docs, seed data, package names or commit messages.

**Read before writing code, every session:** this file, then `README.md`, `docs/DECISIONS.md`, `docs/DATA-SAFETY.md`, `docs/HANDOFF.md`, `docs/GO-LIVE.md`.

---

## 1. Hard rules (non-negotiable)

### 1.1 Branches and writers
- One AI agent writes code at a time, on branch `develop`. Create `develop` from the current working branch before starting §3; the old working branch is retired.
- **Never commit or push to `main`.** Ray merges to `main` after review. This rule has been broken twice; a third time stops the work.
- Never rewrite published history or force-push unless Ray asks for that exact operation.

### 1.2 This file
- Never shorten, summarise or rewrite this file. Ray edits it. Agents read it and put their own notes in `docs/HANDOFF.md`.
- If this file and any other document disagree, this file wins; flag the conflict in `docs/HANDOFF.md`.

### 1.3 Independence
- No third-party product or vendor names, logos, wording, account IDs or identifiers anywhere in the repository.
- Write all UI text, emails, help content and docs in R-PRM's own words.
- Demo/test data uses invented names only (e.g. the fictional "R-Cloud" demo company and example.com addresses).

### 1.4 Secrets and data
- No secret, password, salt, key or token literal anywhere in the code. Everything comes from environment settings through `src/lib/config.ts`. A missing required setting stops the app from starting (fail closed); it never falls back to a built-in value.
- Never commit `.env`, database dumps, uploaded files or any real personal or partner data.
- No reset, reseed, truncate or bulk replace of existing data without Ray's explicit approval for that specific operation.
- Every figure shown as fact is computed from records. A lookup returns found / not found / couldn't check (with reason) — never a silent empty list or zero.
- Money is stored as integer minor units (cents) with a currency code — never floating point.

### 1.5 Way of working
- One slice = one outcome = one commit. Tests first; each test fails for the right reason before the fix.
- If a slice breaks existing behaviour, roll back to the last checkpoint; don't patch forward.
- No source file over ~60 KB; split by responsibility, not by trimming whitespace.
- Stop and report after 3 failed attempts at the same problem.
- No new dependency without a one-line reason in the slice report.
- Stop and ask Ray when a business rule (commission, payout, ownership, permissions, privacy) is ambiguous, or a change would alter or delete existing data.

### 1.6 Reports
Every report states, per item: the exact check, the command/URL/test name, and the observed result; anything not done or not verified, plainly. Nothing is "verified" without that evidence. Credentials are never printed in reports.

---

## 2. Current state (verified 24 Nov 2026, commit `92f1967`)

**Stack:** Next.js 14.2.35 (App Router), TypeScript, Prisma 5 + PostgreSQL 16, Tailwind. Runs on `127.0.0.1:3000`.

**Verified working (keep green):**
- Logged out: every page redirects to login; every API returns 401.
- Server-side sessions (database `Session` table) checked on every request for revocation, expiry and disabled users; real logout in admin and portal.
- `User` table with per-user salted scrypt hashes; exact email match; login lockout (HTTP 429).
- Partner users see only their own partner's records, their own program and their own tier; partner responses pass through allowlist serializers.
- Uploads require a session, have size/type limits and are stored outside `public/`; downloads go through an authorised route.
- Bank details encrypted at rest (AES-256-GCM).
- Single-use hashed activation tokens with a set-password page (`/p/activate`).
- Commission engine: structured rules (trigger, value type, amount mode, duration, start month, rate steps, validation, clawback); tier-correct reward generation; payouts computed from linked rewards; monthly/quarterly payout schedule.
- Applications: accept as prospect or active partner; reject with required reason.
- Onboarding pipelines with six stage action types; impersonation with banner and audit log; audit log on writes.
- Connectors: email `local|smtp`, storage `disk`, payouts `manual`, HubSpot `mock`; unimplemented live options refuse to start.
- Baseline Prisma migration; `/api/health`; cron-protected scheduler; structured workflows; CSV import with dry run.

---

## 3. Work to do now (in this order)

### 3.1 Independence clean-up
1. Follow `CLEANUP.md` (a temporary file listing the exact names, identifiers, files and account ID to remove). It covers code identifiers, comments, UI text, page metadata, seed data, docs, the tracking-snippet example and `package.json` (`"name": "r-prm"`).
2. Generate the tracking-snippet example from the workspace's own ID, not a hard-coded value.
3. Write `docs/PRODUCT.md` describing R-PRM's features in its own words (use §4 of this file as the outline).
4. Rewrite `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`, `docs/DOMAIN.md`, `docs/DATA-SAFETY.md`, `docs/ENVIRONMENT.md`, `docs/GO-LIVE.md` and `PROGRESS.md` without third-party references. Keep decisions; drop "parity" and "clone" framing.
5. Last step: run every search in `CLEANUP.md`, confirm all return nothing, paste the output in the report, then **delete `CLEANUP.md`**.
6. **History:** the existing repository's history still contains these references. When the clean-up passes, Ray will create a new repository and import the cleaned code as a single first commit. Prepare for that: the working tree must be complete and self-contained. Do not attempt to rewrite the old repository's history yourself.

### 3.2 Fresh start (first-run setup)
1. A new database contains **no** partners, programs, demo data or user accounts after `prisma migrate deploy`.
2. When no admin exists, every route redirects to `/setup`: workspace name, timezone, main currency, first admin's name, email and password. On submit, create the workspace settings and the admin, then disable `/setup` permanently (refuse once any admin exists).
3. `/setup` is protected by a one-time `SETUP_TOKEN` from the environment in production, so a stranger can't claim a fresh install first.
4. Demo data becomes opt-in: `npm run demo:seed` (refuses to run when `NODE_ENV=production` or when any non-demo data exists). Demo passwords come from `.env`.
5. Branding (name, logo, colours, portal domain) comes from workspace settings, not code. Remove the Billing settings tab and any vendor sign-up or "refer" screens (self-use has no billing or referral programme for the software itself).
6. Done when: empty database → `/setup` → admin created → empty dashboard with honest empty states → create a program, invite a partner, partner activates and signs in.

### 3.3 Remaining security and correctness fixes
| # | Problem | Fix | Done when |
|---|---|---|---|
| F1 | MFA is optional at login; the "Require MFA" setting is never enforced; a hard-coded fallback authenticator secret exists in `src/app/api/auth/route.ts` | Remove the fallback. Enforce MFA when required (coworkers and/or partners); enrolment on first login when required | Required + no code → login refused; no secret literal |
| F2 | Lead-form tokens are derived from a fixed salt in `src/lib/prmEngine.ts`, so anyone with the code can compute any partner's link | Random token per partner stored hashed, rotatable by an admin | Token not derivable from partner ID |
| F3 | `APP_BASE_URL` silently defaults to `127.0.0.1` | Required when `NODE_ENV=production`; refuse to start without it | Production start without it fails |
| F4 | Test-account blocking is opt-in (`BLOCK_TEST_ACCOUNTS`) | Always on in production; no flag | Test accounts can't sign in in production |
| F5 | SSO `saml` and exchange-rate `api` options exist without implementations | Refuse to start if selected, until implemented | Selecting them fails closed |
| F6 | Money stored as `Float` | Migrate amounts to integer minor units + currency; fixtures prove totals unchanged | No `Float` money columns |
| F7 | Login lockout counters are in memory (reset on restart, not shared across servers) | Store in the database | Lockout survives restart |
| F8 | Onboarding pipeline chosen by whether a program name contains "referral"; missing program silently defaults to the first program | Explicit program → pipeline assignment; missing program is an error | No name-based or default selection |
| F9 | `tests/parity-fixtures.test.ts` has type errors (e.g. mock session missing `issuedAt`/`expiresAt`); `tsconfig` includes tests, so `npm run build` can fail on a fresh machine | Fix types; rename to `tests/fixtures.test.ts` | `npm run typecheck` and `npm run build` pass from a fresh clone |

### 3.4 Handover completeness (so any AI or developer can revive the project from the repository alone)
1. **`README.md`:** what R-PRM is; requirements (Node version, PostgreSQL 16); setup from zero (`cp .env.example .env`, generate secrets, create database, `npm ci`, `npx prisma migrate deploy`, `npm run dev`, open `/setup`); optional demo data; running tests; running the scheduler; production build and start; where docs live.
2. **`.env.example`:** every setting the code reads, with a one-line comment each and safe placeholders. Currently missing: `BLOCK_TEST_ACCOUNTS` (remove per F4), `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `PAYOUT_API_KEY`, `HUBSPOT_PRIVATE_APP_TOKEN`, `FX_API_KEY`, `SAML_IDP_LOGIN_URL`, `SAML_IDP_CERT`, plus the new `SETUP_TOKEN`.
3. **Pin versions:** `"engines": { "node": ">=20 <23" }` in `package.json` and a matching `.nvmrc`.
4. **Scripts:** `typecheck`, `test`, `build`, `start`, `db:migrate`, `demo:seed`, `scheduler`. Remove `db:push` and `db:setup` from normal use.
5. **`prisma/migrations/migration_lock.toml`** present; `npx prisma migrate deploy` works on an empty database.
6. **Fresh-clone check script** `scripts/verify-fresh-clone.sh`: clones to a temp folder, installs, migrates a throwaway database, typechecks, tests, builds. Run it and include its output in the report.
7. **Pointer files** for other agents: `CLAUDE.md` and `GEMINI.md` each containing only "Read AGENTS.md first."
8. **`docs/GO-LIVE.md`:** true, current, and covering §5.
9. **Not in the repository, by design:** the database contents and uploaded files. Document in `README.md` how to back up and restore both (`pg_dump`/`pg_restore`, copy of the storage folder or bucket).

### 3.5 No demo or organisation values in code (added 25 Nov 2026)
The database starts empty, but the screens still carry demo data written into the source. A fresh install would show it, and some of it produces wrong records. Demo values may exist **only** in `prisma/seed.ts` (the `demo:seed` script) and `tests/`.

1. **Wrong behaviour — fix first:**
   - Converting a lead to a deal always creates a deal of 22,000 SGD (`src/app/leads/[id]/page.tsx`) or 18,500 SGD (`src/app/leads/views/all/page.tsx`). Ask the admin for amount and currency, defaulting currency to the workspace main currency; amount has no default.
   - "My Leads / My Deals / My Partners / My Prospects" views filter on the hard-coded owner "Alex Morgan". Filter on the signed-in user's id.
   - The scheduler assigns tasks to "Alex Morgan" when a partner has no owner. Assign to the workspace's default owner setting, or leave unassigned and flag it.
   - Fallback IDs `prt-1` and `prog-strategic` when a record or URL parameter is missing. Show "not found" instead (AGENTS.md §1.4: no silent defaults).
   - The admin notification bell shows a fixed message ("New Deal Registered by Apex Cloud … SGD 36,000"). Build it from real events or remove it.
   - The dashboard's 12-month chart labels are fixed (12/2025–11/2026). Compute the last 12 months from today in the workspace timezone.
   - The Security tab shows a fixed "TOTP Active" badge and secret `JBSWY3DPEHPK3PXP`. Show the signed-in user's real MFA status; display a secret only during enrolment.
2. **Demo and organisation names in code** — remove from `src/`; take them from settings or leave fields empty:
   - "R-Cloud …", "Eber", "Eber / R-Cloud Enterprise Pte Ltd" (payout invoice issuer), "Alex Morgan", "Apex Cloud Solutions Pte Ltd", "NovaBridge", "Meridian", "Vanguard", "Platinum Elite", "Silver Tier", demo customer and company names in sample text.
   - Organisation name, legal entity and address on invoices → Account defaults / self-invoicing settings.
   - Lead-form consent text ("Eber General Terms 7.2") → a workspace setting holding the consent wording and terms link; the checkbox stays required.
   - Email template bodies and sign-offs → use merge fields (`{{workspace.name}}`), no organisation names.
   - Form placeholders may show generic examples ("Acme Ltd") but never prefill values.
   - "Load Eber Commission Fixture Template" on the program page → rename to "Load commission template" and move the three templates into data the admin can edit, not product text.
3. **Currency:** replace hard-coded `"SGD"` defaults with the workspace main currency. Rename `amountSgd` columns to `amountBase` (migration; update code, tests, seed).
4. **Schema defaults:** remove demo defaults in `prisma/schema.prisma` ("R-Cloud Strategic Partner", "Strategic Partner", "All Strategic Partners", "Sum of deals closed won" if it is a demo value); fields become optional with no default or a neutral enum value.
5. **Check (must print nothing):**
   ```bash
   grep -rnE "R-Cloud|Eber|Alex Morgan|Apex|NovaBridge|Meridian|Vanguard|Synthetix|Platinum Elite|Silver Tier|Gold Tier|prog-strategic|prt-1|JBSWY3DP" src prisma/schema.prisma
   grep -rn '"SGD"' src
   ```
   The setup screen's currency list may contain "SGD" as one option among others; exclude that file from the second check and say so in the report.
6. **Done when:** empty database → `/setup` with workspace "Test Co" in MYR → every screen shows "Test Co", MYR and honest empty states; nothing mentions a demo record; converting a lead asks for an amount.

---

### 3.6 Behaviour gaps found 28 Nov 2026 (side-by-side check against the reference product, read-only)
Writer from 28 Nov 2026: Claude (Ray's Claude session). One writer at a time still applies.

**Done in Round 1 (commits `9baa736`, `c81ddbe`) — keep green:**
- Test safety lock: `npm test` refuses unless the database name contains `test` or `verify`.
- Two-step login: standard base32 TOTP (RFC 6238 vectors in Fixture 11), QR code, refresh-safe pending setup, secret encrypted at rest, 8 hashed single-use recovery codes, user-enabled MFA enforced, lockout on wrong codes, admin reset (`admin_reset_mfa`), Security-tab setup / new codes / turn off.
- Prospection board columns and card fields stored in Partner settings; partner types saved; no made-up "Standard" level or "Reseller" type.
- Export on every list downloads real CSV (formula-escaped, no internal fields). Data sources show Creation date.

**Rule from now on: no fake controls.** A button either does the real thing or is removed.

**Done in Round 1b (no fake controls) — keep green (Fixture 35):**
- Self-billed invoice PDF generated from the payout's linked rewards (`/api/payouts/[id]/invoice`; partners only their own; refused when self-invoicing is off).
- API tokens: `crypto.randomBytes`, SHA-256 hash stored, shown once, `Authorization: Bearer` works on every API route, revoke stops it immediately, tokens can't manage tokens.
- List toolbar on every list: real date-range filter, property filters, paging (25/50/100), saved views (add, save, rename, delete; stored in setting `saved_views`). "Edit columns" removed.
- Password change in user settings is real (current password checked, other sessions signed out). Program "Rename" is real (partner and deal copies of the name follow). Onboarding pipeline ↔ program binding saves. Deal/lead "View log" shows the record's audit entries. Prospection has a list/board toggle. Task views and badges are worked out from the due date. Dead built-in views ("Weekly Report", "Platform Partner") removed.

**Still to build (removed for now, not faked):**
1. Configurable deal stages (fixed 10 stages today) — do in R2 with the "deal stage changed" trigger.
2. Referral tracking links: no redirect or click counting exists and the tracking snippet was removed. Build `/r/<code>` redirect + click/visitor counting in R2 with the "website visit" trigger.
3. Column chooser for list tables.

**Reward rules — staged rounds (the biggest gap):**
The reference product's reward form, observed field by field:
- Reward types Cash / Credit / Gift card / Coupon share one form (type is a label). R-PRM already matches.
- 9 triggers: customer property changed; deal contract started; deal stage changed; new customer; new lead accepted; new transaction; transaction added on a customer; transaction added on a deal; website visit from a partner link. R-PRM has 4.
- Amount: fixed amount in a currency, or % of **any numeric transaction field** (incl. custom fields). R-PRM: % of amount only.
- "Reward every time?" Yes, or No → conditions, any combination: month range from the customer's first transaction ("month 1 to 12", inclusive); transaction count range ("3rd to 15th"); running sum of transactions; **any transaction property** (incl. custom, e.g. billing frequency contains "month", billing period = 1); **any customer property**.
- Custom properties on the reward itself.
- Real pattern to reproduce exactly (a recurring program, monthly plan): "A% of amount on the 3rd–15th transaction added on a customer if billing frequency contains month and billing period = 1"; separate rules for quarterly (1st–4th), half-yearly (1st–2nd), yearly (1st–1st), then B% rules for the following periods. Use invented rates in the repository; Ray supplies the real ones for his own check.

**Done in R2a (Fixture 36) — keep green:**
- One engine (`src/lib/rewardRules.ts`) for live data and tests. Live transactions, deal won and lead accepted all go through it (`src/lib/rewardGeneration.ts`); the old "X% of every transaction" path is gone.
- Month windows, one-off months, 20%→10% rate steps and "agreed in writing" now apply to live transactions. Month = months since the customer's first transaction.
- Conditions: month range, Nth transaction of the customer, running total, transaction field, customer field (built-in fields; custom fields come with R2b). Triggers: transaction (any / on a customer / on a deal), deal closed won, lead accepted.
- Transactions link to their customer record (`Transaction.customerId`); unique reward numbers from a sequence; `Reward.sourceKey` stops a rule paying twice for the same event.
- A customer counts as the partner's client unless it had already cancelled when the transaction happened.

**Done in R3 (Fixture 37) — keep green:**
- Rule form (`src/components/ProgramRuleModal.tsx`, helpers in `src/lib/ruleEditing.ts`): label, description, reward type (cash / credit / gift card / coupon), trigger, "reward every transaction?" Yes / No, conditions added and removed in any combination, amount (fixed with currency, % of a number field, or one month's subscription), optional rate periods, validation and refund reversal, a one-line summary of what the rule pays, and save checks.
- Editing an older rule turns its start month / duration into a visible month-range condition with the same effect; older field conditions the form can't edit are kept exactly as saved. Fixture 37 proves every template and every seeded rule pays the same after editing.
- Saving a template from Manage keeps all its settings (it used to reset them to "recurring, 12 months").
- Custom fields on rewards: see R2b below.

**Done in R2b (Fixture 38) — keep green:**
- Custom fields for contacts, customers, deals, leads, partners, rewards, payouts, tasks, transactions and products. Definitions in Account settings → Properties (`src/components/CustomFields.tsx`): text, number, email, checkbox, single select, date. Name and options can change; type and key can't; an option still used by a record can't be removed; archive keeps stored values.
- Values stored per record (`customFieldsJson`; products in `metadataJson.customFields`), checked on the server (`src/lib/customFieldDefs.ts`, `src/lib/customFieldStore.ts`), audited with before/after. Team only: partners can't see or set them.
- Shown on create forms (partner, lead, deal, customer, transaction, task, contact) and every detail page; usable in list filters and CSV export (column header = field name); customer and transaction fields usable in reward rule conditions, number transaction fields in "% of".
- Security fix found on the way: a partner user could change any field on its own partner record (e.g. its level). Partners can now change only their bank details, and only as the partner manager.

Rounds (each: tests first, one commit, all fixtures green, Ray checks before the next):
- **R2c — remaining triggers:** deal stage changed (with editable deal stages), deal contract started, new customer, customer field changed, website visit (with referral link tracking — needs a public address, so it can wait for go-live).
- **R4 — proof:** rebuild the recurring-program rules above with synthetic data, feed 24 months of monthly / quarterly / half-yearly / yearly invoices, assert every reward amount and date. Ray confirms expected numbers first (§1.5).

**Done when (§3.6):** no control in the app only shows a toast; R4 fixture passes with Ray-confirmed numbers.

## 4. Product outline (for `docs/PRODUCT.md`)

- **Programs and tiers:** programs with tiers; each tier has commission rules, benefits and requirements (e.g. minimum revenue, certified people). Duplicate and archive programs. Application form per program; automated emails per trigger (application received, accepted with activation link, rejected with reason).
- **Commission rules:** trigger (paid transaction, deal won, lead accepted, lead converted); value type (cash; coupon, gift card and credit marked not yet configured); percentage or fixed amount; one-off or recurring with start month, duration and rate steps; validation required; clawback on refund. Rewards: pending → validated → in payout → paid; refused with reason; clawed back as a negative adjustment.
- **Payouts:** bundle validated rewards; schedule monthly or quarterly with a threshold; manual mark-as-paid now, provider later; self-invoice PDF for opted-in partners.
- **Partners:** records with team members (roles: manager, sales rep, stakeholder; main contact); portal access per person; prospection and onboarding pipelines with six action types (view asset, read article, upload document, provide information, book meeting, self-invoicing opt-in), admin validation where required; groups for segmentation; certifications.
- **Leads, deals, customers, transactions:** partner lead submission and personal lead form; shared leads; deal registration with configurable stages, conflict detection, expiry and resubmission; customers and transactions linked to deals and partners; multi-currency with dated exchange rates.
- **Content:** assets with access by everyone / my team / chosen tiers, groups or partners; help-centre articles; news; per-program partner dashboards.
- **Partner portal:** separate login and layout; home, leads, deals, rewards, payouts, onboarding, assets, help centre, news, team, profile and bank details; program permission toggles enforced on the server.
- **Admin:** account settings (defaults, portal branding and domain, security incl. MFA/SSO, partner/lead/deal/payout settings, custom properties for all objects, data import/export, integration tokens); workflows (trigger → condition → actions, scheduled, logged); tasks; business plans; account mapping (upload account lists, compute overlaps by domain and company name, collaborations); audit log.

---

## 5. Going live (only settings, accounts and DNS — no code)

| Service | Local now | Live |
|---|---|---|
| Hosting + database | Mac + local PostgreSQL | Host with managed PostgreSQL, daily backups, tested restore |
| Domain + HTTPS | `127.0.0.1` | DNS record, TLS certificate; `APP_BASE_URL=https://…` (secure cookies follow) |
| Email | Outbox / local SMTP catcher | `EMAIL_DRIVER=smtp` + SMTP settings; SPF, DKIM, DMARC on the sending domain |
| File storage | Disk outside `public/` | Disk on a persistent volume, or S3-compatible driver once built |
| Scheduler | `npm run scheduler` | Host cron calling `POST /api/scheduler` with `CRON_SECRET` |
| Monitoring | Logs | Uptime check on `/api/health`, error alerts |
| Payouts, HubSpot, SSO, exchange-rate API | Manual / mock / password + MFA / rate table | Each needs its live driver built, then keys — until then they stay local |

**Before real data:** PDPA consent wording approved; security review passed; test accounts removed; `SETUP_TOKEN` set; backups tested.

---

## 6. Open questions for Ray
1. Hosting provider for the live version?
2. Confirm expected numbers for the commission fixtures (Biz Partner month-4 one-off; Premium 20% months 4–15, 10% months 16–27; referral only with a pre-agreed rate).
3. Asset access across tier/group/partner pickers: any match (current) or all must match?
4. Bank details at application or after acceptance?
5. First payout provider to build?
6. Product name: keep "R-PRM"?

---

## 7. Acceptance checks Ray's reviewer will run
| Check | Expected |
|---|---|
| The searches that were listed in `CLEANUP.md` (Ray's reviewer keeps a copy) | Nothing found; `CLEANUP.md` deleted |
| Fresh clone → `scripts/verify-fresh-clone.sh` | Install, migrate, typecheck, test, build all pass |
| Empty database → open app | Redirect to `/setup` |
| `/setup` in production without `SETUP_TOKEN` / after an admin exists | Refused |
| Fresh install dashboard | Empty, honest empty states, no demo data |
| MFA required, no code | Login refused |
| Lead-form token | Not derivable from partner ID |
| Production start without `APP_BASE_URL` | Refuses |
| Money columns | Integer minor units |
| `.env.example` vs settings read in code | Every setting listed |
| `main` branch | Unchanged by the agent |
| §3.5 checks (demo/organisation names, `"SGD"`) | Nothing found |
| `npm test` with `.env` pointing at a database not named *test*/*verify* | Refuses, exit 2 |
| Two-step login with Google/Microsoft Authenticator | QR scan works; 6-digit codes accepted; refresh keeps the same setup; 8 recovery codes shown once |
| Any toast-only button (`grep` for `showToast` as the only action) | None |
| API call with `Authorization: Bearer <token>` | Works; revoked token → 401 |
| Payout "Download PDF" | A real PDF whose total equals the payout |
| Recurring-program reward rules (R4 fixture) | Every amount and date matches Ray-confirmed numbers |
| Fresh workspace "Test Co" in MYR | Every screen shows Test Co and MYR; no demo names; chart months end at the current month |
| Convert lead to deal | Asks for amount; no fixed value |
| `develop` on GitHub | Pushed; matches the local branch |
| Everything in §2 | Still passing |
