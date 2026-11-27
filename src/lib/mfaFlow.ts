import QRCode from "qrcode";
import { prisma } from "./prisma";
import { decryptBankDetails, encryptBankDetails } from "./connectors";
import {
  buildOtpauthUri,
  consumeRecoveryCode,
  formatSetupKey,
  generateRecoveryCodes,
  generateTotpSecret,
  isBase32Secret,
  parseStoredRecoveryHashes,
  verifyTotpCode,
} from "./mfa";

// Database side of two-step login.
// States: none -> pending (secret saved, not yet proven) -> confirmed.
// A pending setup is shown again on every attempt until a valid code confirms it,
// so refreshing the page never locks anyone out.

type MfaUserRow = {
  id: string;
  email: string;
  mfaSecret: string | null;
  mfaConfirmedAt: Date | null;
  recoveryCodesJson: string;
};

export type MfaEnrollmentView = {
  otpauthUri: string;
  setupKey: string;
  qrDataUrl: string;
  issuer: string;
};

/** Decrypts a stored secret; returns null for missing or legacy (non-standard) secrets. */
export function readStoredSecret(stored: string | null | undefined): string | null {
  if (!stored || !stored.startsWith("enc:v1:")) return null;
  const plain = decryptBankDetails(stored);
  return isBase32Secret(plain) ? plain : null;
}

export function isMfaConfirmed(user: Pick<MfaUserRow, "mfaSecret" | "mfaConfirmedAt">): boolean {
  return Boolean(user.mfaConfirmedAt && readStoredSecret(user.mfaSecret));
}

export async function getWorkspaceIssuer(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: "account_settings" } });
  if (row?.valueJson) {
    try {
      const name = String(JSON.parse(row.valueJson).accountName || "").trim();
      if (name) return name;
    } catch {
      // fall through
    }
  }
  return "R-PRM";
}

async function buildEnrollmentView(email: string, secret: string): Promise<MfaEnrollmentView> {
  const issuer = await getWorkspaceIssuer();
  const otpauthUri = buildOtpauthUri(issuer, email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 });
  return { otpauthUri, setupKey: formatSetupKey(secret), qrDataUrl, issuer };
}

/** Returns the user's pending setup, creating one if none exists. Never touches a confirmed setup. */
export async function getOrCreatePendingEnrollment(user: MfaUserRow): Promise<MfaEnrollmentView> {
  if (isMfaConfirmed(user)) {
    throw new Error("Two-step login is already set up for this account");
  }
  let secret = readStoredSecret(user.mfaSecret);
  if (!secret) {
    secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: encryptBankDetails(secret),
        mfaConfirmedAt: null,
        recoveryCodesJson: "[]",
      },
    });
  }
  return buildEnrollmentView(user.email, secret);
}

/** Starts a fresh setup from the Security tab (replaces any pending one). */
export async function restartPendingEnrollment(user: MfaUserRow): Promise<MfaEnrollmentView> {
  if (isMfaConfirmed(user)) {
    throw new Error("Two-step login is already set up for this account");
  }
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: encryptBankDetails(secret), mfaConfirmedAt: null, recoveryCodesJson: "[]" },
  });
  return buildEnrollmentView(user.email, secret);
}

/** Confirms a pending setup with a valid authenticator code; returns recovery codes to show once. */
export async function confirmPendingEnrollment(
  user: MfaUserRow,
  code: string
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  if (isMfaConfirmed(user)) {
    return { ok: false, error: "Two-step login is already set up for this account" };
  }
  const secret = readStoredSecret(user.mfaSecret);
  if (!secret) {
    return { ok: false, error: "No two-step setup in progress. Start setup again." };
  }
  if (!verifyTotpCode(code, secret)) {
    return { ok: false, error: "That code didn't match. Check your authenticator app and try again." };
  }
  const recovery = generateRecoveryCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaConfirmedAt: new Date(), recoveryCodesJson: JSON.stringify(recovery.hashes) },
  });
  return { ok: true, recoveryCodes: recovery.codes };
}

/** Checks a code for a confirmed setup: authenticator code, or a one-time recovery code. */
export async function verifyConfirmedMfaCode(
  user: MfaUserRow,
  code: string
): Promise<{ valid: boolean; method: "totp" | "recovery" | "invalid"; recoveryCodesLeft: number }> {
  const secret = readStoredSecret(user.mfaSecret);
  const hashes = parseStoredRecoveryHashes(user.recoveryCodesJson);
  if (!secret || !user.mfaConfirmedAt) {
    return { valid: false, method: "invalid", recoveryCodesLeft: hashes.length };
  }
  if (verifyTotpCode(code, secret)) {
    return { valid: true, method: "totp", recoveryCodesLeft: hashes.length };
  }
  const recovery = consumeRecoveryCode(code, hashes);
  if (recovery.valid) {
    await prisma.user.update({
      where: { id: user.id },
      data: { recoveryCodesJson: JSON.stringify(recovery.remainingHashes) },
    });
    return { valid: true, method: "recovery", recoveryCodesLeft: recovery.remainingHashes.length };
  }
  return { valid: false, method: "invalid", recoveryCodesLeft: hashes.length };
}

/** Issues a new set of recovery codes (old ones stop working). Requires a valid authenticator code. */
export async function regenerateRecoveryCodes(
  user: MfaUserRow,
  code: string
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const secret = readStoredSecret(user.mfaSecret);
  if (!secret || !user.mfaConfirmedAt) {
    return { ok: false, error: "Two-step login is not set up" };
  }
  if (!verifyTotpCode(code, secret)) {
    return { ok: false, error: "Enter a current code from your authenticator app" };
  }
  const recovery = generateRecoveryCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { recoveryCodesJson: JSON.stringify(recovery.hashes) },
  });
  return { ok: true, recoveryCodes: recovery.codes };
}

export async function clearMfa(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: null, mfaConfirmedAt: null, recoveryCodesJson: "[]" },
  });
}
