// The fixture suite wipes and reseeds the database it runs against.
// It must only ever run against a disposable database, never a real workspace.
// Rule: the database name must contain "test" or "verify" (for example
// rprm_test, rprm_fresh_verify_123), and NODE_ENV must not be "production".

export function databaseNameFromUrl(databaseUrl: string): string | null {
  try {
    const url = new URL(databaseUrl);
    const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
    return name || null;
  } catch {
    return null;
  }
}

export function checkDisposableTestDatabase(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined
): { ok: true; databaseName: string } | { ok: false; reason: string } {
  if (nodeEnv === "production") {
    return { ok: false, reason: "NODE_ENV is production" };
  }
  if (!databaseUrl) {
    return { ok: false, reason: "DATABASE_URL is not set" };
  }
  const databaseName = databaseNameFromUrl(databaseUrl);
  if (!databaseName) {
    return { ok: false, reason: "DATABASE_URL has no database name" };
  }
  if (!/(test|verify)/i.test(databaseName)) {
    return {
      ok: false,
      reason: `database "${databaseName}" is not marked as disposable (its name must contain "test" or "verify")`,
    };
  }
  return { ok: true, databaseName };
}

export function assertDisposableTestDatabase(): string {
  const result = checkDisposableTestDatabase(
    process.env.DATABASE_URL,
    process.env.NODE_ENV
  );
  if (!result.ok) {
    console.error(
      `REFUSED: the test suite deletes and reseeds data, and ${result.reason}.\n` +
        "Run it against a throwaway database instead:\n" +
        "  ./scripts/verify-fresh-clone.sh\n" +
        "or create one (e.g. createdb rprm_test) and point DATABASE_URL at it."
    );
    process.exit(2);
  }
  return result.databaseName;
}
