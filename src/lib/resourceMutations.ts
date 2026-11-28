import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import {
  convertWithDatedFx,
  currentIsoDateInTimezone,
  currentMonthKeyInTimezone,
  generateRandomLeadFormToken,
  resolveExplicitProgramAndPipeline,
  toMinorUnits,
  toMajorUnits,
} from "./prmEngine";
import { RprmSession } from "./authSession";
import {
  encryptBankDetails,
  executePayoutConnector,
  syncDealToHubSpotConnector,
} from "./connectors";
import {
  getWorkspaceAccountSettings,
  writeAudit,
  sendAndLogTransactionalEmail,
  parseCsvText,
  handleCsvImportMutation,
  matchAccountListsByDomainAndName,
} from "./importAndEmailHelpers";
import { executeWorkspaceAdminMutation } from "./workspaceAdminMutations";
import crypto from "node:crypto";
import {
  generateRewardsForDealWon,
  generateRewardsForLeadAccepted,
  generateRewardsForTransaction,
} from "./rewardGeneration";

async function auditGeneratedRewards(session: RprmSession, rewardIds: string[], source: string) {
  if (rewardIds.length === 0) return;
  const rows = await prisma.reward.findMany({ where: { id: { in: rewardIds } } });
  for (const r of rows) {
    await writeAudit({
      session,
      action: "CREATE",
      objectType: "Reward",
      objectId: r.id,
      summary: `Generated reward ${r.rewardNumber} (${r.currency} ${toMajorUnits(r.amount)}, ${r.fromRewardRule}) for ${r.partnerName} from ${source}`,
    });
  }
}

export {
  writeAudit,
  sendAndLogTransactionalEmail,
  parseCsvText,
  handleCsvImportMutation,
  matchAccountListsByDomainAndName,
};

export async function executeResourceMutation(
  session: RprmSession,
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any = {}
) {
  const ws = await getWorkspaceAccountSettings();
  const todayIso = currentIsoDateInTimezone(ws.timezone);

  switch (action) {
    case "CSV_IMPORT":
      return handleCsvImportMutation(session, payload);

    case "UPLOAD_ACCOUNT_MAPPING_LISTS": {
      const orgList = Array.isArray(payload.orgList)
        ? payload.orgList
        : parseCsvText(payload.orgCsv || "");
      const partnerList = Array.isArray(payload.partnerList)
        ? payload.partnerList
        : parseCsvText(payload.partnerCsv || "");

      const matched = matchAccountListsByDomainAndName(
        orgList.map((r: Record<string, string>) => ({
          accountName: r.accountName || r.company || r.name,
          domain: r.domain || r.website,
          type: r.type || "Prospect",
          ownerName: r.ownerName || session.name,
          ownerEmail: r.ownerEmail || session.email,
        })),
        partnerList.map((r: Record<string, string>) => ({
          partnerName: r.partnerName || payload.partnerName || "",
          accountName: r.accountName || r.company || r.name,
          domain: r.domain || r.website,
          type: r.type || "Customer",
          ownerName: r.ownerName || "",
          ownerEmail: r.ownerEmail || "",
        }))
      );

      const createdRecords = [];
      for (const m of matched) {
        const created = await prisma.accountRecord.create({
          data: {
            accountName: m.accountName,
            type: m.type,
            ownerName: m.ownerName,
            ownerEmail: m.ownerEmail,
            source: payload.sourceName || "CSV List Matching",
            importedDate: todayIso,
            hasOverlap: m.hasOverlap,
            partnerName: m.partnerName,
            partnerAccountName: m.partnerAccountName,
            partnerAccountType: m.partnerAccountType,
            partnerOwnerName: m.partnerOwnerName,
            partnerOwnerEmail: m.partnerOwnerEmail,
            overlapDate: todayIso,
          },
        });
        createdRecords.push({ ...created, matchedBy: m.matchedBy });
      }

      const overlapsFound = matched.filter((m) => m.hasOverlap).length;

      if (payload.name || payload.sourceName) {
        await prisma.dataSource.create({
          data: {
            name: payload.name || payload.sourceName,
            status: "Active",
            sharedWith: payload.sharedWith || "",
            type: "CSV Upload",
            accountType: payload.accountType || "Customers & Prospects",
            lastImportedDate: todayIso,
            createdBy: session.name,
          },
        });
      }

      await writeAudit({
        session,
        action: "ACCOUNT_MAPPING_MATCH",
        objectType: "AccountRecord",
        objectId: `batch-${Date.now()}`,
        summary: `Matched ${orgList.length} organisation accounts against ${partnerList.length} partner accounts -> ${overlapsFound} overlap(s)`,
      });

      return NextResponse.json({
        ok: true,
        orgCount: orgList.length,
        partnerCount: partnerList.length,
        overlapsFound,
        matchedCount: overlapsFound,
        records: createdRecords,
      });
    }

    case "CREATE_PARTNER": {
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

      const matchedProgram = allPrograms.find(
        (p) => p.id === resolved.programId
      );
      let firstLevelName = "";
      if (matchedProgram?.levelsJson) {
        try {
          const parsedLevels = JSON.parse(matchedProgram.levelsJson);
          if (Array.isArray(parsedLevels) && parsedLevels[0]?.name) {
            firstLevelName = String(parsedLevels[0].name);
          }
        } catch {
          firstLevelName = "";
        }
      }

      const lf = generateRandomLeadFormToken();

      const partner = await prisma.partner.create({
        data: {
          name: String(payload.name || "").trim(),
          ownerId: payload.ownerId || session.userId,
          owner: payload.owner || session.name,
          groupName: payload.groupName || "",
          programId: resolved.programId,
          programName: resolved.programName,
          onboardingPipeline: resolved.onboardingPipeline,
          country: payload.country || "",
          language: payload.language || "English",
          currency: String(payload.currency || ws.mainCurrency)
            .trim()
            .toUpperCase(),
          partnerType: String(payload.partnerType || "").trim(),
          qualifyingLevel: payload.qualifyingLevel || firstLevelName,
          status: payload.status || "Active",
          onboardingStatus: payload.onboardingStatus || "In progress",
          onboardingStage: payload.onboardingStage || "Kickoff",
          prospectionStage: payload.prospectionStage || "New",
          contactFirstName: payload.contactFirstName || "",
          contactLastName: payload.contactLastName || "",
          contactEmail: payload.contactEmail || "",
          contactJobTitle: payload.contactJobTitle || "",
          contactPhone: payload.contactPhone || "",
          portalAccess: payload.portalAccess ?? true,
          companyWebsite: payload.companyWebsite || "",
          companyAddress: payload.companyAddress || "",
          employeeCount: payload.employeeCount || "",
          industry: payload.industry || "",
          activeSince: todayIso,
          leadFormTokenHash: lf.tokenHash,
          leadFormTokenCipher: encryptBankDetails(lf.rawToken),
          bankDetailsJson: encryptBankDetails(
            typeof payload.bankDetailsJson === "string"
              ? payload.bankDetailsJson
              : JSON.stringify(payload.bankDetails || {})
          ),
        },
      });

      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Partner",
        objectId: partner.id,
        summary: `Enrolled partner "${partner.name}" (portalAccess=${partner.portalAccess}, status=${partner.status})`,
        diff: payload,
      });

      let activationUrl = "";
      let activationToken = "";
      if (partner.portalAccess && partner.contactEmail) {
        const sent = await sendAndLogTransactionalEmail({
          to: partner.contactEmail,
          subject: `Welcome to {{workspace.name}}! Activate your Partner Portal for ${partner.name}`,
          body: `Hi ${partner.contactFirstName || partner.name},\n\nYou have been enrolled in "${partner.programName}"${
            partner.qualifyingLevel ? ` (${partner.qualifyingLevel})` : ""
          } on {{workspace.name}}.`,
          templateName: "Notify accepted partner",
          issueActivationFor: {
            email: partner.contactEmail,
            name:
              `${partner.contactFirstName} ${partner.contactLastName}`.trim() ||
              partner.name,
            partnerId: partner.id,
            partnerName: partner.name,
            role: "Manager",
          },
        });
        activationUrl = sent.activationUrl;
        activationToken = sent.activationToken;
      }
      return NextResponse.json({
        ok: true,
        partner,
        activationUrl,
        activationToken,
      });
    }

    case "ROTATE_PARTNER_LEAD_TOKEN": {
      if (session.identityType !== "coworker") {
        return NextResponse.json(
          { error: "Only coworkers can rotate a partner's lead-form token" },
          { status: 403 }
        );
      }
      const partnerId = String(payload.partnerId || payload.id || "").trim();
      const existing = await prisma.partner.findUnique({
        where: { id: partnerId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Partner not found" },
          { status: 404 }
        );
      }
      const lf = generateRandomLeadFormToken();
      await prisma.partner.update({
        where: { id: existing.id },
        data: {
          leadFormTokenHash: lf.tokenHash,
          leadFormTokenCipher: encryptBankDetails(lf.rawToken),
        },
      });
      await writeAudit({
        session,
        action: "ROTATE_LEAD_FORM_TOKEN",
        objectType: "Partner",
        objectId: existing.id,
        summary: `Rotated public lead-form token for partner "${existing.name}"`,
      });
      return NextResponse.json({
        ok: true,
        partnerId: existing.id,
        leadFormToken: lf.rawToken,
      });
    }

    case "REVIEW_PARTNER_APPLICATION": {
      const {
        partnerId,
        mode,
        rejectionReason,
        reapplyAfterDate,
        programId: overrideProgId,
        programName: overrideProgName,
      } = payload;
      const existing = await prisma.partner.findUnique({
        where: { id: partnerId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Partner not found" },
          { status: 404 }
        );
      }
      if (mode === "reject" && !String(rejectionReason || "").trim()) {
        return NextResponse.json(
          { error: "A rejection reason is required" },
          { status: 400 }
        );
      }

      const allPrograms = await prisma.program.findMany();
      let resolved: {
        programId: string;
        programName: string;
        onboardingPipeline: string;
      };
      try {
        resolved = resolveExplicitProgramAndPipeline(
          {
            programId:
              overrideProgId !== undefined ? overrideProgId : existing.programId,
            programName:
              overrideProgName !== undefined
                ? overrideProgName
                : overrideProgId !== undefined
                ? undefined
                : existing.programName,
          },
          allPrograms
        );
      } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 400 });
      }
      const resolvedProgramId = resolved.programId;
      const resolvedProgramName = resolved.programName;
      const resolvedPipeline = resolved.onboardingPipeline;

      const nextStatus =
        mode === "accept_active"
          ? "Active"
          : mode === "accept_prospect"
          ? "Onboarding"
          : "Inactive";

      const partner = await prisma.partner.update({
        where: { id: partnerId },
        data: {
          ownerId: existing.ownerId || session.userId,
          owner: existing.owner || session.name,
          programId: resolvedProgramId,
          programName: resolvedProgramName,
          onboardingPipeline: resolvedPipeline,
          status: nextStatus,
          portalAccess: mode === "accept_active",
          prospectionStage: mode === "accept_active" ? "Active" : "New",
        },
      });

      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "PartnerApplication",
        objectId: partner.id,
        summary: `Application for "${partner.name}" in "${resolvedProgramName}" reviewed: ${mode}${
          rejectionReason ? ` (Reason: ${rejectionReason})` : ""
        }`,
        diff: {
          mode,
          programId: resolvedProgramId,
          programName: resolvedProgramName,
          onboardingPipeline: resolvedPipeline,
          rejectionReason,
          reapplyAfterDate,
        },
      });

      let activationUrl = "";
      let activationToken = "";
      if (mode === "accept_active" && partner.contactEmail) {
        const sent = await sendAndLogTransactionalEmail({
          to: partner.contactEmail,
          subject: `Approved! Activate your ${resolvedProgramName} Partner Portal at {{workspace.name}}`,
          body: `Hi ${partner.contactFirstName || partner.name},\n\nYour application for ${resolvedProgramName} at {{workspace.name}} has been accepted as an Active Partner on pipeline "${resolvedPipeline}".`,
          templateName: "Notify accepted partner",
          issueActivationFor: {
            email: partner.contactEmail,
            name:
              `${partner.contactFirstName} ${partner.contactLastName}`.trim() ||
              partner.name,
            partnerId: partner.id,
            partnerName: partner.name,
            role: "Manager",
          },
        });
        activationUrl = sent.activationUrl;
        activationToken = sent.activationToken;
      } else if (mode === "reject" && partner.contactEmail) {
        await sendAndLogTransactionalEmail({
          to: partner.contactEmail,
          subject: `Update on your ${resolvedProgramName} Partner Application at {{workspace.name}}`,
          body: `Hi ${partner.contactFirstName || partner.name},\n\nThank you for applying to {{workspace.name}}.\nReason: ${rejectionReason}`,
          templateName: "Notify rejected partner",
        });
      }
      return NextResponse.json({
        ok: true,
        partner,
        activationUrl,
        activationToken,
      });
    }

    case "UPDATE_PARTNER": {
      const targetId =
        session.identityType === "partner" ? session.partnerId : payload.id;
      if (!targetId) {
        return NextResponse.json(
          { error: "Partner ID is required" },
          { status: 400 }
        );
      }
      const updateData = { ...(payload.data || {}) };
      if (typeof updateData.bankDetailsJson === "string") {
        updateData.bankDetailsJson = encryptBankDetails(
          updateData.bankDetailsJson
        );
      }
      const partner = await prisma.partner.update({
        where: { id: targetId },
        data: updateData,
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "Partner",
        objectId: partner.id,
        summary: `Updated partner "${partner.name}"`,
        diff: {
          ...updateData,
          bankDetailsJson: updateData.bankDetailsJson
            ? "[ENCRYPTED]"
            : undefined,
        },
      });
      return NextResponse.json({ ok: true, partner });
    }

    case "CREATE_TEAM_MEMBER": {
      const resolvedPartnerName =
        session.identityType === "partner" && session.partnerName
          ? session.partnerName
          : String(payload.partnerName || "").trim();
      if (!resolvedPartnerName) {
        return NextResponse.json(
          { error: "Partner name is required to add a team member." },
          { status: 400 }
        );
      }
      const linkedPartner = await prisma.partner.findFirst({
        where: { name: resolvedPartnerName },
      });
      if (!linkedPartner) {
        return NextResponse.json(
          { error: `Partner "${resolvedPartnerName}" not found.` },
          { status: 404 }
        );
      }
      const member = await prisma.partnerTeamMember.create({
        data: {
          name: String(payload.name || "").trim(),
          email: String(payload.email || "").trim(),
          jobTitle: String(payload.jobTitle || "").trim(),
          phone: String(payload.phone || "").trim(),
          partnerName: linkedPartner.name,
          role: payload.role || "Sales Rep",
          status: payload.portalAccess === false ? "Inactive" : "Sent",
          invitedAt: todayIso,
        },
      });
      let activationUrl = "";
      let activationToken = "";
      if (payload.portalAccess !== false && member.email) {
        const sent = await sendAndLogTransactionalEmail({
          to: member.email,
          subject: `Invitation: Join ${member.partnerName} on {{workspace.name}} Partner Portal`,
          body: `Hi ${member.name},\n\nYou have been invited as ${member.role} for ${member.partnerName} on {{workspace.name}}.`,
          templateName: "Invite partner team member",
          issueActivationFor: {
            email: member.email,
            name: member.name,
            partnerId: linkedPartner.id,
            partnerName: linkedPartner.name,
            role: member.role === "Sales Rep" ? "SalesRep" : member.role,
          },
        });
        activationUrl = sent.activationUrl;
        activationToken = sent.activationToken;
      }
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "PartnerTeamMember",
        objectId: member.id,
        summary: `Added partner team member "${member.name}" (${member.role}) for ${member.partnerName}`,
      });
      return NextResponse.json({
        ok: true,
        member,
        activationUrl,
        activationToken,
      });
    }

    case "BULK_TEAM_MEMBERS": {
      const { memberIds, bulkAction, role } = payload;
      if (bulkAction === "delete") {
        await prisma.partnerTeamMember.deleteMany({
          where: { id: { in: memberIds } },
        });
      } else if (bulkAction === "update_role" && role) {
        await prisma.partnerTeamMember.updateMany({
          where: { id: { in: memberIds } },
          data: { role },
        });
      } else if (bulkAction === "set_main_contact") {
        const first = await prisma.partnerTeamMember.findUnique({
          where: { id: memberIds[0] },
        });
        if (first) {
          const parts = first.name.split(" ");
          await prisma.partner.updateMany({
            where: { name: first.partnerName },
            data: {
              contactFirstName: parts[0] || first.name,
              contactLastName: parts.slice(1).join(" "),
              contactEmail: first.email,
              contactJobTitle: first.jobTitle,
              contactPhone: first.phone,
            },
          });
        }
      }
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "PartnerTeamMember",
        objectId: memberIds.join(","),
        summary: `Executed bulk action "${bulkAction}" on ${memberIds.length} team member(s)`,
      });
      return NextResponse.json({ ok: true });
    }

    case "CREATE_LEAD": {
      const partnerName =
        session.identityType === "partner" && session.partnerName
          ? session.partnerName
          : String(payload.sourcePartnerName || "").trim();
      if (!partnerName) {
        return NextResponse.json(
          { error: "Source partner is required to submit a lead." },
          { status: 400 }
        );
      }
      const linkedPartner = await prisma.partner.findFirst({
        where: { name: partnerName },
      });
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
          remarks: payload.customProperties
            ? `${payload.remarks || ""} [CustomProps: ${JSON.stringify(
                payload.customProperties
              )}]`.trim()
            : String(payload.remarks || "").trim(),
          status: "Pending",
          ownerId:
            session.identityType === "coworker"
              ? payload.ownerId || session.userId
              : linkedPartner?.ownerId || ws.defaultOwnerId,
          owner:
            session.identityType === "coworker"
              ? payload.owner || session.name
              : linkedPartner?.owner || ws.defaultOwnerName,
          source: payload.source || "Partner Portal",
          sourcePartnerId: linkedPartner?.id || null,
          sourcePartnerName: partnerName,
          assignedPartner: payload.assignedPartner || partnerName,
          assignedContact: payload.assignedContact || session.name,
          assignedDate: todayIso,
          deadline: payload.deadline || "",
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Lead",
        objectId: lead.id,
        summary: `Created lead "${lead.firstName} ${lead.lastName}" (${lead.company}) for ${partnerName}`,
      });
      return NextResponse.json({ ok: true, lead });
    }

    case "UPDATE_LEAD_STATUS": {
      const lead = await prisma.lead.update({
        where: { id: payload.id },
        data: {
          status: payload.status,
          acceptedBy: payload.status === "Accepted" ? session.name : "",
          acceptedDate: payload.status === "Accepted" ? todayIso : "",
        },
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "Lead",
        objectId: lead.id,
        summary: `Lead "${lead.firstName} ${lead.lastName}" marked ${payload.status}`,
      });
      if (payload.status === "Accepted") {
        const leadRewards = await generateRewardsForLeadAccepted(lead.id, ws.mainCurrency);
        await auditGeneratedRewards(session, leadRewards.rewardIds, `lead "${lead.firstName} ${lead.lastName}" accepted`);
      }
      return NextResponse.json({ ok: true, lead });
    }

    case "CONVERT_LEAD_TO_DEAL": {
      const lead = await prisma.lead.findUnique({
        where: { id: payload.leadId },
      });
      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      // §3.5.1: Amount has NO default; require an explicit positive amount from the admin
      const rawAmount = payload.amount;
      const amount = Number(rawAmount);
      if (
        rawAmount === undefined ||
        rawAmount === null ||
        String(rawAmount).trim() === "" ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return NextResponse.json(
          { error: "Deal amount is required and must be greater than zero." },
          { status: 400 }
        );
      }
      const dealCurrency = String(payload.currency || ws.mainCurrency)
        .trim()
        .toUpperCase();
      const fx = convertWithDatedFx(amount, dealCurrency, ws.mainCurrency);
      const linkedPartner = lead.sourcePartnerId
        ? await prisma.partner.findUnique({
            where: { id: lead.sourcePartnerId },
          })
        : await prisma.partner.findFirst({
            where: { name: lead.sourcePartnerName },
          });

      const deal = await prisma.deal.create({
        data: {
          name:
            payload.dealName ||
            `OPP - ${lead.company}${
              lead.retailBrand && lead.retailBrand !== lead.company
                ? ` (${lead.retailBrand})`
                : ""
            }`,
          ownerId: lead.ownerId || session.userId,
          owner: lead.owner || session.name,
          clientName: `${lead.firstName} ${lead.lastName}`.trim(),
          company: lead.company,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountBase: fx.amountBaseMinor,
          partnerName: lead.sourcePartnerName,
          partnerId: linkedPartner?.id || null,
          programName: linkedPartner?.programName || "",
          assignedContact: lead.assignedContact,
          status: "Accepted",
          stage: "Discovery Stage",
          stageEnteredAt: todayIso,
          source: "Lead Conversion",
          sourcePartnerName: lead.sourcePartnerName,
          closeDate: payload.closeDate || "",
          expirationDate: payload.expirationDate || "",
          sourceLeadId: lead.id,
        },
      });
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "Converted", convertedDealId: deal.id },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Deal",
        objectId: deal.id,
        summary: `Converted lead "${lead.firstName} ${lead.lastName}" to Deal "${deal.name}" (${fx.currency} ${fx.originalAmount} / ${ws.mainCurrency} ${fx.amountBase})`,
      });
      return NextResponse.json({ ok: true, deal });
    }

    case "CREATE_DEAL": {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Deal amount must be greater than zero." },
          { status: 400 }
        );
      }
      const partnerName =
        session.identityType === "partner" && session.partnerName
          ? session.partnerName
          : String(payload.partnerName || "").trim();
      if (!partnerName) {
        return NextResponse.json(
          { error: "Associated partner is required to register a deal." },
          { status: 400 }
        );
      }
      const linkedPartner = await prisma.partner.findFirst({
        where: { name: partnerName },
      });
      const fx = convertWithDatedFx(
        amount,
        payload.currency || ws.mainCurrency,
        ws.mainCurrency
      );
      const deal = await prisma.deal.create({
        data: {
          name: String(payload.name || "").trim(),
          ownerId:
            session.identityType === "coworker"
              ? payload.ownerId || session.userId
              : linkedPartner?.ownerId || ws.defaultOwnerId,
          owner:
            session.identityType === "coworker"
              ? payload.owner || session.name
              : linkedPartner?.owner || ws.defaultOwnerName,
          clientName: String(payload.clientName || payload.company || "").trim(),
          company: String(payload.company || payload.name || "").trim(),
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountBase: fx.amountBaseMinor,
          partnerName,
          partnerId: linkedPartner?.id || null,
          programName: linkedPartner?.programName || "",
          assignedContact: payload.assignedContact || session.name,
          status: payload.status || "Accepted",
          stage: payload.stage || "Discovery Stage",
          stageEnteredAt: todayIso,
          source: "Partner Registration",
          sourcePartnerName: partnerName,
          closeDate: payload.closeDate || "",
          expirationDate: payload.expirationDate || "",
          dealType: payload.dealType || "New Business",
          subscriptionPlan: payload.subscriptionPlan || "",
          comment: payload.customProperties
            ? `${payload.comment || ""} [CustomProps: ${JSON.stringify(
                payload.customProperties
              )}]`.trim()
            : String(payload.comment || "").trim(),
          lineItemsJson: JSON.stringify([
            {
              id: "li-1",
              product: payload.subscriptionPlan || "Subscription",
              qty: 1,
              unitPrice: amount,
              total: amount,
            },
          ]),
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Deal",
        objectId: deal.id,
        summary: `Registered deal "${deal.name}" for ${partnerName} (${ws.mainCurrency} ${fx.amountBase})`,
      });
      return NextResponse.json({ ok: true, deal });
    }

    case "UPDATE_DEAL_STAGE": {
      const deal = await prisma.deal.update({
        where: { id: payload.id },
        data: {
          stage: payload.stage,
          status: payload.status || undefined,
          stageEnteredAt: todayIso,
        },
      });

      const hsSync = syncDealToHubSpotConnector(deal);
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "Deal",
        objectId: deal.id,
        summary: `Deal "${deal.name}" moved to stage "${payload.stage}" (HubSpot mapped stage: ${hsSync.mappedStage})`,
      });

      if (payload.stage === "Closed Won") {
        const result = await generateRewardsForDealWon(deal.id, ws.mainCurrency);
        await auditGeneratedRewards(session, result.rewardIds, `deal "${deal.name}" won`);
      }
      return NextResponse.json({ ok: true, deal });
    }

    case "UPDATE_DEAL_LINE_ITEMS": {
      const lineItems = payload.lineItems || [];
      const newTotal = lineItems.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, item: any) => sum + Number(item.total || 0),
        0
      );
      const existing = await prisma.deal.findUnique({
        where: { id: payload.dealId },
      });
      const fx = convertWithDatedFx(
        newTotal,
        existing?.currency || ws.mainCurrency,
        ws.mainCurrency
      );
      const deal = await prisma.deal.update({
        where: { id: payload.dealId },
        data: {
          lineItemsJson: JSON.stringify(lineItems),
          amount: fx.originalAmountMinor,
          amountBase: fx.amountBaseMinor,
        },
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "DealLineItems",
        objectId: deal.id,
        summary: `Updated line items on deal "${deal.name}" (New total: ${ws.mainCurrency} ${fx.amountBase})`,
      });
      return NextResponse.json({ ok: true, deal });
    }

    case "ASSOCIATE_DEAL_CUSTOMER": {
      const deal = await prisma.deal.findUnique({
        where: { id: payload.dealId },
      });
      if (!deal) {
        return NextResponse.json({ error: "Deal not found" }, { status: 404 });
      }
      const customer = await prisma.customer.create({
        data: {
          name: deal.company,
          email:
            payload.email ||
            `billing@${deal.company
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")}.example.com`,
          status: "Paying",
          source: "Deal Conversion",
          sourcePartnerName: deal.partnerName,
          becamePayingDate: todayIso,
          bbid: `BB-${Math.floor(2100 + Math.random() * 900)}`,
          sourceDealId: deal.id,
          subscriptionPlan: deal.subscriptionPlan,
          billingFrequency: "Yearly",
          billingPeriod: "12 Months",
          transactionsCount: 1,
          revenuesBase: deal.amountBase,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Customer",
        objectId: customer.id,
        summary: `Associated customer "${customer.name}" from deal "${deal.name}"`,
      });
      return NextResponse.json({ ok: true, customer });
    }

    case "CREATE_CUSTOMER": {
      const customer = await prisma.customer.create({
        data: {
          name: String(payload.name || "").trim(),
          email: String(payload.email || "").trim(),
          status: payload.status || "Paying",
          source: payload.source || "Manual Entry",
          sourcePartnerName: String(payload.sourcePartnerName || "").trim(),
          becamePayingDate: payload.becamePayingDate || todayIso,
          bbid: payload.bbid || `BB-${Math.floor(2100 + Math.random() * 900)}`,
          sourceDealId: payload.sourceDealId || "",
          subscriptionPlan: payload.subscriptionPlan || "",
          billingFrequency: payload.billingFrequency || "Yearly",
          billingPeriod: payload.billingPeriod || "12 Months",
          revenuesBase: toMinorUnits(
            Number(payload.revenuesBase ?? payload.amount ?? 0) || 0
          ),
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Customer",
        objectId: customer.id,
        summary: `Created customer "${customer.name}"`,
      });
      return NextResponse.json({ ok: true, customer });
    }

    case "CREATE_TRANSACTION": {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Transaction amount must be greater than zero." },
          { status: 400 }
        );
      }
      const partnerName = String(payload.partnerName || "").trim();
      if (!partnerName) {
        return NextResponse.json(
          { error: "Partner name is required to record a transaction." },
          { status: 400 }
        );
      }
      const fx = convertWithDatedFx(
        amount,
        payload.currency || ws.mainCurrency,
        ws.mainCurrency
      );
      // Link to the customer record (by id, or by exact name) so "Nth transaction of a customer" rules work
      const customerIdInput = String(payload.customerId || "").trim();
      const customerNameInput = String(payload.customerName || "").trim();
      const linkedCustomer = customerIdInput
        ? await prisma.customer.findUnique({ where: { id: customerIdInput } })
        : customerNameInput
        ? await prisma.customer.findFirst({
            where: { name: { equals: customerNameInput, mode: "insensitive" } },
          })
        : null;
      if (customerIdInput && !linkedCustomer) {
        return NextResponse.json({ error: "Customer not found." }, { status: 400 });
      }
      const tx = await prisma.transaction.create({
        data: {
          name:
            payload.name ||
            `TX-${todayIso.replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountBase: fx.amountBaseMinor,
          partnerName,
          customerName: linkedCustomer?.name || String(payload.customerName || "").trim(),
          customerId: linkedCustomer?.id || null,
          dealName: String(payload.dealName || "").trim(),
          monthKey:
            payload.monthKey || currentMonthKeyInTimezone(ws.timezone),
        },
      });

      const rewardResult = await generateRewardsForTransaction(tx.id, ws.mainCurrency);
      await auditGeneratedRewards(session, rewardResult.rewardIds, `transaction "${tx.name}"`);

      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Transaction",
        objectId: tx.id,
        summary: `Recorded transaction "${tx.name}" (${ws.mainCurrency} ${fx.amountBase}) and computed tier rewards`,
      });
      return NextResponse.json({ ok: true, transaction: tx });
    }

    case "CREATE_REWARD": {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Reward amount must be greater than zero." },
          { status: 400 }
        );
      }
      const partnerName = String(payload.partnerName || "").trim();
      if (!partnerName) {
        return NextResponse.json(
          { error: "Partner name is required to create a reward." },
          { status: 400 }
        );
      }
      const fx = convertWithDatedFx(
        amount,
        payload.currency || ws.mainCurrency,
        ws.mainCurrency
      );
      const reward = await prisma.reward.create({
        data: {
          rewardNumber: `RW-${Math.floor(1050 + Math.random() * 8900)}`,
          partnerName,
          recipientName: partnerName,
          type: payload.type || "Cash",
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountBase: fx.amountBaseMinor,
          fromActivity: payload.fromActivity || "Manual Bonus / Milestone",
          fromRewardRule: payload.fromRewardRule || "One-time Commission Bonus",
          status: "Pending",
          comment: `${
            payload.comment || ""
          } [FX ${fx.fxRate} dated ${fx.fxRateDate}]`.trim(),
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Reward",
        objectId: reward.id,
        summary: `Created reward ${reward.rewardNumber} (${ws.mainCurrency} ${fx.amountBase})`,
      });
      return NextResponse.json({ ok: true, reward });
    }

    case "UPDATE_REWARD_STATUS": {
      const existing = await prisma.reward.findUnique({
        where: { id: payload.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const nextComment = payload.reason
        ? `${existing.comment || ""} | Refusal reason: ${payload.reason}`.trim()
        : existing.comment;
      const reward = await prisma.reward.update({
        where: { id: payload.id },
        data: {
          status: payload.status,
          comment: nextComment,
        },
      });
      await writeAudit({
        session,
        action: payload.status === "Refused" ? "REFUSE" : "VALIDATE",
        objectType: "Reward",
        objectId: reward.id,
        summary: `Reward ${reward.rewardNumber} status changed to "${payload.status}"`,
      });
      return NextResponse.json({ ok: true, reward });
    }

    case "CLAWBACK_REWARD": {
      const orig = await prisma.reward.findUnique({
        where: { id: payload.id },
      });
      if (!orig) {
        return NextResponse.json(
          { error: "Original reward not found" },
          { status: 404 }
        );
      }
      await prisma.reward.update({
        where: { id: orig.id },
        data: {
          status: "Clawed back",
          comment: `${orig.comment || ""} | Reversed via Clawback (${
            payload.reason || "Underlying invoice refunded"
          })`.trim(),
        },
      });
      const clawbackAdjustment = await prisma.reward.create({
        data: {
          rewardNumber: `${orig.rewardNumber}-CB`,
          partnerName: orig.partnerName,
          recipientName: orig.recipientName,
          type: orig.type,
          amount: -Math.abs(orig.amount),
          currency: orig.currency,
          amountBase: -Math.abs(orig.amountBase),
          fromActivity: `CLAWBACK: ${orig.fromActivity}`,
          fromRewardRule: orig.fromRewardRule,
          status: "Clawed back",
          comment: `Negative clawback adjustment for ${orig.rewardNumber}: ${
            payload.reason || "Payment refunded"
          }`,
        },
      });
      await writeAudit({
        session,
        action: "CLAWBACK",
        objectType: "Reward",
        objectId: orig.id,
        summary: `Clawed back reward ${orig.rewardNumber} -> negative adjustment ${clawbackAdjustment.rewardNumber} (${ws.mainCurrency} ${toMajorUnits(clawbackAdjustment.amountBase)})`,
      });
      return NextResponse.json({ ok: true, clawbackAdjustment });
    }

    case "CREATE_PAYOUT": {
      const partnerName = String(payload.partnerName || "").trim();
      if (!partnerName) {
        return NextResponse.json(
          { error: "Partner name is required to create a payout." },
          { status: 400 }
        );
      }
      const eligibleRewards = await prisma.reward.findMany({
        where: {
          partnerName,
          payoutId: null,
          status: { in: ["Pending", "Accepted"] },
        },
      });
      if (eligibleRewards.length === 0) {
        return NextResponse.json(
          {
            error: `Cannot create payout for "${partnerName}": 0 unbatched eligible rewards found`,
          },
          { status: 400 }
        );
      }
      const sumMinorBase = eligibleRewards.reduce(
        (acc, r) => acc + r.amountBase,
        0
      );
      const payoutCurrency = String(payload.currency || ws.mainCurrency)
        .trim()
        .toUpperCase();
      const payoutNumber = `PO-${todayIso.slice(0, 4)}-${Math.floor(
        10 + Math.random() * 89
      )}`;
      const payout = await prisma.payout.create({
        data: {
          payoutNumber,
          name: payload.name || `Partner Payout Settlement — ${partnerName}`,
          partnerName,
          amount: sumMinorBase,
          currency: payoutCurrency,
          amountBase: sumMinorBase,
          periodFrom: payload.periodFrom || `${todayIso.slice(0, 7)}-01`,
          periodTo: payload.periodTo || todayIso,
          rewardsCount: eligibleRewards.length,
          status: "Ready",
          invoiceRef: `SELF-INV-${Math.floor(100 + Math.random() * 899)}`,
        },
      });
      await prisma.reward.updateMany({
        where: { id: { in: eligibleRewards.map((r) => r.id) } },
        data: {
          status: "Accepted",
          payoutNumber,
          payoutId: payout.id,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Payout",
        objectId: payout.id,
        summary: `Created payout ${payout.payoutNumber} for ${partnerName} (${ws.mainCurrency} ${toMajorUnits(sumMinorBase)} across ${eligibleRewards.length} linked rewards)`,
      });
      return NextResponse.json({ ok: true, payout });
    }

    case "MARK_PAYOUT_PAID": {
      const existing = await prisma.payout.findUnique({
        where: { id: payload.id },
        include: { rewards: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!existing.rewards || existing.rewards.length === 0) {
        return NextResponse.json(
          {
            error: `Cannot mark payout ${existing.payoutNumber} Paid: 0 linked rewards`,
          },
          { status: 400 }
        );
      }
      const computedSumMinorBase = existing.rewards.reduce(
        (s, r) => s + r.amountBase,
        0
      );
      const connectorRes = executePayoutConnector({
        ...existing,
        amountBase: toMajorUnits(computedSumMinorBase),
      });
      const payout = await prisma.payout.update({
        where: { id: payload.id },
        data: {
          amount: computedSumMinorBase,
          amountBase: computedSumMinorBase,
          rewardsCount: existing.rewards.length,
          status: "Paid",
          paidDate: todayIso,
        },
      });
      await prisma.reward.updateMany({
        where: { payoutId: payout.id },
        data: { status: "Paid" },
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "Payout",
        objectId: payout.id,
        summary: `Marked payout ${payout.payoutNumber} Paid (${ws.mainCurrency} ${toMajorUnits(computedSumMinorBase)}) via ${connectorRes.driver} driver (${connectorRes.settlementReference})`,
      });
      return NextResponse.json({ ok: true, payout });
    }

    case "CREATE_TASK": {
      const task = await prisma.task.create({
        data: {
          name: String(payload.name || "").trim(),
          status: payload.status || "Upcoming",
          type: payload.type || "Follow-up",
          dueDate: payload.dueDate || todayIso,
          dueTime: payload.dueTime || "09:00 AM",
          description: payload.description || "",
          assignedToId: payload.assignedToId || session.userId,
          assignedTo: payload.assignedTo || session.name,
          associationType: payload.associationType || "Partner",
          associationName: String(payload.associationName || "").trim(),
          createdBy: session.name,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Task",
        objectId: task.id,
        summary: `Created task "${task.name}"`,
      });
      return NextResponse.json({ ok: true, task });
    }

    case "TOGGLE_TASK": {
      const existing = await prisma.task.findUnique({
        where: { id: payload.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const nextStatus =
        existing.status === "Completed" ? "Upcoming" : "Completed";
      const task = await prisma.task.update({
        where: { id: payload.id },
        data: {
          status: nextStatus,
          completedBy: nextStatus === "Completed" ? session.name : "",
          completedDate: nextStatus === "Completed" ? todayIso : "",
        },
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "Task",
        objectId: task.id,
        summary: `Task "${task.name}" marked ${nextStatus}`,
      });
      return NextResponse.json({ ok: true, task });
    }

    case "CREATE_BUSINESS_PLAN": {
      const plan = await prisma.businessPlan.create({
        data: {
          name: String(payload.name || "").trim(),
          partnerName: String(payload.partnerName || "").trim(),
          partnerOwner: payload.partnerOwner || session.name,
          status: payload.status || "Active",
          description: payload.description || "",
          startDate: payload.startDate || todayIso,
          endDate: payload.endDate || "",
          achievedPct: Number(payload.achievedPct) || 0,
          targetRevBase: toMinorUnits(Number(payload.targetRevBase || 0)),
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "BusinessPlan",
        objectId: plan.id,
        summary: `Created business plan "${plan.name}"`,
      });
      return NextResponse.json({ ok: true, plan });
    }

    case "CREATE_PROGRAM": {
      const prog = await prisma.program.create({
        data: {
          name: String(payload.name || "").trim(),
          ownerId: payload.ownerId || session.userId,
          owner: payload.owner || session.name,
          onboardingPipelineId:
            String(payload.onboardingPipelineId || "Default Onboarding").trim(),
          levelsJson:
            typeof payload.levelsJson === "string"
              ? payload.levelsJson
              : JSON.stringify([
                  {
                    id: `lvl-${Date.now()}`,
                    name: "Standard",
                    badgeColor: "blue",
                    rewards: [],
                    benefits: [],
                    requirements: [],
                  },
                ]),
          autoEmailsJson:
            typeof payload.autoEmailsJson === "string"
              ? payload.autoEmailsJson
              : "{}",
          permissionsJson:
            typeof payload.permissionsJson === "string"
              ? payload.permissionsJson
              : "{}",
          termsRequired: Boolean(payload.termsRequired ?? true),
          termsUrl: String(payload.termsUrl || ""),
          revenueStrategy: payload.revenueStrategy || null,
          partnerCount: 0,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Program",
        objectId: prog.id,
        summary: `Created partner program "${prog.name}"`,
      });
      return NextResponse.json({ ok: true, program: prog });
    }

    case "DUPLICATE_PROGRAM": {
      const source = await prisma.program.findUnique({
        where: { id: payload.id },
      });
      if (!source) {
        return NextResponse.json(
          { error: "Program not found" },
          { status: 404 }
        );
      }
      const copy = await prisma.program.create({
        data: {
          name: `${source.name} (Copy)`,
          ownerId: session.userId,
          owner: session.name,
          onboardingPipelineId: source.onboardingPipelineId,
          levelsJson: source.levelsJson,
          autoEmailsJson: source.autoEmailsJson,
          termsRequired: source.termsRequired,
          termsUrl: source.termsUrl,
          revenueStrategy: source.revenueStrategy,
          permissionsJson: source.permissionsJson,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Program",
        objectId: copy.id,
        summary: `Duplicated program "${source.name}" -> "${copy.name}"`,
      });
      return NextResponse.json({ ok: true, program: copy });
    }

    case "UPDATE_PROGRAM": {
      if (payload?.data && "name" in payload.data) {
        const newName = String(payload.data.name || "").trim();
        if (!newName) {
          return NextResponse.json({ error: "Program name can't be empty." }, { status: 400 });
        }
        payload.data.name = newName;
      }
      const before = await prisma.program.findUnique({ where: { id: payload.id } });
      const prog = await prisma.program.update({
        where: { id: payload.id },
        data: payload.data,
      });
      if (payload?.data?.name && before && before.name !== prog.name) {
        // Partner and deal records keep a copy of the program name for lists and filters
        await prisma.partner.updateMany({ where: { programId: prog.id }, data: { programName: prog.name } });
        await prisma.deal.updateMany({ where: { programName: before.name }, data: { programName: prog.name } });
      }
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "Program",
        objectId: prog.id,
        summary: `Updated program "${prog.name}" configuration`,
      });
      return NextResponse.json({ ok: true, program: prog });
    }

    case "CREATE_TRACKING_LINK": {
      const programId = String(payload.programId || "").trim();
      if (!programId) {
        return NextResponse.json(
          { error: "Program ID is required to create a tracking link." },
          { status: 400 }
        );
      }
      const link = await prisma.trackingLink.create({
        data: {
          name: String(payload.name || "").trim(),
          targetUrl: String(payload.targetUrl || "").trim(),
          programId,
          partnerName: String(payload.partnerName || "").trim(),
          uniqueVisitors: 0,
          leadsCount: 0,
          customersCount: 0,
          transactionsCount: 0,
          revenuesBase: 0,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "TrackingLink",
        objectId: link.id,
        summary: `Created referral tracking link "${link.name}"`,
      });
      return NextResponse.json({ ok: true, link });
    }

    default:
      return executeWorkspaceAdminMutation(session, action, payload, todayIso);
  }
}
