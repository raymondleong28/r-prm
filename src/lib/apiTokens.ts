import crypto from "node:crypto";
import { prisma } from "./prisma";

// API access tokens for integrations (n8n, Zapier, scripts).
// Format: "rprm_" + 43 url-safe characters (32 random bytes). Only a SHA-256 hash is stored.

export const API_TOKEN_PREFIX = "rprm_";

export function hashApiToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function looksLikeApiToken(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^rprm_[A-Za-z0-9_-]{43}$/.test(raw);
}

export function bearerTokenFrom(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec((header || "").trim());
  return m && looksLikeApiToken(m[1]) ? m[1] : null;
}

export async function createApiToken(params: {
  name: string;
  createdById: string;
  createdByEmail: string;
}) {
  const raw = API_TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
  const row = await prisma.apiToken.create({
    data: {
      name: params.name.trim().slice(0, 80),
      prefix: raw.slice(0, 12),
      tokenHash: hashApiToken(raw),
      createdById: params.createdById,
      createdByEmail: params.createdByEmail,
    },
  });
  return { raw, row };
}

/** Returns the active token row and its creator, or null. Records last use. */
export async function resolveApiToken(raw: string) {
  if (!looksLikeApiToken(raw)) return null;
  const row = await prisma.apiToken.findUnique({ where: { tokenHash: hashApiToken(raw) } });
  if (!row || row.revokedAt) return null;
  const user = await prisma.user.findUnique({ where: { id: row.createdById } });
  if (!user || user.status !== "Active" || user.identityType !== "coworker" || user.role !== "Administrator") {
    return null;
  }
  const last = row.lastUsedAt?.getTime() || 0;
  if (Date.now() - last > 60_000) {
    await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  }
  return { row, user };
}

export function publicTokenView(row: {
  id: string;
  name: string;
  prefix: string;
  createdByEmail: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    status: row.revokedAt ? "Revoked" : "Active",
  };
}
