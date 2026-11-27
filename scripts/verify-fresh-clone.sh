#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/r-prm-fresh-verify-XXXXXX")"
TMP_DB="rprm_fresh_verify_$$"
PG_BIN="/opt/homebrew/opt/postgresql@16/bin"
if [ ! -d "$PG_BIN" ]; then
  PG_BIN="$(dirname "$(command -v psql)")"
fi
PG_USER="${PGUSER:-$(whoami)}"

cleanup() {
  echo "==> Cleaning up temporary database ($TMP_DB) and directory ($TMP_DIR)..."
  "$PG_BIN/dropdb" -U "$PG_USER" -h 127.0.0.1 --if-exists "$TMP_DB" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" || true
}
trap cleanup EXIT

echo "==> 1. Cloning repository to temporary directory: $TMP_DIR/repo"
git clone "$REPO_ROOT" "$TMP_DIR/repo"
cd "$TMP_DIR/repo"

echo "==> 2. Creating throwaway PostgreSQL 16 database: $TMP_DB"
"$PG_BIN/createdb" -U "$PG_USER" -h 127.0.0.1 "$TMP_DB"

SESSION_SECRET_VAL="$(openssl rand -hex 32)"
BANK_ENCRYPTION_KEY_VAL="$(openssl rand -hex 32)"
CRON_SECRET_VAL="$(openssl rand -hex 32)"
SETUP_TOKEN_VAL="$(openssl rand -hex 24)"
SEED_ADMIN_PASSWORD_VAL="$(openssl rand -base64 18)"
SEED_PARTNER_PASSWORD_VAL="$(openssl rand -base64 18)"

cat > .env <<EOF
DATABASE_URL="postgresql://${PG_USER}@127.0.0.1:5432/${TMP_DB}?schema=public"
SESSION_SECRET="${SESSION_SECRET_VAL}"
BANK_ENCRYPTION_KEY="${BANK_ENCRYPTION_KEY_VAL}"
CRON_SECRET="${CRON_SECRET_VAL}"
APP_BASE_URL="http://127.0.0.1:3000"
SETUP_TOKEN="${SETUP_TOKEN_VAL}"
SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD_VAL}"
SEED_PARTNER_PASSWORD="${SEED_PARTNER_PASSWORD_VAL}"
EMAIL_DRIVER="local"
STORAGE_DRIVER="disk"
PAYOUT_DRIVER="manual"
HUBSPOT_DRIVER="mock"
FX_DRIVER="table"
SSO_DRIVER="local"
EOF

echo "==> 3. Installing dependencies (npm ci)"
npm ci

echo "==> 4. Applying Prisma migrations to empty database (npm run db:migrate)"
npm run db:migrate

echo "==> 5. Verifying newly migrated database is completely empty (0 users, 0 partners, 0 programs)"
EMPTY_COUNTS="$(npx tsx -e '
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function check() {
  const [u, prt, prg] = await Promise.all([p.user.count(), p.partner.count(), p.program.count()]);
  console.log(`users=${u} partners=${prt} programs=${prg}`);
  if (u !== 0 || prt !== 0 || prg !== 0) process.exit(1);
  await p.$disconnect();
}
check();
')"
echo "    Empty DB check passed: $EMPTY_COUNTS"

echo "==> 6. Running TypeScript compiler check (npm run typecheck)"
npm run typecheck

echo "==> 7. Running automated test fixtures (npm test)"
npm test

echo "==> 8. Running production build (npm run build)"
npm run build

echo "==> ALL FRESH-CLONE CHECKS PASSED (install, migrate, empty-db verify, typecheck, test, build)!"
