/**
 * §16.2 S1 & §16.3 G5, G6, G8: Single Environment Configuration Module
 *
 * - Removes all secret fallbacks.
 * - Reads `SESSION_SECRET` and `BANK_ENCRYPTION_KEY` from the environment; refuses to start if missing or shorter than 32 bytes.
 * - Reads `APP_BASE_URL` for every absolute link, redirect, and cookie `secure` flag (`G5`, `G8`).
 */

export interface AppConfig {
  sessionSecret: string;
  bankEncryptionKey: string;
  appBaseUrl: string;
  isHttps: boolean;
  cronSecret?: string;
}

export function loadRequiredConfig(
  env: Record<string, string | undefined> = process.env
): AppConfig {
  const sessionSecret = (env.SESSION_SECRET || "").trim();
  if (Buffer.byteLength(sessionSecret, "utf8") < 32) {
    throw new Error(
      "FAIL_CLOSED: SESSION_SECRET is missing or shorter than 32 bytes"
    );
  }

  const bankEncryptionKey = (env.BANK_ENCRYPTION_KEY || "").trim();
  if (Buffer.byteLength(bankEncryptionKey, "utf8") < 32) {
    throw new Error(
      "FAIL_CLOSED: BANK_ENCRYPTION_KEY is missing or shorter than 32 bytes"
    );
  }

  const rawBaseUrl = (env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (env.NODE_ENV === "production" && !rawBaseUrl) {
    throw new Error(
      "FAIL_CLOSED: APP_BASE_URL is required when NODE_ENV=production"
    );
  }
  const appBaseUrl = rawBaseUrl || "http://127.0.0.1:3000";

  return {
    sessionSecret,
    bankEncryptionKey,
    appBaseUrl,
    isHttps: appBaseUrl.startsWith("https://"),
    cronSecret: env.CRON_SECRET ? env.CRON_SECRET.trim() : undefined,
  };
}

export function getAppBaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const rawBaseUrl = (env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (env.NODE_ENV === "production" && !rawBaseUrl) {
    throw new Error(
      "FAIL_CLOSED: APP_BASE_URL is required when NODE_ENV=production"
    );
  }
  return rawBaseUrl || "http://127.0.0.1:3000";
}

export function getCookieOptions(
  maxAge = 86400,
  env: Record<string, string | undefined> = process.env
) {
  const baseUrl = getAppBaseUrl(env);
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: baseUrl.startsWith("https://"),
    maxAge,
  };
}
