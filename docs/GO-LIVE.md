# GO-LIVE.md — R-PRM Production Cutover Runbook

> **Purpose:** Every step required to take R-PRM from local verification (`http://127.0.0.1:3000`) to a live production environment requires **only environment variables, external accounts, and DNS configuration — zero code changes**.

---

## 1. Local vs Live Service Matrix (AGENTS.md §5)

| Service | Local now | Live |
|---|---|---|
| **Hosting + database** | Mac + local PostgreSQL 16 | Host with managed PostgreSQL 16, daily automated backups, tested `pg_restore` |
| **Domain + HTTPS** | `http://127.0.0.1:3000` | DNS record, TLS certificate; `APP_BASE_URL=https://…` (secure cookies follow automatically) |
| **Email** | Outbox (`EMAIL_DRIVER=local`) or local SMTP catcher | `EMAIL_DRIVER=smtp` + SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`); SPF, DKIM, DMARC on sending domain |
| **File storage** | Disk outside `public/` (`STORAGE_DRIVER=disk`, `storage/uploads/`) | Disk on a persistent volume (`STORAGE_DRIVER=disk`), or S3-compatible driver once built |
| **Scheduler** | `npm run scheduler` | Host cron calling `POST /api/scheduler` with `Authorization: Bearer $CRON_SECRET` |
| **Monitoring** | Application logs | Uptime check on `GET /api/health`, error alerts |
| **Payouts, HubSpot, SSO, exchange-rate API** | Manual (`PAYOUT_DRIVER=manual`), mock (`HUBSPOT_DRIVER=mock`), password + MFA (`SSO_DRIVER=password`), rate table (`FX_DRIVER=table`) | Each needs its live driver built in code before enabling; selecting `wise`, `stripe`, `live`, `saml`, or `api` today refuses to start (fail closed) |

---

## 2. Environment Variables & Fail-Closed Startup (`src/lib/config.ts`, `src/lib/connectors.ts`)

All secrets and driver selections are validated at startup by `loadAndValidateAppSecrets()` and `loadAndValidateConnectorConfig()`. **There are zero secret fallbacks or hard-coded passwords in `src/`.**

### 2.1 Required Core Environment Variables

| Variable | Requirement | Enforcement in Code |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 16 connection URL (`postgresql://...`) | Validated by `loadAndValidateConnectorConfig()`. Must start with `postgres://` or `postgresql://`. |
| `SESSION_SECRET` | `>= 32` characters (e.g. `openssl rand -hex 32`) | Validated by `getSessionSecret()`. Used to HMAC-sign session cookies (`rprm_session`). Throws `FAIL_CLOSED` if unset or `< 32` characters. |
| `BANK_ENCRYPTION_KEY` | `>= 32` characters (e.g. `openssl rand -hex 32`) | Validated by `getBankEncryptionKeyBuffer()`. Used for AES-256-GCM encryption (`enc:v1:<iv>:<tag>:<ciphertext>`) of `Partner.bankDetailsJson`. Throws `FAIL_CLOSED` if unset or `< 32` characters. |
| `APP_BASE_URL` | Base origin (e.g. `https://partners.yourdomain.com` in production; `http://127.0.0.1:3000` locally) | Required when `NODE_ENV=production` (F3 — refuses to start if missing in production). When `APP_BASE_URL` starts with `https://`, session cookies automatically set `secure: true`. |
| `CRON_SECRET` | High-entropy bearer secret (`>= 16` chars) | Checked by `POST /api/scheduler` when called headlessly via `Authorization: Bearer $CRON_SECRET`. Fails closed (`HTTP 503`) if unset. |
| `SETUP_TOKEN` | One-time first-run setup token (`>= 16` chars) | Required in production (`NODE_ENV=production`) to submit `/setup` and claim a fresh installation (§3.2). |

### 2.2 Demo-Only Environment Variables (Refused in Production)

| Variable | Requirement | Enforcement in Code |
|---|---|---|
| `SEED_ADMIN_PASSWORD` | Password used by `npm run demo:seed` for demo coworker accounts | `npm run demo:seed` refuses to run when `NODE_ENV=production` or when any non-demo data exists. |
| `SEED_PARTNER_PASSWORD` | Password used by `npm run demo:seed` for demo partner accounts | Hashed with a per-user random 16-byte salt (`scrypt:<saltHex>:<keyHex>`) into the `User` table. |

---

## 3. Connector Drivers: Implemented vs Fail-Closed (F5)

Every external boundary is controlled by a driver environment variable in `src/lib/connectors.ts`. Drivers that are not implemented in code **fail closed (`FAIL_CLOSED`)** when selected rather than returning fake success.

| Boundary | Driver Variable | Implemented Values (Working Today) | Unimplemented Values (Fail Closed at Startup) |
|---|---|---|---|
| **Outbound Email** | `EMAIL_DRIVER` | `local` (writes escaped HTML to in-app Outbox)<br>`smtp` (delivers real email via `nodemailer` using `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USER`/`SMTP_PASS`, `EMAIL_FROM`) | If `EMAIL_DRIVER=smtp` and `SMTP_HOST` is missing, throws `FAIL_CLOSED`. |
| **File Storage** | `STORAGE_DRIVER` | `disk` / `local` (writes uploaded files to private `storage/uploads/` outside `public/` with a 15 MB size limit and extension allowlist; served only through authenticated `GET /api/files/[key]`) | `s3` — **Not implemented yet.** Throws `FAIL_CLOSED`. |
| **Payout Provider** | `PAYOUT_DRIVER` | `manual` (records manual bank transfer reference and marks payout `Paid`) | `wise`, `stripe` — **Not implemented yet.** Throws `FAIL_CLOSED`. |
| **CRM Sync** | `HUBSPOT_DRIVER` | `mock` / `disabled` (logs skipped CRM sync locally) | `live` — **Not implemented yet.** Throws `FAIL_CLOSED`. |
| **FX Rates** | `FX_DRIVER` | `table` (uses dated exchange rate table in `src/lib/prmEngine.ts`) | `api` — **Not implemented yet (F5).** Throws `FAIL_CLOSED`. |
| **SSO / SAML** | `SSO_DRIVER` | `password` / `local` (database-backed `User` + server-side `Session` + enforced TOTP MFA) | `saml` — **Not implemented yet (F5).** Throws `FAIL_CLOSED`. |

---

## 4. First-Run Database Migration & Setup (§3.2)

1. Provision a PostgreSQL 16 database.
2. Set `DATABASE_URL`, `SESSION_SECRET`, `BANK_ENCRYPTION_KEY`, `APP_BASE_URL`, `CRON_SECRET`, and `SETUP_TOKEN` in the production environment.
3. Apply committed migrations:
   ```bash
   npm run db:migrate
   ```
   A newly migrated database contains **no** partners, programs, demo data, or user accounts.
4. Build and start the server:
   ```bash
   npm run build
   npm run start
   ```
5. Open the application in a browser. Because no administrator exists yet, every route redirects to `/setup`.
6. Enter the `SETUP_TOKEN`, workspace name, timezone, main currency, and the first administrator's name, email, and password. On submit, R-PRM creates the workspace settings and the administrator account, signs you in, and permanently disables `/setup`.

---

## 5. Pre-Launch Checklist (Before Real Data)

- [ ] PDPA consent wording approved for public partner application and lead forms.
- [ ] Security review passed (`npm run typecheck && npm test && npm run build`).
- [ ] No demo/test accounts present (`@*.example.com` logins are automatically blocked when `NODE_ENV=production`).
- [ ] `SETUP_TOKEN` configured and `/setup` completed by the administrator.
- [ ] Automated daily PostgreSQL backups (`pg_dump`) and `storage/uploads/` backups tested with a full restore drill.
