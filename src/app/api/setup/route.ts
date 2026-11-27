import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createServerSessionRow,
  hashPasswordWithRandomSalt,
} from "@/lib/authSession";
import { getCookieOptions } from "@/lib/config";
import { DEFAULT_COMMISSION_TEMPLATES } from "@/lib/prmEngine";

export const dynamic = "force-dynamic";

async function isWorkspaceSetupRequired(): Promise<boolean> {
  const adminCount = await prisma.user.count({
    where: {
      identityType: "coworker",
      role: "Administrator",
      status: "Active",
    },
  });
  return adminCount === 0;
}

export async function GET() {
  const needsSetup = await isWorkspaceSetupRequired();
  return NextResponse.json({
    needsSetup,
    requireSetupToken: process.env.NODE_ENV === "production",
  });
}

export async function POST(req: NextRequest) {
  try {
    const needsSetup = await isWorkspaceSetupRequired();
    if (!needsSetup) {
      return NextResponse.json(
        {
          error:
            "First-run setup is permanently disabled because an Administrator account already exists.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      setupToken,
      workspaceName,
      timezone,
      mainCurrency,
      logoText,
      primaryColor,
      portalDomain,
      adminName,
      adminEmail,
      adminPassword,
    } = body;

    if (process.env.NODE_ENV === "production") {
      const expectedToken = (process.env.SETUP_TOKEN || "").trim();
      if (!expectedToken) {
        return NextResponse.json(
          {
            error:
              "FAIL_CLOSED: SETUP_TOKEN is not configured in the production environment.",
          },
          { status: 503 }
        );
      }
      if (!setupToken || String(setupToken).trim() !== expectedToken) {
        return NextResponse.json(
          { error: "Invalid or missing one-time SETUP_TOKEN" },
          { status: 403 }
        );
      }
    }

    const cleanWorkspaceName = String(workspaceName || "").trim();
    const cleanAdminName = String(adminName || "").trim();
    const cleanAdminEmail = String(adminEmail || "")
      .trim()
      .toLowerCase();
    const cleanPassword = String(adminPassword || "");
    const cleanCurrency = String(mainCurrency || "")
      .trim()
      .toUpperCase();

    if (
      !cleanWorkspaceName ||
      !cleanAdminName ||
      !cleanAdminEmail ||
      !cleanCurrency
    ) {
      return NextResponse.json(
        {
          error:
            "Workspace name, main currency, administrator name, and administrator email are required.",
        },
        { status: 400 }
      );
    }
    if (cleanPassword.length < 8) {
      return NextResponse.json(
        { error: "Administrator password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const workspaceSlug =
      cleanWorkspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "r-prm-workspace";

    const passwordHash = hashPasswordWithRandomSalt(cleanPassword);

    const [firstName, ...restNames] = cleanAdminName.split(/\s+/);
    const lastName = restNames.join(" ") || "";

    const cleanTimezone = String(timezone || "UTC").trim();

    const adminUser = await prisma.$transaction(async (tx) => {
      const existingAdmins = await tx.user.count({
        where: {
          identityType: "coworker",
          role: "Administrator",
          status: "Active",
        },
      });
      if (existingAdmins > 0) {
        throw new Error("SETUP_ALREADY_COMPLETED");
      }

      const createdUser = await tx.user.create({
        data: {
          email: cleanAdminEmail,
          name: cleanAdminName,
          identityType: "coworker",
          role: "Administrator",
          passwordHash,
          status: "Active",
          isTestAccount: false,
        },
      });

      const accountSettingsPayload = {
        accountName: cleanWorkspaceName,
        workspaceId: `ws_${workspaceSlug}`,
        workspaceSlug,
        timezone: cleanTimezone,
        mainCurrency: cleanCurrency,
        multiCurrency: true,
        logoText:
          String(logoText || cleanWorkspaceName.charAt(0) || "R")
            .trim()
            .slice(0, 2)
            .toUpperCase() || "R",
        primaryColor: String(primaryColor || "#2563EB").trim(),
        portalDomain: String(
          portalDomain || `https://partners.${workspaceSlug}.local`
        ).trim(),
        directorySubdomain: workspaceSlug,
        defaultOwnerId: createdUser.id,
        defaultOwnerName: cleanAdminName,
        legalEntityName: "",
        taxId: "",
        billingAddress: "",
        leadConsentText:
          "I confirm I have obtained permission from this prospect to share their business contact details with {{workspace.name}}.",
        leadConsentTermsLabel: "Terms & Privacy Policy",
        leadConsentTermsUrl: "",
        requireMfaCoworkers: false,
        requireMfaPartners: false,
        ssoEnabledCoworkers: false,
        ssoEnabledPartners: false,
        dealExpirationDays: 90,
        dealReminderDays: 14,
        autoAssociateCustomers: true,
        conflictDetection:
          "Warn on duplicate email or company domain across Leads, Deals, and Customers",
        validationStrategy: "Partner Owner or Administrator",
        autoPayoutSchedule: "Monthly (1st business day)",
        autoPayoutThresholdBase: 250,
        payoutProviders: ["Manual"],
        selfInvoicingEnabled: true,
      };

      const userPrefsPayload = {
        firstName: firstName || cleanAdminName,
        lastName,
        email: cleanAdminEmail,
        jobTitle: "Workspace Administrator",
        phone: "",
        calendarLink: "",
        language: "English (US)",
        timezone: cleanTimezone,
        mfaEnabled: false,
        googleCalendarConnected: false,
        notifications: {
          "New Lead Submitted by Partner": { inApp: true, email: true },
          "Shared Lead Accepted or Refused": { inApp: true, email: true },
          "New Deal Registered": { inApp: true, email: true },
          "Deal Stage Updated": { inApp: true, email: false },
          "Deal Expiring Soon": { inApp: true, email: true },
          "New Partner Application": { inApp: true, email: true },
          "Reward Pending Validation": { inApp: true, email: false },
          "Account Overlap Detected": { inApp: true, email: true },
        },
      };

      await tx.appSetting.upsert({
        where: { key: "account_settings" },
        update: { valueJson: JSON.stringify(accountSettingsPayload) },
        create: {
          key: "account_settings",
          valueJson: JSON.stringify(accountSettingsPayload),
        },
      });

      await tx.appSetting.upsert({
        where: { key: "user_preferences" },
        update: { valueJson: JSON.stringify(userPrefsPayload) },
        create: {
          key: "user_preferences",
          valueJson: JSON.stringify(userPrefsPayload),
        },
      });

      await tx.manageItem.create({
        data: {
          category: "team",
          name: cleanAdminName,
          subtitle: `${cleanAdminEmail} · Workspace Administrator`,
          status: "Administrator",
          metadataJson: JSON.stringify({
            userId: createdUser.id,
            email: cleanAdminEmail,
            role: "Administrator",
            invitation: "Accepted",
          }),
        },
      });

      await tx.manageItem.create({
        data: {
          category: "onboarding_pipelines",
          name: "Default Onboarding",
          subtitle: "Kickoff, Enablement, Active",
          status: "Active",
          metadataJson: JSON.stringify({
            stages: ["Kickoff", "Enablement", "Active"],
            stageActions: [],
          }),
        },
      });

      for (const tpl of Object.values(DEFAULT_COMMISSION_TEMPLATES)) {
        await tx.manageItem.create({
          data: {
            category: "commission_templates",
            name: tpl.title,
            subtitle: `${tpl.amountMode} · ${tpl.duration}`,
            status: "Active",
            metadataJson: JSON.stringify({
              ...tpl,
              currency: cleanCurrency,
            }),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actor: cleanAdminEmail,
          actorRole: "coworker (Administrator)",
          action: "WORKSPACE_SETUP",
          objectType: "Workspace",
          objectId: accountSettingsPayload.workspaceId,
          summary: `Initialised workspace "${cleanWorkspaceName}" (${cleanCurrency}) and created first Administrator ${cleanAdminEmail}`,
        },
      });

      return { createdUser, accountSettingsPayload };
    });

    const { sessionRowId, cookieValue, expiresAt } =
      await createServerSessionRow({
        userId: adminUser.createdUser.id,
        identityType: "coworker",
      });

    const res = NextResponse.json({
      ok: true,
      workspace: adminUser.accountSettingsPayload,
      session: {
        sessionId: sessionRowId,
        userId: adminUser.createdUser.id,
        email: adminUser.createdUser.email,
        name: adminUser.createdUser.name,
        identityType: "coworker",
        role: "Administrator",
        mfaEnrolled: false,
        issuedAt: Date.now(),
        expiresAt: expiresAt.getTime(),
      },
    });
    res.cookies.set("rprm_session", cookieValue, getCookieOptions(86400));
    return res;
  } catch (error) {
    if (String(error).includes("SETUP_ALREADY_COMPLETED")) {
      return NextResponse.json(
        {
          error:
            "First-run setup is permanently disabled because an Administrator account already exists.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
