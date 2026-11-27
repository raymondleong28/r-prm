# R-PRM

**R-PRM** is an independent, self-hosted partner relationship management (PRM) application for a single installing organisation. It manages partner programs, tiers and commission rules, partner applications and onboarding, leads, deals, customers and transactions, rewards and payouts, enablement content, and a separate partner portal.

- **Self-use, single organisation:** There is no vendor super-admin, no external sign-up, no subscriptions, and no billing. The installing organisation's own administrators run everything.
- **Starts empty:** A fresh install has no partners, programs, or accounts. The first person to open it creates the workspace and the first administrator account at `/setup`.

---

## 1. Requirements

- **Node.js:** `>= 20 < 23` (see `.nvmrc`, pinned to Node 22)
- **Database:** PostgreSQL 16 (`postgresql@16` running locally on `127.0.0.1:5432` or a managed PostgreSQL 16 host)

---

## 2. Setup from Zero

1. **Copy the environment template and generate secrets:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and populate `DATABASE_URL` plus high-entropy values (`>= 32` characters) for `SESSION_SECRET`, `BANK_ENCRYPTION_KEY`, `CRON_SECRET`, and `SETUP_TOKEN`:
   ```bash
   openssl rand -hex 32
   ```

2. **Create an empty PostgreSQL 16 database:**
   ```bash
   createdb -h 127.0.0.1 rprm
   ```

3. **Install dependencies:**
   ```bash
   npm ci
   ```

4. **Apply database migrations:**
   ```bash
   npx prisma migrate deploy
   # or: npm run db:migrate
   ```
   A newly migrated database contains zero partners, programs, demo records, or user accounts.

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Complete first-run setup (`/setup`):**
   Open `http://127.0.0.1:3000`. Because no administrator exists yet, R-PRM redirects to `/setup`. Enter your workspace name, timezone, main currency, and first administrator credentials. Once submitted, `/setup` is permanently disabled.

---

## 3. Optional Demo Data

To populate a local development database with synthetic demo records (using the fictional "R-Cloud" company and `@*.example.com` addresses):

1. Set `SEED_ADMIN_PASSWORD` and `SEED_PARTNER_PASSWORD` in `.env`.
2. Run:
   ```bash
   npm run demo:seed
   ```
   `npm run demo:seed` refuses to run when `NODE_ENV=production` or when any non-demo user or partner data exists in the database.

---

## 4. Scripts & Operations

| Command | Purpose |
|---|---|
| `npm run dev` | Start local Next.js development server bound to `127.0.0.1:3000` |
| `npm run typecheck` | Run TypeScript compiler validation (`tsc --noEmit`) |
| `npm test` | Run automated fixture and security verification suite (`tests/fixtures.test.ts`) |
| `npm run build` | Build production Next.js application |
| `npm run start` | Start production server bound to `127.0.0.1:3000` |
| `npm run db:migrate` | Deploy committed Prisma migrations (`prisma migrate deploy`) |
| `npm run demo:seed` | Seed optional synthetic demo data (development only) |
| `npm run scheduler` | Execute durable background jobs (`invitation_nurture`, `custom_workflows`, `monthly_payouts`) via `POST /api/scheduler` using `CRON_SECRET` |

---

## 5. Backups & Restore (Database and Uploaded Files)

Database contents and uploaded files (`storage/uploads/`) are intentionally excluded from version control. Back up and restore both together:

### 5.1 Backing Up
```bash
# 1. Dump PostgreSQL database in custom compressed format
pg_dump -Fc -d "$DATABASE_URL" -f rprm-db-$(date +%F).dump

# 2. Archive private uploaded files outside public/
tar -czf rprm-uploads-$(date +%F).tar.gz storage/uploads/
```

### 5.2 Restoring
```bash
# 1. Restore PostgreSQL database into a target database
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" rprm-db-YYYY-MM-DD.dump

# 2. Extract private uploaded files
tar -xzf rprm-uploads-YYYY-MM-DD.tar.gz -C .
```

---

## 6. Documentation Map

- [`AGENTS.md`](AGENTS.md) — Governing rules, architecture invariants, and acceptance criteria
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — Feature and domain capability guide
- [`docs/SPEC.md`](docs/SPEC.md) — Technical specification
- [`docs/DOMAIN.md`](docs/DOMAIN.md) — Core entities, lifecycles, and state machines
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Architecture decisions and assumptions log
- [`docs/DATA-SAFETY.md`](docs/DATA-SAFETY.md) — Data integrity, lookup states, and integer minor units policy
- [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) — Environment variables and local service commands
- [`docs/GO-LIVE.md`](docs/GO-LIVE.md) — Production cutover runbook
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — Implementation and verification handoff log
