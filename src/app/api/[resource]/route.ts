import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computePartnerKpis,
  computeAccountOverlaps,
  normalizeRewardRule,
  canPartnerAccessAsset,
  SUPPORTED_CURRENCIES,
  toMajorUnits,
} from "@/lib/prmEngine";
import { getActiveServerSession } from "@/lib/authSession";
import { decryptBankDetails } from "@/lib/connectors";
import {
  serializePartnerForPartner,
  serializeProgramForPartner,
  serializeLeadForPartner,
  serializeDealForPartner,
  serializeCustomerForPartner,
  serializeTransactionForPartner,
  serializeRewardForPartner,
  serializePayoutForPartner,
  serializeManageItemForPartner,
  serializeBusinessPlanForPartner,
  serializeCollaborationForPartner,
  serializeTrackingLinkForPartner,
  serializeTeamMemberForPartner,
  serializeNoteForPartner,
  serializeSettingsForPartner,
} from "@/lib/partnerSerializer";
import { executeResourceMutation } from "@/lib/resourceMutations";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { resource: string } }
) {
  const session = await getActiveServerSession(req);
  if (!session) {
    return NextResponse.json(
      {
        lookupStatus: "could_not_check",
        error: "Authentication required: missing, expired, or revoked session",
      },
      { status: 401 }
    );
  }

  const { resource } = params;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  try {
    const effectivePartnerId =
      session.identityType === "partner"
        ? session.partnerId
        : session.impersonatingPartnerId || null;

    const scopedPartner = effectivePartnerId
      ? await prisma.partner.findUnique({ where: { id: effectivePartnerId } })
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let records: any[] = [];

    switch (resource) {
      case "partners": {
        const [partnersRaw, leads, dealsRaw, rewardsRaw] = await Promise.all([
          prisma.partner.findMany({ orderBy: { createdAt: "desc" } }),
          prisma.lead.findMany(),
          prisma.deal.findMany(),
          prisma.reward.findMany(),
        ]);
        const deals = dealsRaw.map((d) => ({
          ...d,
          amount: toMajorUnits(d.amount),
          amountBase: toMajorUnits(d.amountBase),
        }));
        const rewards = rewardsRaw.map((r) => ({
          ...r,
          amount: toMajorUnits(r.amount),
          amountBase: toMajorUnits(r.amountBase),
        }));
        const computed = partnersRaw.map((p) => {
          const decryptedToken =
            p.leadFormTokenCipher && p.leadFormTokenCipher.startsWith("enc:v1:")
              ? decryptBankDetails(p.leadFormTokenCipher)
              : "";
          const kpis = computePartnerKpis(
            { ...p, leadFormToken: decryptedToken },
            leads,
            deals,
            rewards
          );
          const {
            leadFormTokenHash: _h,
            leadFormTokenCipher: _c,
            ...cleanPartner
          } = kpis;
          return cleanPartner;
        });
        const scoped = scopedPartner
          ? computed.filter((p) => p.id === scopedPartner.id)
          : computed;

        if (session.identityType === "partner") {
          records = scoped.map((p) => {
            const includeBank = Boolean(id && session.role === "Manager");
            const serialized = serializePartnerForPartner(p, includeBank);
            if (includeBank && p.bankDetailsJson) {
              return {
                ...serialized,
                bankDetailsJson: decryptBankDetails(p.bankDetailsJson),
              };
            }
            return serialized;
          });
          break;
        }

        if (!id) {
          records = scoped.map(({ bankDetailsJson: _bank, ...rest }) => rest);
        } else {
          records = scoped.map((p) => ({
            ...p,
            bankDetailsJson: decryptBankDetails(p.bankDetailsJson),
          }));
        }
        break;
      }

      case "programs": {
        const [programsRaw, partnersRaw, leads, dealsRaw, rewardsRaw] =
          await Promise.all([
            prisma.program.findMany({ orderBy: { createdAt: "asc" } }),
            prisma.partner.findMany(),
            prisma.lead.findMany(),
            prisma.deal.findMany(),
            prisma.reward.findMany(),
          ]);
        const deals = dealsRaw.map((d) => ({
          ...d,
          amount: toMajorUnits(d.amount),
          amountBase: toMajorUnits(d.amountBase),
        }));
        const rewards = rewardsRaw.map((r) => ({
          ...r,
          amount: toMajorUnits(r.amount),
          amountBase: toMajorUnits(r.amountBase),
        }));
        const computedPartners = partnersRaw.map((p) =>
          computePartnerKpis(p, leads, deals, rewards)
        );

        if (session.identityType === "partner" && scopedPartner) {
          const ownProg = programsRaw.find(
            (pr) =>
              pr.id === scopedPartner.programId ||
              pr.name === scopedPartner.programName
          );
          records = ownProg
            ? [
                serializeProgramForPartner(
                  ownProg,
                  scopedPartner.qualifyingLevel
                ),
              ]
            : [];
          break;
        }

        records = programsRaw.map((prog) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let levels: any[] = [];
          try {
            levels = JSON.parse(prog.levelsJson || "[]");
          } catch {
            levels = [];
          }
          const normalizedLevels = levels.map((lvl) => ({
            ...lvl,
            rewards: Array.isArray(lvl.rewards)
              ? lvl.rewards.map((r: unknown) => normalizeRewardRule(r))
              : [],
          }));
          const progPartners = computedPartners.filter(
            (p) => p.programId === prog.id || p.programName === prog.name
          );
          return {
            ...prog,
            levelsJson: JSON.stringify(normalizedLevels),
            partnerCount: progPartners.length,
            pendingApplications: progPartners.filter(
              (p) => p.status === "Pending"
            ).length,
            submittedLeads365d: progPartners.reduce(
              (s, p) => s + p.submittedLeads365d,
              0
            ),
            registeredDeals365d: progPartners.reduce(
              (s, p) => s + p.registeredDeals365d,
              0
            ),
            sourcedRevenue365d: progPartners.reduce(
              (s, p) => s + p.sourcedRevenue365d,
              0
            ),
            influencedRev365d: progPartners.reduce(
              (s, p) => s + p.influencedRev365d,
              0
            ),
          };
        });
        break;
      }

      case "leads":
        records = await prisma.lead.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (l) => l.sourcePartnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeLeadForPartner);
          }
        }
        break;

      case "deals": {
        const rawDeals = await prisma.deal.findMany({
          orderBy: { createdAt: "desc" },
        });
        records = rawDeals.map((d) => ({
          ...d,
          amountMinor: d.amount,
          amountBaseMinor: d.amountBase,
          amount: toMajorUnits(d.amount),
          amountBase: toMajorUnits(d.amountBase),
        }));
        if (scopedPartner) {
          records = records.filter(
            (d) => d.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeDealForPartner);
          }
        }
        break;
      }

      case "customers": {
        const rawCustomers = await prisma.customer.findMany({
          orderBy: { createdAt: "desc" },
        });
        records = rawCustomers.map((c) => ({
          ...c,
          revenuesBaseMinor: c.revenuesBase,
          revenuesBase: toMajorUnits(c.revenuesBase),
        }));
        if (scopedPartner) {
          records = records.filter(
            (c) => c.sourcePartnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeCustomerForPartner);
          }
        }
        break;
      }

      case "transactions": {
        const rawTxs = await prisma.transaction.findMany({
          orderBy: { createdAt: "desc" },
        });
        records = rawTxs.map((t) => ({
          ...t,
          amountMinor: t.amount,
          amountBaseMinor: t.amountBase,
          amount: toMajorUnits(t.amount),
          amountBase: toMajorUnits(t.amountBase),
        }));
        if (scopedPartner) {
          records = records.filter(
            (t) => t.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeTransactionForPartner);
          }
        }
        break;
      }

      case "rewards": {
        const rawRewards = await prisma.reward.findMany({
          orderBy: { createdAt: "desc" },
        });
        records = rawRewards.map((r) => ({
          ...r,
          amountMinor: r.amount,
          amountBaseMinor: r.amountBase,
          amount: toMajorUnits(r.amount),
          amountBase: toMajorUnits(r.amountBase),
        }));
        if (scopedPartner) {
          records = records.filter(
            (r) => r.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeRewardForPartner);
          }
        }
        break;
      }

      case "payouts": {
        const [payoutsWithRewards, acctRow] = await Promise.all([
          prisma.payout.findMany({
            include: { rewards: true },
            orderBy: { createdAt: "desc" },
          }),
          prisma.appSetting.findUnique({ where: { key: "account_settings" } }),
        ]);
        let baseCurrency = SUPPORTED_CURRENCIES[0];
        if (acctRow?.valueJson) {
          try {
            baseCurrency =
              JSON.parse(acctRow.valueJson).mainCurrency || baseCurrency;
          } catch {
            // ignore
          }
        }
        const computedPayouts = payoutsWithRewards.map((po) => {
          const linked = po.rewards || [];
          const computedMinorBase = linked.reduce(
            (s, r) => s + Number(r.amountBase || 0),
            0
          );
          const computedMajorBase = toMajorUnits(computedMinorBase);
          return {
            ...po,
            amountMinor: computedMinorBase,
            amountBaseMinor: computedMinorBase,
            amount: computedMajorBase,
            currency: po.currency || baseCurrency,
            amountBase: computedMajorBase,
            rewardsCount: linked.length,
          };
        });
        if (scopedPartner) {
          records = computedPayouts
            .filter((p) => p.partnerName === scopedPartner.name)
            .map(serializePayoutForPartner);
        } else {
          records = computedPayouts;
        }
        break;
      }

      case "tasks":
        if (session.identityType === "partner") {
          return NextResponse.json(
            {
              lookupStatus: "could_not_check",
              error: "Forbidden for partner role",
            },
            { status: 403 }
          );
        }
        records = await prisma.task.findMany({ orderBy: { dueDate: "asc" } });
        break;

      case "assets": {
        const allAssets = await prisma.manageItem.findMany({
          where: { category: "assets" },
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          const allowed = allAssets.filter((a) =>
            canPartnerAccessAsset(a, scopedPartner)
          );
          records =
            session.identityType === "partner"
              ? allowed.map((a) =>
                  serializeManageItemForPartner(
                    a,
                    scopedPartner.name,
                    scopedPartner.programName
                  )
                )
              : allowed;
        } else {
          records = allAssets;
        }
        break;
      }

      case "manage-items": {
        const allItems = await prisma.manageItem.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          const allowed = allItems.filter((item) => {
            if (item.category === "assets") {
              return canPartnerAccessAsset(item, scopedPartner);
            }
            return ["news", "help_articles", "certifications"].includes(
              item.category
            );
          });
          records =
            session.identityType === "partner"
              ? allowed.map((item) =>
                  serializeManageItemForPartner(
                    item,
                    scopedPartner.name,
                    scopedPartner.programName
                  )
                )
              : allowed;
        } else {
          records = allItems;
        }
        break;
      }

      case "business-plans": {
        const rawPlans = await prisma.businessPlan.findMany({
          orderBy: { createdAt: "desc" },
        });
        records = rawPlans.map((bp) => ({
          ...bp,
          targetRevBaseMinor: bp.targetRevBase,
          targetRevBase: toMajorUnits(bp.targetRevBase),
        }));
        if (scopedPartner) {
          records = records.filter(
            (bp) => bp.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeBusinessPlanForPartner);
          }
        }
        break;
      }

      case "accounts": {
        if (session.identityType === "partner") {
          return NextResponse.json(
            {
              lookupStatus: "could_not_check",
              error: "Forbidden for partner role",
            },
            { status: 403 }
          );
        }
        const raw = await prisma.accountRecord.findMany({
          orderBy: { createdAt: "desc" },
        });
        records = computeAccountOverlaps(raw);
        break;
      }

      case "collaborations":
        records = await prisma.collaboration.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (c) => c.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeCollaborationForPartner);
          }
        }
        break;

      case "data-sources":
        if (session.identityType === "partner") {
          return NextResponse.json(
            {
              lookupStatus: "could_not_check",
              error: "Forbidden for partner role",
            },
            { status: 403 }
          );
        }
        records = await prisma.dataSource.findMany({
          orderBy: { createdAt: "desc" },
        });
        break;

      case "tracking-links": {
        const rawLinks = await prisma.trackingLink.findMany({
          orderBy: { createdAt: "desc" },
        });
        records = rawLinks.map((lnk) => ({
          ...lnk,
          revenuesBaseMinor: lnk.revenuesBase,
          revenuesBase: toMajorUnits(lnk.revenuesBase),
        }));
        if (scopedPartner) {
          records = records.filter(
            (l) => l.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeTrackingLinkForPartner);
          }
        }
        break;
      }

      case "team-members":
        records = await prisma.partnerTeamMember.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (m) => m.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeTeamMemberForPartner);
          }
        }
        break;

      case "notes":
        records = await prisma.noteItem.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (n) =>
              n.isShared &&
              (n.entityId === scopedPartner.id ||
                (scopedPartner.contactFirstName &&
                  n.author
                    .toLowerCase()
                    .includes(scopedPartner.contactFirstName.toLowerCase())))
          );
          if (session.identityType === "partner") {
            records = records.map(serializeNoteForPartner);
          }
        }
        break;

      case "settings": {
        const rows = await prisma.appSetting.findMany();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settingsMap: Record<string, any> = {};
        for (const row of rows) {
          if (row.key === "smtp_config") continue;
          try {
            settingsMap[row.key] = JSON.parse(row.valueJson);
          } catch {
            settingsMap[row.key] = row.valueJson;
          }
        }
        settingsMap.email_connector_status = {
          driver: process.env.EMAIL_DRIVER || "local",
          smtpConfigured: Boolean(
            process.env.SMTP_HOST || process.env.SMTP_USER
          ),
          smtpHost: process.env.SMTP_HOST || "127.0.0.1",
          smtpPort: Number(process.env.SMTP_PORT || 587),
        };
        if (session.identityType === "partner") {
          return NextResponse.json({
            lookupStatus: "found",
            data: serializeSettingsForPartner(
              settingsMap,
              scopedPartner,
              session.email
            ),
          });
        }
        return NextResponse.json({
          lookupStatus: "found",
          data: settingsMap,
        });
      }

      default:
        return NextResponse.json(
          {
            lookupStatus: "not_found",
            reason: `Unknown resource endpoint: /api/${resource}`,
          },
          { status: 404 }
        );
    }

    if (id) {
      const found = records.find((r) => r.id === id);
      if (!found) {
        return NextResponse.json(
          {
            lookupStatus: "not_found",
            reason: `No ${resource} record found with id "${id}"`,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({ lookupStatus: "found", data: found });
    }

    return NextResponse.json({
      lookupStatus: "found",
      count: records.length,
      data: records,
    });
  } catch (error) {
    return NextResponse.json(
      {
        lookupStatus: "could_not_check",
        reason: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getActiveServerSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    if (
      session.identityType === "partner" &&
      ![
        "CREATE_LEAD",
        "CREATE_DEAL",
        "UPDATE_PARTNER",
        "CREATE_NOTE",
      ].includes(action)
    ) {
      return NextResponse.json(
        { error: `Forbidden: Partner role cannot execute ${action}` },
        { status: 403 }
      );
    }

    return executeResourceMutation(session, action, payload);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
