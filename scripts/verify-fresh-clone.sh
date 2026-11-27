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

cat > .env <<EOF
DATABASE_URL="postgresql://${PG_USER}@127.0.0.1:5432/${TMP_DB}?schema=public"
SESSION_SECRET="8f4a9c2e1b7d6f3a0e5c8b9d2a4f6e1c3b5d7f9a1c3e5b7d9f2a4c6e8b0d2f4a"
BANK_ENCRYPTION_KEY="9e2d4f6a8c0b1e3d5f7a9c2e4b6d8f0a2c4e6b8d0f1a3c5e7b9d2f4a6c8e0b1d"
CRON_SECRET="7c1e3a5f9b2d4e6a8c0f2b4d6e8a0c2f4b6d8e0a2c4f6b8d0e2a4c6f8b0d2e4a"
APP_BASE_URL="http://127.0.0.1:3000"
SETUP_TOKEN="setup_token_verify_1234567890"
SEED_ADMIN_PASSWORD="Rprm_Verify_Admin_Password_9842!"
SEED_PARTNER_PASSWORD="Rprm_Verify_Partner_Password_7631!"
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
