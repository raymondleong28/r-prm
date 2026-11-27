import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateUserFromDatabase,
  createServerSessionRow,
  getActiveServerSession,
  inspectActivationToken,
  redeemActivationTokenAndSetPassword,
  revokeServerSessionById,
} from "@/lib/authSession";
import {
  enrollTotpMfa,
  verifyTotpOrRecoveryCode,
} from "@/lib/connectors";
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

    // 4b. Interactive Authenticator MFA Enrolment from Security Tab (§3.5.1: display secret only during enrolment)
    if (action === "enroll_mfa") {
      const current = await getActiveServerSession(req);
      if (!current) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const acctRow = await prisma.appSetting.findUnique({
        where: { key: "account_settings" },
      });
      let issuerName = "R-PRM";
      if (acctRow?.valueJson) {
        try {
          issuerName = JSON.parse(acctRow.valueJson).accountName || "R-PRM";
        } catch {
          // ignore
        }
      }
      const enrolled = enrollTotpMfa(current.email, issuerName);
      await prisma.user.update({
        where: { id: current.userId },
        data: {
          mfaSecret: enrolled.secret,
          recoveryCodesJson: JSON.stringify(enrolled.recoveryCodes),
        },
      });
      await prisma.auditLog.create({
        data: {
          actor: current.email,
          actorRole: `${current.identityType} (${current.role})`,
          action: "MFA_ENROLLED",
          objectType: "User",
          objectId: current.userId,
          summary: `Enrolled TOTP authenticator MFA for ${current.email}`,
        },
      });
      return NextResponse.json({
        ok: true,
        mfaEnrolled: true,
        enrollment: {
          secret: enrolled.secret,
          otpauthUri: enrolled.otpauthUri,
          recoveryCodes: enrolled.recoveryCodes,
        },
      });
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
      await prisma.user.update({
        where: { id: current.userId },
        data: {
          mfaSecret: null,
          recoveryCodesJson: "[]",
        },
      });
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

    if (requireMfaForUser && !userRow.mfaSecret) {
      // First-login MFA enrolment when required by workspace policy
      const enrolled = enrollTotpMfa(userRow.email);
      await prisma.user.update({
        where: { id: userRow.id },
        data: {
          mfaSecret: enrolled.secret,
          recoveryCodesJson: JSON.stringify(enrolled.recoveryCodes),
        },
      });
      await prisma.auditLog.create({
        data: {
          actor: userRow.email,
          actorRole: `${userRow.identityType} (${userRow.role})`,
          action: "MFA_ENROLLMENT_ISSUED",
          objectType: "User",
          objectId: userRow.id,
          summary: `Issued first-login MFA enrollment for ${userRow.email} because MFA is required by workspace policy`,
        },
      });
      return NextResponse.json(
        {
          error:
            "Multi-factor authentication is required. Enroll your authenticator app and enter the 6-digit code to sign in.",
          mfaEnrollmentRequired: true,
          enrollment: {
            otpauthUri: enrolled.otpauthUri,
            recoveryCodes: enrolled.recoveryCodes,
          },
        },
        { status: 403 }
      );
    }

    if (requireMfaForUser && !body.mfaCode) {
      return NextResponse.json(
        {
          error:
            "Multi-factor authentication code is required by workspace security policy.",
          mfaRequired: true,
        },
        { status: 401 }
      );
    }

    if (body.mfaCode) {
      if (!userRow.mfaSecret) {
        return NextResponse.json(
          {
            error:
              "MFA is not enrolled on this account. Enroll an authenticator first.",
          },
          { status: 401 }
        );
      }
      const recoveryCodes: string[] = userRow.recoveryCodesJson
        ? JSON.parse(userRow.recoveryCodesJson)
        : [];
      const mfaCheck = verifyTotpOrRecoveryCode(
        body.mfaCode,
        userRow.mfaSecret,
        recoveryCodes
      );
      if (!mfaCheck.valid) {
        return NextResponse.json(
          { error: "Invalid TOTP authenticator or recovery code" },
          { status: 401 }
        );
      }
      if (mfaCheck.method === "recovery") {
        await prisma.user.update({
          where: { id: userRow.id },
          data: {
            recoveryCodesJson: JSON.stringify(mfaCheck.remainingRecoveryCodes),
          },
        });
      }
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
      mfaEnrolled: Boolean(userRow.mfaSecret),
      mfaVerified: true,
      issuedAt: Date.now(),
      expiresAt: expiresAt.getTime(),
    };

    const res = NextResponse.json({ ok: true, session: sessionPayload });
    res.cookies.set("rprm_session", cookieValue, getCookieOptions(86400));
    return res;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
