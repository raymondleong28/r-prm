import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolvePartnerByLeadFormToken,
  generateRandomLeadFormToken,
  resolveExplicitProgramAndPipeline,
  SUPPORTED_CURRENCIES,
} from "@/lib/prmEngine";
import { checkRateLimitKey, recordAuthFailure } from "@/lib/authSession";
import { encryptBankDetails } from "@/lib/connectors";

export const dynamic = "force-dynamic";

async function loadPublicWorkspaceMeta() {
  const row = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let acct: Record<string, any> = {};
  if (row?.valueJson) {
    try {
      acct = JSON.parse(row.valueJson);
    } catch {
      acct = {};
    }
  }
  const accountName = String(acct.accountName || "Workspace");
  const rawConsent = String(
    acct.leadConsentText ||
      "I confirm I have obtained permission from this prospect to share their business contact details with {{workspace.name}}."
  );
  return {
    accountName,
    logoText: String(acct.logoText || accountName.charAt(0) || "R")
      .slice(0, 2)
      .toUpperCase(),
    primaryColor: String(acct.primaryColor || "#2563EB"),
    mainCurrency: String(acct.mainCurrency || SUPPORTED_CURRENCIES[0]),
    leadConsentText: rawConsent.split("{{workspace.name}}").join(accountName),
    leadConsentTermsLabel: String(
      acct.leadConsentTermsLabel || "Terms & Privacy Policy"
    ),
    leadConsentTermsUrl: String(acct.leadConsentTermsUrl || ""),
  };
}

// Public, unauthenticated endpoint ONLY for:
// 1. Validating an unguessable partner lead form token (/forms/lead/[token])
// 2. Validating a program ID for public application (/forms/apply/[programId])
// 3. Submitting a public referral lead (requires workspace consent checkbox) or partner application
export async function GET(req: NextRequest) {
  try {
    const leadToken = req.nextUrl.searchParams.get("leadToken");
    const programId = req.nextUrl.searchParams.get("programId");
    const workspace = await loadPublicWorkspaceMeta();

    if (leadToken) {
      const partners = await prisma.partner.findMany();
      const matched = resolvePartnerByLeadFormToken(leadToken, partners);
      if (!matched) {
        return NextResponse.json(
          {
            valid: false,
            lookupStatus: "not_found",
            reason: "This link isn't valid",
            workspace,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        valid: true,
        lookupStatus: "found",
        workspace,
        partner: {
          id: matched.id,
          name: matched.name,
          programName: matched.programName,
          leadFormToken: leadToken,
        },
      });
    }

    if (programId) {
      const prog = await prisma.program.findUnique({
        where: { id: programId },
      });
      if (!prog) {
        return NextResponse.json(
          {
            valid: false,
            lookupStatus: "not_found",
            reason: "Program not found",
            workspace,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        valid: true,
        lookupStatus: "found",
        workspace,
        program: {
          id: prog.id,
          name: prog.name,
          termsRequired: prog.termsRequired,
          termsUrl: prog.termsUrl,
        },
      });
    }

    return NextResponse.json(
      { valid: false, reason: "Missing query parameter", workspace },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { valid: false, lookupStatus: "could_not_check", reason: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rateKey = `public_form:${clientIp}`;
    const rateCheck = await checkRateLimitKey(rateKey);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded for public form submissions. Retry in ${rateCheck.retryAfterSeconds}s.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { formType } = body;
    const payload = body.payload || body.data || {};
    const workspace = await loadPublicWorkspaceMeta();

    if (formType === "public_lead") {
      if (!payload?.consentConfirmed && !payload?.consentTerms72) {
        await recordAuthFailure(rateKey);
        return NextResponse.json(
          {
            error:
              "Prospect data consent is required before submitting a lead.",
          },
          { status: 400 }
        );
      }
      const partners = await prisma.partner.findMany();
      const matched = resolvePartnerByLeadFormToken(payload.token, partners);
      if (!matched) {
        await recordAuthFailure(rateKey);
        return NextResponse.json(
          { error: "This link isn't valid" },
          { status: 404 }
        );
      }

      const lead = await prisma.lead.create({
        data: {
          firstName: String(payload.firstName || "").trim(),
          lastName: String(payload.lastName || "").trim(),
          company: String(payload.company || "").trim(),
          jobTitle: String(payload.jobTitle || "").trim(),
          email: String(payload.email || "").trim(),
          phone: String(payload.phone || "").trim(),
          country: String(payload.country || "").trim(),
          retailBrand: String(payload.retailBrand || payload.company || "").trim(),
          outletsCount: Number(payload.outletsCount) || 0,
          website: String(payload.website || "").trim(),
          posSolution: String(payload.posSolution || "").trim(),
          remarks: `${payload.remarks || ""} [Consent verified: ${workspace.leadConsentTermsLabel}]`.trim(),
          status: "Pending",
          ownerId: matched.ownerId || null,
          owner: matched.owner || "",
          source: "Public Partner Lead Form",
          sourcePartnerId: matched.id,
          sourcePartnerName: matched.name,
          assignedPartner: matched.name,
          assignedContact: `${matched.contactFirstName} ${matched.contactLastName}`.trim(),
          assignedDate: new Date().toISOString().slice(0, 10),
        },
      });

      await prisma.auditLog.create({
        data: {
          actor: lead.email,
          actorRole: "Public Lead Form",
          action: "CREATE",
          objectType: "Lead",
          objectId: lead.id,
          summary: `Public referral lead "${lead.firstName} ${lead.lastName}" (${lead.company}) submitted via token for ${matched.name} with verified consent`,
        },
      });

      return NextResponse.json({ ok: true, lead });
    }

    if (formType === "public_application") {
      const allPrograms = await prisma.program.findMany();
      let resolved: {
        programId: string;
        programName: string;
        onboardingPipeline: string;
      };
      try {
        resolved = resolveExplicitProgramAndPipeline(
          {
            programId: payload.programId,
            programName: payload.programName,
          },
          allPrograms
        );
      } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 400 });
      }
      const lf = generateRandomLeadFormToken();

      const partner = await prisma.partner.create({
        data: {
          name: String(payload.companyName || payload.name || "").trim(),
          programId: resolved.programId,
          programName: resolved.programName,
          onboardingPipeline: resolved.onboardingPipeline,
          country: String(payload.country || "").trim(),
          currency: String(payload.currency || workspace.mainCurrency).trim(),
          contactFirstName: String(payload.contactFirstName || "").trim(),
          contactLastName: String(payload.contactLastName || "").trim(),
          contactEmail: String(payload.contactEmail || "").trim(),
          contactJobTitle: String(payload.contactJobTitle || "").trim(),
          contactPhone: String(payload.companyPhone || "").trim(),
          companyWebsite: String(payload.companyWebsite || "").trim(),
          industry: String(payload.industry || "").trim(),
          status: "Pending",
          onboardingStatus: "Not started",
          prospectionStage: "New",
          portalAccess: false,
          activeSince: new Date().toISOString().slice(0, 10),
          leadFormTokenHash: lf.tokenHash,
          leadFormTokenCipher: encryptBankDetails(lf.rawToken),
          bankDetailsJson: encryptBankDetails("{}"),
        },
      });

      await prisma.auditLog.create({
        data: {
          actor: partner.contactEmail,
          actorRole: "Public Applicant",
          action: "CREATE",
          objectType: "PartnerApplication",
          objectId: partner.id,
          summary: `Public partner application submitted for "${partner.name}" (${partner.programName})`,
        },
      });

      return NextResponse.json({ ok: true, partner });
    }

    return NextResponse.json({ error: "Unknown formType" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
