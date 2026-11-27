import crypto from "node:crypto";

// Standard authenticator-app two-step login (TOTP, RFC 6238 / RFC 4226).
// Secrets are random 160-bit keys shown to the user in base32 (RFC 4648),
// which is the format Google Authenticator, Microsoft Authenticator,
// 1Password and Apple Passwords expect.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
export const RECOVERY_CODE_COUNT = 8;

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 character in authenticator secret");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function isBase32Secret(secret: string): boolean {
  return /^[A-Z2-7]{16,}$/.test(secret);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** Formats a secret in groups of four for manual entry ("ABCD EFGH ..."). */
export function formatSetupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function totpCodeAtStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto
    .createHmac("sha1", base32Decode(secret))
    .update(counter)
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totpCodeAtTime(secret: string, unixSeconds: number): string {
  return totpCodeAtStep(secret, Math.floor(unixSeconds / TOTP_STEP_SECONDS));
}

export function currentTotpCode(secret: string): string {
  return totpCodeAtTime(secret, Date.now() / 1000);
}

/** Accepts the current code and one step either side for clock drift. */
export function verifyTotpCode(
  input: string,
  secret: string,
  nowSeconds = Date.now() / 1000
): boolean {
  const code = (input || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const step = Math.floor(nowSeconds / TOTP_STEP_SECONDS);
  for (const drift of [-1, 0, 1]) {
    const expected = totpCodeAtStep(secret, step + drift);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return true;
    }
  }
  return false;
}

export function buildOtpauthUri(
  issuer: string,
  accountEmail: string,
  secret: string
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// Recovery codes: independent random values, shown once, stored only as hashes.

function normaliseRecoveryCode(code: string): string {
  return (code || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return (
    "sha256:" +
    crypto.createHash("sha256").update(normaliseRecoveryCode(code)).digest("hex")
  );
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): {
  codes: string[];
  hashes: string[];
} {
  const codes = new Set<string>();
  while (codes.size < count) {
    const raw = base32Encode(crypto.randomBytes(7)).slice(0, 10);
    codes.add(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  const list = Array.from(codes);
  return { codes: list, hashes: list.map(hashRecoveryCode) };
}

/** Returns the remaining hashes when the code matches one stored hash. */
export function consumeRecoveryCode(
  input: string,
  storedHashes: string[]
): { valid: boolean; remainingHashes: string[] } {
  if (normaliseRecoveryCode(input).length !== 10) {
    return { valid: false, remainingHashes: storedHashes };
  }
  const candidate = hashRecoveryCode(input);
  const index = storedHashes.findIndex(
    (h) =>
      h.length === candidate.length &&
      crypto.timingSafeEqual(Buffer.from(h), Buffer.from(candidate))
  );
  if (index === -1) {
    return { valid: false, remainingHashes: storedHashes };
  }
  return {
    valid: true,
    remainingHashes: storedHashes.filter((_, i) => i !== index),
  };
}

export function parseStoredRecoveryHashes(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((h): h is string => typeof h === "string" && h.startsWith("sha256:"))
      : [];
  } catch {
    return [];
  }
}
