import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { loadRequiredConfig } from "./config";

/**
 * §13.2, §16.2 S1, S4, S8, S11, S12 & §16.3 G1, G2, G3:
 * Outside-Service Connectors (`local` vs `live`, Fail-Closed, Real SMTP & Private Disk Storage)
 */

export type EmailDriverMode = "local" | "smtp";
export type StorageDriverMode = "disk" | "s3";
export type PayoutDriverMode = "manual" | "wise" | "stripe";
export type HubSpotDriverMode = "mock" | "live";
export type FxDriverMode = "table" | "api";
export type SsoDriverMode = "local" | "saml";

export interface ConnectorEnvConfig {
  EMAIL_DRIVER: EmailDriverMode;
  STORAGE_DRIVER: StorageDriverMode;
  PAYOUT_DRIVER: PayoutDriverMode;
  HUBSPOT_DRIVER: HubSpotDriverMode;
  FX_DRIVER: FxDriverMode;
  SSO_DRIVER: SsoDriverMode;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM?: string;
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  PAYOUT_API_KEY?: string;
  HUBSPOT_PRIVATE_APP_TOKEN?: string;
  FX_API_KEY?: string;
  SAML_IDP_LOGIN_URL?: string;
  SAML_IDP_CERT?: string;
}

export function loadAndValidateConnectorConfig(
  env: Record<string, string | undefined> = process.env
): ConnectorEnvConfig {
  // Always enforce required SESSION_SECRET & BANK_ENCRYPTION_KEY when validating app startup (S1)
  if (env === process.env) {
    loadRequiredConfig(env);
  } else if (
    env.SESSION_SECRET !== undefined ||
    env.BANK_ENCRYPTION_KEY !== undefined
  ) {
    loadRequiredConfig({
      ...process.env,
      ...env,
    });
  }

  const cfg: ConnectorEnvConfig = {
    EMAIL_DRIVER: (env.EMAIL_DRIVER as EmailDriverMode) || "local",
    STORAGE_DRIVER: (env.STORAGE_DRIVER as StorageDriverMode) || "disk",
    PAYOUT_DRIVER: (env.PAYOUT_DRIVER as PayoutDriverMode) || "manual",
    HUBSPOT_DRIVER: (env.HUBSPOT_DRIVER as HubSpotDriverMode) || "mock",
    FX_DRIVER: (env.FX_DRIVER as FxDriverMode) || "table",
    SSO_DRIVER: (env.SSO_DRIVER as SsoDriverMode) || "local",
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS,
    EMAIL_FROM: env.EMAIL_FROM || "noreply@r-prm.local",
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_BUCKET: env.S3_BUCKET,
    S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
    PAYOUT_API_KEY: env.PAYOUT_API_KEY,
    HUBSPOT_PRIVATE_APP_TOKEN: env.HUBSPOT_PRIVATE_APP_TOKEN,
    FX_API_KEY: env.FX_API_KEY,
    SAML_IDP_LOGIN_URL: env.SAML_IDP_LOGIN_URL,
    SAML_IDP_CERT: env.SAML_IDP_CERT,
  };

  // §16.3 G2: EMAIL_DRIVER=smtp requires SMTP_HOST (supports Mailpit unauthenticated SMTP or authenticated SMTP)
  if (cfg.EMAIL_DRIVER === "smtp" && !cfg.SMTP_HOST && !cfg.SMTP_USER) {
    throw new Error(
      "FAIL_CLOSED: EMAIL_DRIVER=smtp requires SMTP_HOST (and SMTP_USER/SMTP_PASS for authenticated relays)"
    );
  }

  // §16.3 G1 & G3: Any live driver without a real live provider implementation or required credentials fails closed at startup!
  if (cfg.STORAGE_DRIVER === "s3") {
    throw new Error(
      "FAIL_CLOSED: STORAGE_DRIVER=s3 live S3/R2 provider is not enabled in local build (use STORAGE_DRIVER=disk)"
    );
  }
  if (cfg.PAYOUT_DRIVER === "wise" || cfg.PAYOUT_DRIVER === "stripe") {
    throw new Error(
      `FAIL_CLOSED: PAYOUT_DRIVER=${cfg.PAYOUT_DRIVER} live payout provider is not enabled without verified provider webhook/API (use PAYOUT_DRIVER=manual)`
    );
  }
  if (cfg.HUBSPOT_DRIVER === "live") {
    throw new Error(
      "FAIL_CLOSED: HUBSPOT_DRIVER=live is not enabled without a verified HubSpot Private App integration (use HUBSPOT_DRIVER=mock)"
    );
  }
  if (cfg.FX_DRIVER === "api") {
    throw new Error(
      "FAIL_CLOSED: FX_DRIVER=api exchange-rate API driver is not implemented yet (use FX_DRIVER=table)"
    );
  }
  if (cfg.SSO_DRIVER === "saml") {
    throw new Error(
      "FAIL_CLOSED: SSO_DRIVER=saml SAML 2.0 driver is not implemented yet (use SSO_DRIVER=local)"
    );
  }

  return cfg;
}

// §16.2 S11: HTML Escaping & Merge-Field Email Renderer
export function escapeHtml(unsafe: string): string {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderEscapedEmailHtml({
  subject,
  body,
  mergeFields = {},
}: {
  subject: string;
  body: string;
  mergeFields?: Record<string, string>;
}): { escapedSubject: string; escapedText: string; html: string } {
  let interpolatedSubject = String(subject || "");
  let interpolatedBody = String(body || "");

  for (const [key, val] of Object.entries(mergeFields)) {
    const token = `{{${key}}}`;
    interpolatedSubject = interpolatedSubject.split(token).join(String(val ?? ""));
    interpolatedBody = interpolatedBody.split(token).join(String(val ?? ""));
  }

  const escapedSubject = escapeHtml(interpolatedSubject);
  const escapedText = escapeHtml(interpolatedBody);
  const html = `<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
  <h2 style="color:#2563EB;margin-top:0;">${escapedSubject}</h2>
  <p style="color:#334155;line-height:1.6;white-space:pre-line;">${escapedText}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
  <span style="font-size:11px;color:#64748b;">Sent by R-PRM Partner Relationship Management Cloud</span>
</div>`;

  return { escapedSubject, escapedText, html };
}

// §16.3 G2: Unified Email Connector (`local` outbox vs `smtp` via nodemailer — works with Mailpit or authenticated SMTP)
export async function sendEmailViaConnector(
  params: {
    to: string;
    subject: string;
    body: string;
    mergeFields?: Record<string, string>;
  },
  env: Record<string, string | undefined> = process.env
): Promise<{
  driver: EmailDriverMode;
  delivered: boolean;
  escapedSubject: string;
  html: string;
  transportInfo: string;
}> {
  const cfg = loadAndValidateConnectorConfig(env);
  const rendered = renderEscapedEmailHtml({
    subject: params.subject,
    body: params.body,
    mergeFields: params.mergeFields,
  });

  if (cfg.EMAIL_DRIVER === "smtp") {
    const host = cfg.SMTP_HOST || "127.0.0.1";
    const port = cfg.SMTP_PORT || 1025;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth:
        cfg.SMTP_USER && cfg.SMTP_PASS
          ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }
          : undefined,
    });
    await transporter.sendMail({
      from: cfg.EMAIL_FROM || "noreply@r-prm.local",
      to: params.to,
      subject: rendered.escapedSubject,
      text: rendered.escapedText,
      html: rendered.html,
    });
    return {
      driver: "smtp",
      delivered: true,
      escapedSubject: rendered.escapedSubject,
      html: rendered.html,
      transportInfo: `Delivered via SMTP (${host}:${port})`,
    };
  }

  return {
    driver: "local",
    delivered: true,
    escapedSubject: rendered.escapedSubject,
    html: rendered.html,
    transportInfo: "Captured in Local Outbox (EMAIL_DRIVER=local)",
  };
}

// §16.2 S4 & §16.3 G3: Private Storage Connector (`disk` outside `public/`)
const PRIVATE_STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".csv",
  ".txt",
]);

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export async function storeFileViaConnector(
  input: {
    originalName: string;
    buffer: Buffer;
    mimeType?: string;
  },
  env: Record<string, string | undefined> = process.env
): Promise<{
  storageKey: string;
  downloadUrl: string;
  fileSizeLabel: string;
}> {
  loadAndValidateConnectorConfig(env);

  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds maximum allowed size of 15 MB");
  }

  const ext = path.extname(input.originalName || "").toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
    throw new Error(
      `File type "${ext || "unknown"}" is not permitted. Allowed types: PDF, images, Office documents, CSV, TXT.`
    );
  }

  await fs.mkdir(PRIVATE_STORAGE_ROOT, { recursive: true });
  const safeBase = path
    .basename(input.originalName, ext)
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${Date.now()}_${crypto
    .randomBytes(6)
    .toString("hex")}_${safeBase}${ext}`;
  const fullPath = path.join(PRIVATE_STORAGE_ROOT, storageKey);
  await fs.writeFile(fullPath, input.buffer);

  const sizeKb = Math.max(1, Math.round(input.buffer.byteLength / 1024));
  const fileSizeLabel =
    sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb} KB`;

  return {
    storageKey,
    downloadUrl: `/api/files/${encodeURIComponent(storageKey)}`,
    fileSizeLabel,
  };
}

export async function readFileViaConnector(
  storageKey: string,
  env: Record<string, string | undefined> = process.env
): Promise<{ buffer: Buffer; ext: string } | null> {
  loadAndValidateConnectorConfig(env);
  const cleanKey = path.basename(storageKey);
  const candidatePrivate = path.join(PRIVATE_STORAGE_ROOT, cleanKey);
  try {
    const buffer = await fs.readFile(candidatePrivate);
    return { buffer, ext: path.extname(cleanKey).toLowerCase() };
  } catch {
    return null;
  }
}

// HubSpot 10-Stage Connector Mapping (§6 & §13.4 & §16.3 G1)
export const HUBSPOT_10_STAGE_MAPPING: Record<string, string> = {
  "To Work On": "hs_to_work_on",
  "Appointment Scheduled": "appointmentscheduled",
  Holding: "hs_holding",
  "Discovery Stage": "qualifiedtobuy",
  "Presentation Stage": "presentationscheduled",
  "Quotation Stage": "decisionmakerboughtin",
  "Negotiation Stage": "contractsent",
  "Closing Stage": "hs_closing",
  "Closed Won": "closedwon",
  "Closed Lost": "closedlost",
};

export function syncDealToHubSpotConnector(
  deal: { id: string; name: string; stage: string; amountBase: number },
  env: Record<string, string | undefined> = process.env
) {
  const cfg = loadAndValidateConnectorConfig(env);
  const hsStage = HUBSPOT_10_STAGE_MAPPING[deal.stage] || "qualifiedtobuy";
  return {
    driver: cfg.HUBSPOT_DRIVER,
    hubspotDealId: `HS-${deal.id.toUpperCase()}`,
    mappedStage: hsStage,
    syncedAt: new Date().toISOString(),
  };
}

// Payout Connector Interface (§4.2, §13.4 & §16.3 G1)
export function executePayoutConnector(
  payout: { payoutNumber: string; partnerName: string; amountBase: number },
  env: Record<string, string | undefined> = process.env
) {
  const cfg = loadAndValidateConnectorConfig(env);
  return {
    driver: cfg.PAYOUT_DRIVER,
    settlementReference: `MANUAL-REF-${payout.payoutNumber}`,
    settledAt: new Date().toISOString(),
    status: "Paid" as const,
  };
}

// §16.2 S1 & S8: Bank Details At-Rest AES-256-GCM Encryption (no fallback key!)
function getDerivedBankKey(
  env: Record<string, string | undefined> = process.env
): Buffer {
  const { bankEncryptionKey } = loadRequiredConfig(env);
  return crypto.createHash("sha256").update(bankEncryptionKey, "utf8").digest();
}

export function encryptBankDetails(
  plainJson: string,
  env: Record<string, string | undefined> = process.env
): string {
  if (!plainJson) return "";
  if (plainJson.startsWith("enc:v1:")) return plainJson;
  const key = getDerivedBankKey(env);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainJson, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString(
    "hex"
  )}`;
}

export function decryptBankDetails(
  stored: string,
  env: Record<string, string | undefined> = process.env
): string {
  if (!stored || !stored.startsWith("enc:v1:")) return stored || "{}";
  try {
    const key = getDerivedBankKey(env);
    const [, , ivHex, tagHex, dataHex] = stored.split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "{}";
  }
}

// RFC 6238 TOTP Authenticator MFA + One-Time Recovery Codes (§13.3 Slice 8 & §14.2 Slice 6 — No SMS)
export function enrollTotpMfa(email: string, issuer = "R-PRM Enterprise") {
  const randomSeed = crypto.randomBytes(10).toString("hex").toUpperCase();
  const recoveryCodes = [
    `RPRM-${randomSeed.slice(0, 4)}-${randomSeed.slice(4, 8)}`,
    `RPRM-${randomSeed.slice(8, 12)}-${randomSeed.slice(12, 16)}`,
    `RPRM-${randomSeed.slice(2, 6)}-${randomSeed.slice(10, 14)}`,
    `RPRM-${randomSeed.slice(6, 10)}-${randomSeed.slice(14, 18)}`,
  ];
  const otpauthUri = `otpauth://totp/${encodeURIComponent(
    issuer
  )}:${encodeURIComponent(email)}?secret=${randomSeed}&issuer=${encodeURIComponent(
    issuer
  )}&algorithm=SHA1&digits=6&period=30`;
  return {
    secret: randomSeed,
    recoveryCodes,
    otpauthUri,
  };
}

export function generateTotpCode(
  secret: string,
  timeStep = Math.floor(Date.now() / 30000)
): string {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(timeStep));
  const hmac = crypto
    .createHmac("sha1", Buffer.from(secret, "utf8"))
    .update(buf)
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

export function verifyTotpOrRecoveryCode(
  inputCode: string,
  secret: string,
  validRecoveryCodes: string[] = [],
  consumedRecoveryCodes?: Set<string>
): {
  valid: boolean;
  method: "totp" | "recovery" | "invalid";
  remainingRecoveryCodes: string[];
} {
  const cleaned = (inputCode || "").trim();
  if (validRecoveryCodes.includes(cleaned)) {
    if (consumedRecoveryCodes && consumedRecoveryCodes.has(cleaned)) {
      return {
        valid: false,
        method: "invalid",
        remainingRecoveryCodes: validRecoveryCodes.filter(
          (c) => c !== cleaned && !consumedRecoveryCodes.has(c)
        ),
      };
    }
    if (consumedRecoveryCodes) {
      consumedRecoveryCodes.add(cleaned);
    }
    return {
      valid: true,
      method: "recovery",
      remainingRecoveryCodes: validRecoveryCodes.filter(
        (c) => c !== cleaned && !(consumedRecoveryCodes?.has(c) ?? false)
      ),
    };
  }
  const nowStep = Math.floor(Date.now() / 30000);
  for (const offset of [-1, 0, 1]) {
    if (generateTotpCode(secret, nowStep + offset) === cleaned) {
      return {
        valid: true,
        method: "totp",
        remainingRecoveryCodes: validRecoveryCodes.filter(
          (c) => !(consumedRecoveryCodes?.has(c) ?? false)
        ),
      };
    }
  }
  return {
    valid: false,
    method: "invalid",
    remainingRecoveryCodes: validRecoveryCodes.filter(
      (c) => !(consumedRecoveryCodes?.has(c) ?? false)
    ),
  };
}
