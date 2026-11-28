import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { bearerTokenFrom, resolveApiToken } from "./apiTokens";
import { loadRequiredConfig, getAppBaseUrl } from "./config";

/**
 * §16.2 S1, S3, S5, S6, S7, S9, S13 & §16.3 G5, G8, G10:
 * - No fallback secrets or default password hashes in code.
 * - Per-user random salt (`scrypt:<32-hex-salt>:<64-hex-derived-key>`).
 * - Exact match on unique normalized `User.email` (`S6`, `S7`).
 * - Server-side `Session` table (`id`, `userId`, `createdAt`, `expiresAt`, `revokedAt`).
 *   Cookie holds only `<sessionId>.<identityType>.<hmac>` where `id` is checked in the `Session` table on every API call (`S3`).
 * - Single-use hashed `ActivationToken` (`crypto.randomBytes(32)`) built with `APP_BASE_URL` (`S9`, `G5`).
 * - Login & public-form rate limiter with temporary lockout after repeated failures (`S13`).
 */

export interface RprmSession {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  identityType: "coworker" | "partner";
  role: string;
  isMainContact?: boolean;
  partnerId?: string | null;
  partnerName?: string | null;
  impersonatingPartnerId?: string | null;
  mfaEnrolled?: boolean;
  mfaVerified?: boolean;
  issuedAt: number;
  expiresAt: number;
}

// §16.2 S5: Per-user random salt with scrypt
export function hashPasswordWithRandomSalt(plain: string): string {
  const saltHex = crypto.randomBytes(16).toString("hex");
  const keyHex = crypto.scryptSync(plain, saltHex, 32).toString("hex");
  return `scrypt:${saltHex}:${keyHex}`;
}

export function verifyPasswordWithStoredSalt(
  plain: string,
  storedHash: string
): boolean {
  if (!plain || !storedHash || !storedHash.startsWith("scrypt:")) {
    return false;
  }
  const parts = storedHash.split(":");
  if (parts.length !== 3) return false;
  const [, saltHex, expectedKeyHex] = parts;
  if (!saltHex || !expectedKeyHex) return false;
  try {
    const actualKey = crypto.scryptSync(plain, saltHex, 32);
    const expectedKey = Buffer.from(expectedKeyHex, "hex");
    if (actualKey.byteLength !== expectedKey.byteLength) return false;
    return crypto.timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

// Sign & parse cookie holding `<sessionId>.<identityType>.<hmac>`
export function signSessionCookieValue(
  sessionId: string,
  identityType: "coworker" | "partner",
  env: Record<string, string | undefined> = process.env
): string {
  const { sessionSecret } = loadRequiredConfig(env);
  const payload = `${sessionId}.${identityType}`;
  const sig = crypto
    .createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function parseAndVerifySessionCookieValue(
  cookieVal?: string | null,
  env: Record<string, string | undefined> = process.env
): { sessionId: string; identityType: "coworker" | "partner" } | null {
  if (!cookieVal) return null;
  const parts = cookieVal.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, identityType, sig] = parts;
  if (
    !sessionId ||
    (identityType !== "coworker" && identityType !== "partner") ||
    !sig
  ) {
    return null;
  }
  const { sessionSecret } = loadRequiredConfig(env);
  const expectedSig = crypto
    .createHmac("sha256", sessionSecret)
    .update(`${sessionId}.${identityType}`)
    .digest("base64url");
  if (sig !== expectedSig) return null;
  return { sessionId, identityType };
}

// §16.2 S3: Create, resolve, and revoke server-side Session rows
export async function createServerSessionRow(params: {
  userId: string;
  identityType: "coworker" | "partner";
  impersonatingPartnerId?: string | null;
  ttlMs?: number;
}): Promise<{ sessionRowId: string; cookieValue: string; expiresAt: Date }> {
  const sessionRowId = `sess_${crypto.randomBytes(24).toString("hex")}`;
  const ttlMs = params.ttlMs ?? 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.session.create({
    data: {
      id: sessionRowId,
      userId: params.userId,
      impersonatingPartnerId: params.impersonatingPartnerId || null,
      expiresAt,
    },
  });

  const cookieValue = signSessionCookieValue(
    sessionRowId,
    params.identityType
  );
  return { sessionRowId, cookieValue, expiresAt };
}

export async function revokeServerSessionById(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await prisma.session
    .update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    })
    .catch(() => {});
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  if (!userId) return;
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// §16.2 S3: Check session existence, revocation, and expiry against the PostgreSQL `Session` table on every request!
export async function getActiveServerSession(
  req: NextRequest
): Promise<RprmSession | null> {
  const rawCookie = req.cookies.get("rprm_session")?.value;
  const parsed = parseAndVerifySessionCookieValue(rawCookie);
  if (!parsed) {
    // Integrations: "Authorization: Bearer rprm_..." acts as the administrator who created the token
    const bearer = bearerTokenFrom(req.headers?.get?.("authorization"));
    if (!bearer) return null;
    const resolved = await resolveApiToken(bearer);
    if (!resolved) return null;
    if (
      process.env.NODE_ENV === "production" &&
      (resolved.user.isTestAccount || resolved.user.email.endsWith(".example.com"))
    ) {
      return null;
    }
    return {
      sessionId: `api-token:${resolved.row.id}`,
      userId: resolved.user.id,
      email: resolved.user.email,
      name: resolved.user.name,
      identityType: "coworker",
      role: resolved.user.role,
      isMainContact: false,
      partnerId: null,
      partnerName: null,
      impersonatingPartnerId: null,
      mfaEnrolled: false,
      mfaVerified: true,
      issuedAt: resolved.row.createdAt.getTime(),
      expiresAt: Date.now() + 60_000,
    };
  }

  const row = await prisma.session.findUnique({
    where: { id: parsed.sessionId },
    include: { user: true },
  });
  if (!row || !row.user) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.user.status === "Disabled") return null;

  // F4: Test accounts are ALWAYS blocked from signing in or holding active sessions in NODE_ENV=production (no opt-in flag)
  if (
    process.env.NODE_ENV === "production" &&
    (row.user.isTestAccount || row.user.email.endsWith(".example.com"))
  ) {
    return null;
  }

  let effectivePartnerId = row.user.partnerId || null;
  let effectivePartnerName = row.user.partnerName || null;
  if (row.impersonatingPartnerId) {
    const impPartner = await prisma.partner.findUnique({
      where: { id: row.impersonatingPartnerId },
    });
    if (impPartner) {
      effectivePartnerId = impPartner.id;
      effectivePartnerName = impPartner.name;
    }
  }

  return {
    sessionId: row.id,
    userId: row.user.id,
    email: row.user.email,
    name: row.user.name,
    identityType: row.user.identityType as "coworker" | "partner",
    role: row.user.role,
    isMainContact: row.user.isMainContact,
    partnerId: effectivePartnerId,
    partnerName: effectivePartnerName,
    impersonatingPartnerId: row.impersonatingPartnerId,
    mfaEnrolled: Boolean(
      row.user.mfaConfirmedAt && row.user.mfaSecret?.startsWith("enc:v1:")
    ),
    mfaVerified: true,
    issuedAt: row.createdAt.getTime(),
    expiresAt: row.expiresAt.getTime(),
  };
}

// §16.2 S13 & F7: Database-backed rate limiter for `/api/auth` and `/api/public-forms` (survives restarts)
interface RateLimitEntry {
  failures: number;
  lockedUntil: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_AUTH_FAILURES = 8;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function checkRateLimitKey(key: string): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
}> {
  const now = Date.now();
  const dbRow = await prisma.loginLockout
    .findUnique({ where: { key } })
    .catch(() => null);
  const memEntry = rateLimitStore.get(key);

  const lockedUntilMs = Math.max(
    dbRow?.lockedUntil ? dbRow.lockedUntil.getTime() : 0,
    memEntry?.lockedUntil ?? 0
  );

  if (lockedUntilMs > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((lockedUntilMs - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordAuthFailure(key: string): Promise<{
  lockedOut: boolean;
  failures: number;
}> {
  const now = Date.now();
  const dbRow = await prisma.loginLockout
    .findUnique({ where: { key } })
    .catch(() => null);
  const memEntry = rateLimitStore.get(key) || { failures: 0, lockedUntil: 0 };

  const currentFailures = Math.max(dbRow?.failures ?? 0, memEntry.failures);
  const nextFailures = currentFailures + 1;
  const lockedUntilMs =
    nextFailures >= MAX_AUTH_FAILURES ? now + LOCKOUT_DURATION_MS : 0;

  rateLimitStore.set(key, {
    failures: nextFailures,
    lockedUntil: lockedUntilMs,
  });

  await prisma.loginLockout
    .upsert({
      where: { key },
      update: {
        failures: nextFailures,
        lockedUntil: lockedUntilMs > 0 ? new Date(lockedUntilMs) : null,
      },
      create: {
        key,
        failures: nextFailures,
        lockedUntil: lockedUntilMs > 0 ? new Date(lockedUntilMs) : null,
      },
    })
    .catch(() => {});

  return { lockedOut: lockedUntilMs > now, failures: nextFailures };
}

export async function resetRateLimitKey(key: string): Promise<void> {
  rateLimitStore.delete(key);
  await prisma.loginLockout
    .deleteMany({ where: { key } })
    .catch(() => {});
}

/**
 * Simulate a server process restart by clearing the in-memory rate-limit cache,
 * so tests can prove that database-backed lockouts (F7) survive restarts.
 */
export function clearInMemoryRateLimitCache(): void {
  rateLimitStore.clear();
}

// §16.2 S5, S6, S7 & §16.3 G10: Authenticate strictly against the `User` table using exact normalized email match
export async function authenticateUserFromDatabase(
  emailInput: string,
  passwordInput: string,
  expectedSurface: "coworker" | "partner",
  clientIp = "127.0.0.1"
): Promise<
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        name: string;
        identityType: "coworker" | "partner";
        role: string;
        isMainContact: boolean;
        partnerId: string | null;
        partnerName: string | null;
      };
    }
  | { ok: false; error: string; status?: number }
> {
  const email = (emailInput || "").trim().toLowerCase();
  if (!email || !passwordInput) {
    return { ok: false, error: "Email and password are required", status: 400 };
  }

  const rateKey = `auth:${clientIp}:${email}`;
  const rateCheck = await checkRateLimitKey(rateKey);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      error: `Too many failed sign-in attempts. Account temporarily locked (${rateCheck.retryAfterSeconds}s remaining).`,
      status: 429,
    };
  }

  // Exact match on unique normalized User.email (S6 & S7)
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.identityType !== expectedSurface) {
    await recordAuthFailure(rateKey);
    return {
      ok: false,
      error: "Invalid email or password",
      status: 401,
    };
  }

  if (user.status !== "Active") {
    return {
      ok: false,
      error: "Account is not active. Complete your activation link first.",
      status: 403,
    };
  }

  // F4: Always block test accounts in production (no flag)
  if (
    process.env.NODE_ENV === "production" &&
    (user.isTestAccount || user.email.endsWith(".example.com"))
  ) {
    return {
      ok: false,
      error: "Synthetic test accounts are disabled in production",
      status: 403,
    };
  }

  if (!verifyPasswordWithStoredSalt(passwordInput, user.passwordHash)) {
    const failState = await recordAuthFailure(rateKey);
    return {
      ok: false,
      error: failState.lockedOut
        ? "Too many failed sign-in attempts. Account temporarily locked."
        : "Invalid email or password",
      status: failState.lockedOut ? 429 : 401,
    };
  }

  await resetRateLimitKey(rateKey);

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      identityType: user.identityType as "coworker" | "partner",
      role: user.role,
      isMainContact: user.isMainContact,
      partnerId: user.partnerId,
      partnerName: user.partnerName,
    },
  };
}

// §16.2 S9 & §16.3 G5: Single-use hashed activation token generator & redeemer
export function hashActivationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export async function issuePartnerActivationLink(params: {
  email: string;
  name: string;
  partnerId?: string | null;
  partnerName?: string | null;
  role?: string;
  ttlHours?: number;
  env?: Record<string, string | undefined>;
}): Promise<{
  rawToken: string;
  activationUrl: string;
  expiresAt: Date;
}> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashActivationToken(rawToken);
  const expiresAt = new Date(
    Date.now() + (params.ttlHours ?? 48) * 60 * 60 * 1000
  );

  await prisma.activationToken.create({
    data: {
      tokenHash,
      email: params.email.trim().toLowerCase(),
      name: params.name,
      partnerId: params.partnerId || null,
      partnerName: params.partnerName || null,
      role: params.role || "Manager",
      expiresAt,
    },
  });

  const baseUrl = getAppBaseUrl(params.env);
  return {
    rawToken,
    activationUrl: `${baseUrl}/p/activate?token=${rawToken}`,
    expiresAt,
  };
}

export async function inspectActivationToken(rawToken: string) {
  if (!rawToken || rawToken.length < 32) return null;
  const tokenHash = hashActivationToken(rawToken);
  const record = await prisma.activationToken.findUnique({
    where: { tokenHash },
  });
  if (!record) return { valid: false as const, reason: "Token not found" };
  if (record.usedAt) {
    return { valid: false as const, reason: "This activation link has already been used" };
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    return { valid: false as const, reason: "This activation link has expired" };
  }
  return {
    valid: true as const,
    email: record.email,
    name: record.name,
    partnerId: record.partnerId,
    partnerName: record.partnerName,
    role: record.role,
  };
}

export async function redeemActivationTokenAndSetPassword(
  rawToken: string,
  newPassword: string
): Promise<
  | { ok: true; user: { id: string; email: string; name: string; role: string; partnerId: string | null; partnerName: string | null } }
  | { ok: false; error: string }
> {
  if (!newPassword || newPassword.length < 8) {
    return {
      ok: false,
      error: "Password must be at least 8 characters long",
    };
  }
  const tokenHash = hashActivationToken(rawToken || "");
  const record = await prisma.activationToken.findUnique({
    where: { tokenHash },
  });
  if (!record) {
    return { ok: false, error: "Invalid activation token" };
  }
  if (record.usedAt) {
    return { ok: false, error: "This activation token has already been used" };
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: "This activation token has expired" };
  }

  const passwordHash = hashPasswordWithRandomSalt(newPassword);

  const [, user] = await prisma.$transaction([
    prisma.activationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.upsert({
      where: { email: record.email },
      update: {
        passwordHash,
        status: "Active",
        partnerId: record.partnerId,
        partnerName: record.partnerName,
        role: record.role,
      },
      create: {
        email: record.email,
        name: record.name,
        identityType: "partner",
        role: record.role,
        partnerId: record.partnerId,
        partnerName: record.partnerName,
        isMainContact: record.role === "Manager",
        passwordHash,
        status: "Active",
        isTestAccount: false,
      },
    }),
  ]);

  if (record.partnerId) {
    await prisma.partner
      .update({
        where: { id: record.partnerId },
        data: { portalAccess: true, status: "Active" },
      })
      .catch(() => {});
  }

  // Revoke any older sessions when password is changed (S3)
  await revokeAllUserSessions(user.id);

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      partnerId: user.partnerId,
      partnerName: user.partnerName,
    },
  };
}
