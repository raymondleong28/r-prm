# ENVIRONMENT.md — R-PRM Environment & Database Configuration

## Required Environment Variables (`.env`)
- `DATABASE_URL`: PostgreSQL 16 connection string:
  ```env
  DATABASE_URL="postgresql://user@127.0.0.1:5432/rprm?schema=public"
  ```
- `SESSION_SECRET`: 32+ character secret used to HMAC-sign session cookies (`openssl rand -hex 32`).
- `BANK_ENCRYPTION_KEY`: 32+ character secret used for AES-256-GCM encryption of partner bank details at rest (`openssl rand -hex 32`).
- `APP_BASE_URL`: Base URL of the application (e.g. `http://127.0.0.1:3000` locally; required in production, e.g. `https://partners.example.com`).
- `CRON_SECRET`: 16+ character bearer token required by `POST /api/scheduler`.
- `SETUP_TOKEN`: Required in production (`NODE_ENV=production`) to unlock the one-time first-run `/setup` screen.
- `SHOW_DEV_LOGINS` *(optional, local dev only)*: Set `SHOW_DEV_LOGINS=true` when `NODE_ENV !== 'production'` to display test login hints on `/login` and `/p/login`. Always ignored in production, where `@*.example.com` test accounts are unconditionally blocked.
- **Outside-Service Connector Selectors (Fail Closed when unimplemented drivers are selected):**
  - `EMAIL_DRIVER`: `local` (default) | `smtp` (requires `SMTP_HOST`, optional `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`)
  - `STORAGE_DRIVER`: `disk` (default) | `s3` (not yet implemented; refuses to start if selected)
  - `PAYOUT_DRIVER`: `manual` (default) | `wise` | `stripe` (not yet implemented; refuses to start if selected)
  - `HUBSPOT_DRIVER`: `mock` (default) | `live` (not yet implemented; refuses to start if selected)
  - `FX_DRIVER`: `table` (default) | `api` (not yet implemented; refuses to start if selected)
  - `SSO_DRIVER`: `password` (default) | `saml` (not yet implemented; refuses to start if selected)

## Local PostgreSQL 16 Service Commands
- Start service: `/opt/homebrew/bin/brew services start postgresql@16`
- Check status: `/opt/homebrew/opt/postgresql@16/bin/pg_isready`

## Running Commands (Bound to `127.0.0.1`)
- `npm run dev` — Start development server on `http://127.0.0.1:3000`
- `npm run typecheck` — Run TypeScript compiler validation (`tsc --noEmit`)
- `npm test` — Run automated fixture suite (`tests/fixtures.test.ts`)
- `npm run build` — Build production Next.js bundle
- `npm run start` — Start production server bound to `127.0.0.1:3000`
- `npm run db:migrate` — Apply committed Prisma migrations (`prisma migrate deploy`)
- `npm run demo:seed` — Seed optional synthetic demo data (refuses in production or when non-demo data exists)
- `npm run scheduler` — Run background workflow and payout scheduler jobs
