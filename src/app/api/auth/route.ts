import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateUserFromDatabase,
  checkRateLimitKey,
  createServerSessionRow,
  getActiveServerSession,
  inspectActivationToken,
  recordAuthFailure,
  redeemActivationTokenAndSetPassword,
  resetRateLimitKey,
  revokeServerSessionById,
} from "@/lib/authSession";
import {
  clearMfa,
  confirmPendingEnrollment,
  getOrCreatePendingEnrollment,
  isMfaConfirmed,
  regenerateRecoveryCodes,
  restartPendingEnrollment,
  verifyConfirmedMfaCode,
} from "@/lib/mfaFlow";
import { getCookieOptions } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const activateToken = searchParams.get("activateToken");

  if (activateToken) {
    const info = await inspectActivationToken(activateToken);
    if (!info || !info.valid) {
      return NextResponse.json(
        { valid: false, error: info?.reason || "Invalid activation token" },
        { status: 400 }
      );
    }
    return NextResponse.json(info);
  }

  const adminCount = await prisma.user.count({
    where: {
      identityType: "coworker",
      role: "Administrator",
      status: "Active",
    },
  });
  const needsSetup = adminCount === 0;

  let branding = {
    accountName: "R-PRM",
    logoText: "R",
    primaryColor: "#2563EB",
    portalDomain: "",
  };
  const acctRow = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  if (acctRow) {
    try {
      const parsed = JSON.parse(acctRow.valueJson);
      branding = {
        accountName: parsed.accountName || "R-PRM",
        logoText: parsed.logoText || "R",
        primaryColor: parsed.primaryColor || "#2563EB",
        portalDomain: parsed.portalDomain || "",
      };
    } catch {
      // ignore
    }
  }

  const showDevLogins =
    process.env.NODE_ENV !== "production" &&
    process.env.SHOW_DEV_LOGINS === "true";

  const session = await getActiveServerSession(req);
  if (!session) {
    return NextResponse.json(
      { authenticated: false, session: null, showDevLogins, needsSetup, branding },
      { status: 401 }
    );
  }
  return NextResponse.json({
    authenticated: true,
    session,
    showDevLogins,
    needsSetup,
    branding,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. Real Logout: revoke server-side Session row & delete cookie (§16.2 S2 & S3)
    if (action === "logout") {
      const current = await getActiveServerSession(req);
      if (current) {
        await revokeServerSessionById(current.sessionId);
        await prisma.auditLog.create({
          data: {
            actor: current.email,
            actorRole: `${current.identityType} (${current.role})`,
            action: "LOGOUT",
            objectType: "Session",
            objectId: current.sessionId,
            summary: `User ${current.email} signed out and revoked session ${current.sessionId}`,
          },
        });
      }
      const res = NextResponse.json({ ok: true });
      res.cookies.delete("rprm_session");
      return res;
    }

    // 2. Redeem Single-Use Activation Token & Set Password (§16.2 S9)
    if (action === "activate_account") {
      const redeemed = await redeemActivationTokenAndSetPassword(
        body.token,
        body.password
      );
      if (!redeemed.ok) {
        return NextResponse.json({ error: redeemed.error }, { status: 400 });
      }
      await prisma.auditLog.create({
        data: {
          actor: redeemed.user.email,
          actorRole: `partner (${redeemed.user.role})`,
          action: "ACTIVATE_ACCOUNT",
          objectType: "User",
          objectId: redeemed.user.id,
          summary: `Partner user ${redeemed.user.email} redeemed activation link and set password`,
        },
      });
      return NextResponse.json({ ok: true, user: redeemed.user });
    }

    // 3. Impersonate Partner (§4.4)
    if (action === "impersonate") {
      const current = await getActiveServerSession(req);
      if (!current || current.identityType !== "coworker") {
        return NextResponse.json(
          { error: "Only authenticated coworkers may impersonate a partner" },
          { status: 403 }
        );
      }
      const partner = await prisma.partner.findUnique({
        where: { id: body.partnerId },
      });
      if (!partner) {
        return NextResponse.json(
          { error: "Partner not found" },
          { status: 404 }
        );
      }
      await prisma.session.update({
        where: { id: current.sessionId },
        data: { impersonatingPartnerId: partner.id },
      });
      await prisma.auditLog.create({
        data: {
          actor: current.email,
          actorRole: `Coworker (${current.role})`,
          action: "IMPERSONATE",
          objectType: "PartnerPortal",
          objectId: partner.id,
          summary: `Coworker ${current.email} started impersonation session as "${partner.name}"`,
        },
      });
      return NextResponse.json({
        ok: true,
        session: {
          ...current,
          impersonatingPartnerId: partner.id,
          partnerId: partner.id,
          partnerName: partner.name,
        },
      });
    }

    // 4. Exit Impersonation
    if (action === "exit_impersonate") {
      const current = await getActiveServerSession(req);
      if (!current) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      await prisma.session.update({
        where: { id: current.sessionId },
        data: { impersonatingPartnerId: null },
      });
      return NextResponse.json({
        ok: true,
        session: {
          ...current,
          impersonatingPartnerId: null,
          partnerId: null,
          partnerName: null,
        },
      });
    }

    // 4b. Two-step login setup from the Security tab: start (or restart) a pending setup
    if (action === "enroll_mfa") {
      const current = await getActiveServerSession(req);
      if (!current) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const userRow = await prisma.user.findUnique({ where: { id: current.userId } });
      if (!userRow) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (isMfaConfirmed(userRow)) {
        return NextResponse.json(
          { error: "Two-step login is already set up. Turn it off first to set up a new device." },
          { status: 409 }
        );
      }
      const enrollment = await restartPendingEnrollment(userRow);
      await prisma.auditLog.create({
        data: {
          actor: current.email,
          actorRole: `${current.identityType} (${current.role})`,
          action: "MFA_SETUP_STARTED",
          objectType: "User",
          objectId: current.userId,
          summary: `Started two-step login setup for ${current.email}`,
        },
      });
      return NextResponse.json({ ok: true, mfaEnrolled: false, enrollment });
    }

    // 4b-ii. Confirm a pending setup with the first authenticator code; recovery codes are returned once
    if (action === "confirm_mfa") {
      const current = await getActiveServerSession(req);
      if (!current) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const userRow = await prisma.user.findUnique({ where: { id: current.userId } });
      if (!userRow) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const result = await confirmPendingEnrollment(userRow, String(body.code || ""));
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await prisma.auditLog.create({
        data: {
          actor: current.email,
          actorRole: `${current.identityType} (${current.role})`,
          action: "MFA_ENROLLED",
          objectType: "User",
          objectId: current.userId,
          summary: `Confirmed two-step login for ${current.email}`,
        },
      });
      return NextResponse.json({ ok: true, mfaEnrolled: true, recoveryCodes: result.recoveryCodes });
    }

    // 4b-iii. Replace recovery codes (requires a current authenticator code)
    if (action === "regenerate_recovery_codes") {
      const current = await getActiveServerSession(req);
      if (!current) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const userRow = await prisma.user.findUnique({ where: { id: current.userId } });
      if (!userRow) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const result = await regenerateRecoveryCodes(userRow, String(body.code || ""));
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await prisma.auditLog.create({
        data: {
          actor: current.email,
          actorRole: `${current.identityType} (${current.role})`,
          action: "MFA_RECOVERY_CODES_REGENERATED",
          objectType: "User",
          objectId: current.userId,
          summary: `Issued new recovery codes for ${current.email}`,
        },
      });
      return NextResponse.json({ ok: true, recoveryCodes: result.recoveryCodes });
    }

    // 4b-iv. Administrator resets another user's two-step login (lost phone)
    if (action === "admin_reset_mfa") {
      const current = await getActiveServerSession(req);
      if (!current) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      if (current.identityType !== "coworker" || current.role !== "Administrator") {
        return NextResponse.json({ error: "Only administrators can reset two-step login" }, { status: 403 });
      }
      const targetEmail = String(body.email || "").trim().toLowerCase();
      const target = await prisma.user.findUnique({ where: { email: targetEmail } });
      if (!target) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      await clearMfa(target.id);
      await prisma.session.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await prisma.auditLog.create({
        data: {
          actor: current.email,
          actorRole: `${current.identityType} (${current.role})`,
          action: "MFA_RESET_BY_ADMIN",
          objectType: "User",
          objectId: target.id,
          summary: `Administrator ${current.email} reset two-step login for ${target.email} and signed them out`,
        },
      });
      return NextResponse.json({ ok: true });
    }

    // 4c. Disable MFA for signed-in user (refused if workspace policy requires MFA)
    if (action === "disable_mfa") {
      const current = await getActiveServerSession(req);
      if (!current) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const acctRow = await prisma.appSetting.findUnique({
        where: { key: "account_settings" },
      });
      if (acctRow?.valueJson) {
        try {
          const acct = JSON.parse(acctRow.valueJson);
          if (
            (current.identityType === "coworker" && acct.requireMfaCoworkers) ||
            (current.identityType === "partner" && acct.requireMfaPartners)
          ) {
            return NextResponse.json(
              {
                error:
                  "Cannot disable MFA while workspace policy requires MFA for your role.",
              },
              { status: 400 }
            );
          }
        } catch {
          // ignore
        }
      }
      await clearMfa(current.userId);
      await prisma.auditLog.create({
        data: {
          actor: current.email,
          actorRole: `${current.identityType} (${current.role})`,
          action: "MFA_DISABLED",
          objectType: "User",
          objectId: current.userId,
          summary: `Disabled TOTP authenticator MFA for ${current.email}`,
        },
      });
      return NextResponse.json({ ok: true, mfaEnrolled: false });
    }

    // 5. Standard Login (Coworker or Partner User) with IP + Email Rate Limit (§16.2 S3, S5, S6, S7, S13)
    const surface = body.identityType === "partner" ? "partner" : "coworker";
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const authResult = await authenticateUserFromDatabase(
      body.email,
      body.password,
      surface,
      clientIp
    );

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    const userRow = await prisma.user.findUnique({
      where: { id: authResult.user.id },
    });
    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // F1: Enforce MFA when required by workspace settings (requireMfaCoworkers / requireMfaPartners), with zero fallback secrets
    let requireMfaForUser = false;
    const acctSettingRow = await prisma.appSetting.findUnique({
      where: { key: "account_settings" },
    });
    if (acctSettingRow?.valueJson) {
      try {
        const acct = JSON.parse(acctSettingRow.valueJson);
        if (surface === "coworker" && Boolean(acct.requireMfaCoworkers)) {
          requireMfaForUser = true;
        }
        if (surface === "partner" && Boolean(acct.requireMfaPartners)) {
          requireMfaForUser = true;
        }
      } catch {
        // ignore malformed setting
      }
    }

    // Two-step login: required by workspace policy, or switched on by the user themselves
    const mfaConfirmed = isMfaConfirmed(userRow);
    const mfaCode = String(body.mfaCode || "").trim();
    const mfaRateKey = `mfa:${userRow.email}`;
    let recoveryCodesToShow: string[] | undefined;
    let recoveryCodesLeft: number | undefined;

    if (requireMfaForUser || mfaConfirmed) {
      const mfaRate = await checkRateLimitKey(mfaRateKey);
      if (!mfaRate.allowed) {
        return NextResponse.json(
          {
            error: `Too many wrong codes. Try again in ${mfaRate.retryAfterSeconds}s.`,
          },
          { status: 429 }
        );
      }

      if (!mfaConfirmed) {
        // Setup required: show the same pending setup on every attempt until a valid code confirms it
        if (!mfaCode) {
          const enrollment = await getOrCreatePendingEnrollment(userRow);
          await prisma.auditLog.create({
            data: {
              actor: userRow.email,
              actorRole: `${userRow.identityType} (${userRow.role})`,
              action: "MFA_SETUP_SHOWN",
              objectType: "User",
              objectId: userRow.id,
              summary: `Two-step login setup shown at sign-in for ${userRow.email} (required by workspace policy)`,
            },
          });
          return NextResponse.json(
            {
              error:
                "Two-step login is required. Scan the QR code with your authenticator app, then enter the 6-digit code.",
              mfaEnrollmentRequired: true,
              enrollment,
            },
            { status: 403 }
          );
        }
        const confirmed = await confirmPendingEnrollment(userRow, mfaCode);
        if (!confirmed.ok) {
          const fail = await recordAuthFailure(mfaRateKey);
          const enrollment = await getOrCreatePendingEnrollment(userRow);
          return NextResponse.json(
            {
              error: fail.lockedOut
                ? "Too many wrong codes. Try again later."
                : confirmed.error,
              mfaEnrollmentRequired: true,
              enrollment,
            },
            { status: fail.lockedOut ? 429 : 401 }
          );
        }
        recoveryCodesToShow = confirmed.recoveryCodes;
        await prisma.auditLog.create({
          data: {
            actor: userRow.email,
            actorRole: `${userRow.identityType} (${userRow.role})`,
            action: "MFA_ENROLLED",
            objectType: "User",
            objectId: userRow.id,
            summary: `Confirmed two-step login at sign-in for ${userRow.email}`,
          },
        });
      } else {
        if (!mfaCode) {
          return NextResponse.json(
            {
              error: "Enter the 6-digit code from your authenticator app, or a recovery code.",
              mfaRequired: true,
            },
            { status: 401 }
          );
        }
        const check = await verifyConfirmedMfaCode(userRow, mfaCode);
        if (!check.valid) {
          const fail = await recordAuthFailure(mfaRateKey);
          return NextResponse.json(
            {
              error: fail.lockedOut
                ? "Too many wrong codes. Try again later."
                : "That code didn't match. Use a current authenticator code or an unused recovery code.",
              mfaRequired: true,
            },
            { status: fail.lockedOut ? 429 : 401 }
          );
        }
        if (check.method === "recovery") {
          recoveryCodesLeft = check.recoveryCodesLeft;
          await prisma.auditLog.create({
            data: {
              actor: userRow.email,
              actorRole: `${userRow.identityType} (${userRow.role})`,
              action: "MFA_RECOVERY_CODE_USED",
              objectType: "User",
              objectId: userRow.id,
              summary: `Recovery code used at sign-in for ${userRow.email} (${check.recoveryCodesLeft} left)`,
            },
          });
        }
      }
      await resetRateLimitKey(mfaRateKey);
    }

    const { sessionRowId, cookieValue, expiresAt } =
      await createServerSessionRow({
        userId: authResult.user.id,
        identityType: authResult.user.identityType,
      });

    await prisma.auditLog.create({
      data: {
        actor: authResult.user.email,
        actorRole: `${authResult.user.identityType} (${authResult.user.role})`,
        action: "AUTH",
        objectType: "Session",
        objectId: sessionRowId,
        summary: `Authenticated ${authResult.user.identityType} session ${sessionRowId} for ${authResult.user.email} (DB-assigned role: ${authResult.user.role})`,
      },
    });

    const sessionPayload = {
      sessionId: sessionRowId,
      userId: authResult.user.id,
      email: authResult.user.email,
      name: authResult.user.name,
      identityType: authResult.user.identityType,
      role: authResult.user.role,
      isMainContact: authResult.user.isMainContact,
      partnerId: authResult.user.partnerId,
      partnerName: authResult.user.partnerName,
      impersonatingPartnerId: null,
      mfaEnrolled: Boolean(recoveryCodesToShow) || mfaConfirmed,
      mfaVerified: true,
      issuedAt: Date.now(),
      expiresAt: expiresAt.getTime(),
    };

    const res = NextResponse.json({
      ok: true,
      session: sessionPayload,
      ...(recoveryCodesToShow ? { recoveryCodes: recoveryCodesToShow } : {}),
      ...(recoveryCodesLeft !== undefined ? { recoveryCodesLeft } : {}),
    });
    res.cookies.set("rprm_session", cookieValue, getCookieOptions(86400));
    return res;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
