import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadRequiredConfig } from "@/lib/config";
import { loadAndValidateConnectorConfig } from "@/lib/connectors";

export const dynamic = "force-dynamic";

/**
 * §16.3 G7: Health Check Endpoint (`/api/health`)
 * Verifies:
 * - PostgreSQL database reachability (`SELECT 1`)
 * - Applied Prisma migrations (`_prisma_migrations` table current)
 * - Required environment settings & connector configurations present
 * - Zero secrets exposed in output
 */
export async function GET() {
  try {
    const appCfg = loadRequiredConfig(process.env);
    const connCfg = loadAndValidateConnectorConfig(process.env);

    await prisma.$queryRawUnsafe("SELECT 1");

    const migrations = await prisma
      .$queryRawUnsafe<
        Array<{ migration_name: string; finished_at: Date | null }>
      >(
        "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC"
      )
      .catch(() => []);

    const migrationsCurrent =
      migrations.length > 0 &&
      migrations.every((m) => Boolean(m.finished_at));

    return NextResponse.json({
      status: "ok",
      checks: {
        databaseReachable: true,
        databaseEngine: "postgresql",
        migrationsCurrent,
        appliedMigrationsCount: migrations.length,
        latestMigration: migrations[0]?.migration_name || "none",
        requiredSecretsPresent: true,
        appBaseUrl: appCfg.appBaseUrl,
        connectors: {
          emailDriver: connCfg.EMAIL_DRIVER,
          storageDriver: connCfg.STORAGE_DRIVER,
          payoutDriver: connCfg.PAYOUT_DRIVER,
          hubspotDriver: connCfg.HUBSPOT_DRIVER,
          fxDriver: connCfg.FX_DRIVER,
          ssoDriver: connCfg.SSO_DRIVER,
        },
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: String(err),
        checkedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
