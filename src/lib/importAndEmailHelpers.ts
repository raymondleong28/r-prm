import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import {
  convertWithDatedFx,
  generateRandomLeadFormToken,
  normalizeAccountKey,
  resolveExplicitProgramAndPipeline,
  SUPPORTED_CURRENCIES,
  toMinorUnits,
} from "./prmEngine";
import { issuePartnerActivationLink, RprmSession } from "./authSession";
import { encryptBankDetails, sendEmailViaConnector } from "./connectors";

export interface WorkspaceAccountSettings {
  accountName: string;
  mainCurrency: string;
  timezone: string;
  defaultOwnerId: string | null;
  defaultOwnerName: string;
  legalEntityName: string;
  taxId: string;
  billingAddress: string;
}

export async function getWorkspaceAccountSettings(): Promise<WorkspaceAccountSettings> {
  const row = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: Record<string, any> = {};
  if (row?.valueJson) {
    try {
      parsed = JSON.parse(row.valueJson);
    } catch {
      parsed = {};
    }
  }
  return {
    accountName: String(parsed.accountName || "Workspace").trim(),
    mainCurrency: String(parsed.mainCurrency || SUPPORTED_CURRENCIES[0])
      .trim()
      .toUpperCase(),
    timezone: String(parsed.timezone || "UTC").trim(),
    defaultOwnerId: parsed.defaultOwnerId ? String(parsed.defaultOwnerId) : null,
    defaultOwnerName: String(parsed.defaultOwnerName || "").trim(),
    legalEntityName: String(parsed.legalEntityName || "").trim(),
    taxId: String(parsed.taxId || "").trim(),
    billingAddress: String(parsed.billingAddress || "").trim(),
  };
}

export async function writeAudit({
  session,
  action,
  objectType,
  objectId,
  summary,
  diff = {},
}: {
  session: RprmSession;
  action: string;
  objectType: string;
  objectId: string;
  summary: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diff?: Record<string, any>;
}) {
  await prisma.auditLog.create({
    data: {
      actor: session.email || session.name || "system",
      actorRole: `${session.identityType} (${session.role})`,
      action,
      objectType,
      objectId,
      summary,
      diffJson: JSON.stringify(diff),
    },
  });
}

// Send email via unified Email Connector with escaped HTML + real single-use activation link + {{workspace.name}} merge field
export async function sendAndLogTransactionalEmail({
  to,
  subject,
  body,
  templateName = "System Notification",
  mergeFields = {},
  issueActivationFor,
}: {
  to: string;
  subject: string;
  body: string;
  templateName?: string;
  mergeFields?: Record<string, string>;
  issueActivationFor?: {
    email: string;
    name: string;
    partnerId: string;
    partnerName: string;
    role: string;
  };
}) {
  const ws = await getWorkspaceAccountSettings();
  let activationUrl = "";
  let rawToken = "";
  let expiresAt = "";

  if (issueActivationFor) {
    const issued = await issuePartnerActivationLink({
      email: issueActivationFor.email,
      name: issueActivationFor.name,
      partnerId: issueActivationFor.partnerId,
      partnerName: issueActivationFor.partnerName,
      role: issueActivationFor.role,
    });
    activationUrl = issued.activationUrl;
    rawToken = issued.rawToken;
    expiresAt = issued.expiresAt.toISOString();
  }

  const finalMergeFields: Record<string, string> = {
    "workspace.name": ws.accountName,
    ...mergeFields,
    "user.activationUrl": activationUrl,
  };

  const fullBody = activationUrl
    ? `${body}\n\nActivate your Partner Portal account here: ${activationUrl}`
    : body;

  const sent = await sendEmailViaConnector({
    to,
    subject,
    body: fullBody,
    mergeFields: finalMergeFields,
  });

  const emailLog = await prisma.manageItem.create({
    data: {
      category: "sent_emails",
      name: sent.escapedSubject,
      subtitle: `To: ${to} · ${sent.transportInfo}`,
      status: sent.driver === "smtp" ? "Delivered (SMTP)" : "Captured in Outbox",
      metadataJson: JSON.stringify({
        to,
        subject: sent.escapedSubject,
        html: sent.html,
        templateName,
        activationUrl,
        expiresAt,
        deliveryMode: sent.transportInfo,
        sentAt: new Date().toISOString(),
      }),
    },
  });

  return {
    emailLog,
    deliveryMode: sent.transportInfo,
    activationUrl,
    activationToken: rawToken,
    html: sent.html,
  };
}

// CSV Parser & Multi-Object Importer with dryRun preview, row-level errors, and audit log
export function parseCsvText(csvText: string): Array<Record<string, string>> {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

export async function handleCsvImportMutation(
  session: RprmSession,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
) {
  const ws = await getWorkspaceAccountSettings();
  const allPrograms = await prisma.program.findMany();
  const objectType = String(payload.objectType || "partners").toLowerCase();
  const dryRun = Boolean(payload.dryRun);
  const rows: Array<Record<string, string>> = Array.isArray(payload.rows)
    ? payload.rows
    : parseCsvText(payload.csvText || "");

  const validRows: Array<Record<string, string>> = [];
  const rowErrors: Array<{ rowNumber: number; row?: number; error: string }> = [];

  rows.forEach((r, idx) => {
    const rowNumber = idx + 2;
    if (objectType === "partners") {
      if (!r.name) {
        rowErrors.push({
          rowNumber,
          row: rowNumber,
          error: "Missing required column: name",
        });
      } else if (!r.programId && !r.programName && allPrograms.length > 0) {
        // Check if programId or programName is explicitly supplied when required
        try {
          resolveExplicitProgramAndPipeline(
            { programId: r.programId, programName: r.programName },
            allPrograms
          );
          validRows.push(r);
        } catch (err) {
          rowErrors.push({
            rowNumber,
            row: rowNumber,
            error: String(err),
          });
        }
      } else {
        validRows.push(r);
      }
    } else if (objectType === "contacts" && (!r.name || !r.email || !r.partnerName)) {
      rowErrors.push({
        rowNumber,
        row: rowNumber,
        error: "Missing required columns: name, email, partnerName",
      });
    } else if (objectType === "leads" && (!r.firstName || !r.company || !r.email)) {
      rowErrors.push({
        rowNumber,
        row: rowNumber,
        error: "Missing required columns: firstName, company, email",
      });
    } else if (objectType === "deals" && (!r.name || !r.company || !r.amount)) {
      rowErrors.push({
        rowNumber,
        row: rowNumber,
        error: "Missing required columns: name, company, amount",
      });
    } else if (objectType === "customers" && (!r.name || !r.email)) {
      rowErrors.push({
        rowNumber,
        row: rowNumber,
        error: "Missing required columns: name, email",
      });
    } else if (
      objectType === "transactions" &&
      (!r.name || !r.amount || !r.partnerName)
    ) {
      rowErrors.push({
        rowNumber,
        row: rowNumber,
        error: "Missing required columns: name, amount, partnerName",
      });
    } else if (objectType === "rewards" && (!r.partnerName || !r.amount)) {
      rowErrors.push({
        rowNumber,
        row: rowNumber,
        error: "Missing required columns: partnerName, amount",
      });
    } else if (objectType === "payouts" && (!r.partnerName || !r.payoutNumber)) {
      rowErrors.push({
        rowNumber,
        row: rowNumber,
        error: "Missing required columns: partnerName, payoutNumber",
      });
    } else {
      validRows.push(r);
    }
  });

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      objectType,
      totalRows: rows.length,
      validCount: validRows.length,
      validRows: validRows.length,
      errorCount: rowErrors.length,
      rowErrors,
      preview: validRows.slice(0, 10),
    });
  }

  let importedCount = 0;
  for (const r of validRows) {
    if (objectType === "partners") {
      const lf = generateRandomLeadFormToken();
      let programId: string | null = r.programId || null;
      let programName = r.programName || "";
      let onboardingPipeline = "";
      if (r.programId || r.programName) {
        const resolved = resolveExplicitProgramAndPipeline(
          { programId: r.programId, programName: r.programName },
          allPrograms
        );
        programId = resolved.programId;
        programName = resolved.programName;
        onboardingPipeline = resolved.onboardingPipeline;
      }
      await prisma.partner.create({
        data: {
          name: r.name,
          ownerId: session.userId,
          owner: session.name,
          programId,
          programName,
          onboardingPipeline,
          qualifyingLevel: r.qualifyingLevel || "",
          country: r.country || "",
          currency: (r.currency || ws.mainCurrency).toUpperCase(),
          contactFirstName: r.contactFirstName || "",
          contactLastName: r.contactLastName || "",
          contactEmail: r.contactEmail || "",
          status: r.status || "Active",
          leadFormTokenHash: lf.tokenHash,
          leadFormTokenCipher: encryptBankDetails(lf.rawToken),
          bankDetailsJson: r.bankDetailsJson
            ? encryptBankDetails(r.bankDetailsJson)
            : encryptBankDetails("{}"),
        },
      });
      importedCount++;
    } else if (objectType === "contacts") {
      await prisma.partnerTeamMember.create({
        data: {
          name: r.name,
          email: r.email,
          jobTitle: r.jobTitle || "",
          phone: r.phone || "",
          partnerName: r.partnerName,
          role: r.role || "Sales Rep",
        },
      });
      importedCount++;
    } else if (objectType === "leads") {
      await prisma.lead.create({
        data: {
          firstName: r.firstName,
          lastName: r.lastName || "",
          company: r.company,
          email: r.email,
          country: r.country || "",
          ownerId: session.userId,
          owner: session.name,
          sourcePartnerName: r.sourcePartnerName || "",
          assignedPartner: r.assignedPartner || r.sourcePartnerName || "",
        },
      });
      importedCount++;
    } else if (objectType === "deals") {
      const amt = Number(r.amount);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      const fx = convertWithDatedFx(
        amt,
        r.currency || ws.mainCurrency,
        ws.mainCurrency
      );
      await prisma.deal.create({
        data: {
          name: r.name,
          ownerId: session.userId,
          owner: session.name,
          company: r.company,
          clientName: r.clientName || r.company,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountBase: fx.amountBaseMinor,
          partnerName: r.partnerName || "",
          sourcePartnerName: r.sourcePartnerName || r.partnerName || "",
          stage: r.stage || "Discovery Stage",
        },
      });
      importedCount++;
    } else if (objectType === "customers") {
      await prisma.customer.create({
        data: {
          name: r.name,
          email: r.email,
          sourcePartnerName: r.sourcePartnerName || "",
          revenuesBase: toMinorUnits(
            Number(r.revenuesBase ?? r.amount ?? 0) || 0
          ),
        },
      });
      importedCount++;
    } else if (objectType === "transactions") {
      const amt = Number(r.amount);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      const fx = convertWithDatedFx(
        amt,
        r.currency || ws.mainCurrency,
        ws.mainCurrency
      );
      await prisma.transaction.create({
        data: {
          name: r.name,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountBase: fx.amountBaseMinor,
          partnerName: r.partnerName,
          customerName: r.customerName || "",
          dealName: r.dealName || "",
        },
      });
      importedCount++;
    } else if (objectType === "rewards") {
      const amt = Number(r.amount);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      const fx = convertWithDatedFx(
        amt,
        r.currency || ws.mainCurrency,
        ws.mainCurrency
      );
      await prisma.reward.create({
        data: {
          rewardNumber:
            r.rewardNumber || `RW-IMP-${Date.now().toString().slice(-4)}`,
          partnerName: r.partnerName,
          recipientName: r.partnerName,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountBase: fx.amountBaseMinor,
          fromActivity: r.fromActivity || "CSV Import",
          status: r.status || "Pending",
        },
      });
      importedCount++;
    } else if (objectType === "payouts") {
      const amt = Number(r.amount) || 0;
      const fx = convertWithDatedFx(
        amt,
        r.currency || ws.mainCurrency,
        ws.mainCurrency
      );
      await prisma.payout.create({
        data: {
          payoutNumber: r.payoutNumber,
          name: r.name || `Imported Payout ${r.payoutNumber}`,
          partnerName: r.partnerName,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountBase: fx.amountBaseMinor,
          status: r.status || "Ready",
        },
      });
      importedCount++;
    }
  }

  await writeAudit({
    session,
    action: "CSV_IMPORT",
    objectType: `Import:${objectType}`,
    objectId: `${objectType}-${Date.now()}`,
    summary: `Imported ${importedCount} ${objectType} record(s) via CSV (${rowErrors.length} row errors)`,
    diff: { objectType, importedCount, errorCount: rowErrors.length },
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    objectType,
    importedCount,
    imported: importedCount,
    errorCount: rowErrors.length,
    rowErrors,
  });
}

// Account Mapping Two-List CSV Matcher (Organisation account list vs Partner account list matched by normalized domain & company name)
export function matchAccountListsByDomainAndName(
  orgAccounts: Array<{
    accountName: string;
    domain?: string;
    type?: string;
    ownerName?: string;
    ownerEmail?: string;
  }>,
  partnerAccounts: Array<{
    partnerName: string;
    accountName: string;
    domain?: string;
    type?: string;
    ownerName?: string;
    ownerEmail?: string;
  }>
) {
  const results: Array<{
    accountName: string;
    type: string;
    ownerName: string;
    ownerEmail: string;
    hasOverlap: boolean;
    partnerName: string;
    partnerAccountName: string;
    partnerAccountType: string;
    partnerOwnerName: string;
    partnerOwnerEmail: string;
    matchedBy: "domain" | "company_name" | "none";
  }> = [];

  const normDomain = (d?: string) =>
    String(d || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();

  for (const orgRow of orgAccounts) {
    const oKey = normalizeAccountKey(orgRow.accountName);
    const oDom = normDomain(orgRow.domain);

    let matchedPartnerRow: (typeof partnerAccounts)[number] | undefined;
    let matchedBy: "domain" | "company_name" | "none" = "none";

    for (const prt of partnerAccounts) {
      const pKey = normalizeAccountKey(prt.accountName);
      const pDom = normDomain(prt.domain);
      if (oDom && pDom && oDom === pDom) {
        matchedPartnerRow = prt;
        matchedBy = "domain";
        break;
      }
      if (
        oKey &&
        pKey &&
        (oKey === pKey || oKey.includes(pKey) || pKey.includes(oKey))
      ) {
        matchedPartnerRow = prt;
        matchedBy = "company_name";
        break;
      }
    }

    results.push({
      accountName: orgRow.accountName,
      type: orgRow.type || "Prospect",
      ownerName: orgRow.ownerName || "",
      ownerEmail: orgRow.ownerEmail || "",
      hasOverlap: Boolean(matchedPartnerRow),
      partnerName:
        matchedPartnerRow?.partnerName ||
        partnerAccounts[0]?.partnerName ||
        "",
      partnerAccountName: matchedPartnerRow?.accountName || "",
      partnerAccountType: matchedPartnerRow?.type || "Customer",
      partnerOwnerName: matchedPartnerRow?.ownerName || "",
      partnerOwnerEmail: matchedPartnerRow?.ownerEmail || "",
      matchedBy,
    });
  }

  return results;
}
