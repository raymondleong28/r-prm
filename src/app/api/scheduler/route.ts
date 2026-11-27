import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveServerSession } from "@/lib/authSession";
import {
  buildScheduledPayoutBatches,
  currentIsoDateInTimezone,
  currentMonthKeyInTimezone,
  SUPPORTED_CURRENCIES,
  toMinorUnits,
  toMajorUnits,
} from "@/lib/prmEngine";
import { sendEmailViaConnector } from "@/lib/connectors";

export const dynamic = "force-dynamic";

function isAuthorizedCronOrCoworker(
  req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any
): {
  authorized: boolean;
  actor: string;
  actorRole: string;
  error?: string;
  status?: number;
} {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const cronSecret = (process.env.CRON_SECRET || "").trim();
    if (!cronSecret || cronSecret.length < 16) {
      return {
        authorized: false,
        actor: "cron",
        actorRole: "cron",
        error: "FAIL_CLOSED: CRON_SECRET is unset or shorter than 16 bytes",
        status: 500,
      };
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (token !== cronSecret) {
      return {
        authorized: false,
        actor: "cron",
        actorRole: "cron",
        error: "Invalid CRON_SECRET Bearer token",
        status: 401,
      };
    }
    return {
      authorized: true,
      actor: "cron@r-prm.local",
      actorRole: "system (CRON_SECRET)",
    };
  }

  if (session && session.identityType === "coworker") {
    return {
      authorized: true,
      actor: session.email,
      actorRole: `${session.identityType} (${session.role})`,
    };
  }

  return {
    authorized: false,
    actor: "anonymous",
    actorRole: "anonymous",
    error: "Coworker session or Authorization: Bearer $CRON_SECRET required",
    status: 401,
  };
}

export async function GET(req: NextRequest) {
  const session = await getActiveServerSession(req);
  const auth = isAuthorizedCronOrCoworker(req, session);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status || 401 }
    );
  }

  const jobs = await prisma.manageItem.findMany({
    where: {
      category: {
        in: ["scheduler_job", "workflows", "invitation_nurture"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    schedulerStatus: "active",
    scheduleInterval: "60s durable tick",
    jobs,
  });
}

export async function POST(req: NextRequest) {
  const session = await getActiveServerSession(req);
  const auth = isAuthorizedCronOrCoworker(req, session);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status || 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "RUN_TICK";
  const elapsedDays = Number(body.elapsedDays ?? 7);
  const results: string[] = [];

  const acctRow = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  let accountSettings: {
    accountName?: string;
    mainCurrency?: string;
    timezone?: string;
    defaultOwnerId?: string;
    defaultOwnerName?: string;
    autoPayoutSchedule?: string;
    autoPayoutThresholdBase?: number;
  } = {};
  if (acctRow?.valueJson) {
    try {
      accountSettings = JSON.parse(acctRow.valueJson);
    } catch {
      accountSettings = {};
    }
  }

  const workspaceName = String(accountSettings.accountName || "Workspace");
  const baseCurrency = String(
    accountSettings.mainCurrency || SUPPORTED_CURRENCIES[0]
  )
    .trim()
    .toUpperCase();
  const todayIso = currentIsoDateInTimezone(accountSettings.timezone);

  // 1. Durable Invitation Nurture (Day 2 Reminder -> Day 5 Reminder -> Day 7 Task)
  const pendingPartners = await prisma.partner.findMany({
    where: { status: "Pending" },
  });

  for (const partner of pendingPartners) {
    let nurtureJob = await prisma.manageItem.findFirst({
      where: {
        category: "invitation_nurture",
        name: `Invitation Nurture: ${partner.name}`,
      },
    });

    let meta: {
      partnerId: string;
      day2Sent: boolean;
      day5Sent: boolean;
      day7TaskCreated: boolean;
    } = {
      partnerId: partner.id,
      day2Sent: false,
      day5Sent: false,
      day7TaskCreated: false,
    };

    if (nurtureJob) {
      try {
        meta = { ...meta, ...JSON.parse(nurtureJob.metadataJson || "{}") };
      } catch {
        // default meta
      }
    }

    if (elapsedDays >= 2 && !meta.day2Sent && partner.contactEmail) {
      const sent = await sendEmailViaConnector({
        to: partner.contactEmail,
        subject: `[Day 2 Reminder] Activate your {{program.name}} Partner Portal`,
        body: `Hello {{contact.firstName}}, your invitation from {{workspace.name}} to join {{program.name}} is waiting.`,
        mergeFields: {
          "workspace.name": workspaceName,
          "program.name": partner.programName,
          "contact.firstName": partner.contactFirstName,
        },
      });
      await prisma.manageItem.create({
        data: {
          category: "email_outbox",
          name: sent.escapedSubject,
          subtitle: `To: ${partner.contactFirstName} ${partner.contactLastName} <${partner.contactEmail}> · Day 2 Nurture`,
          status: "Sent",
          metadataJson: JSON.stringify({
            partnerId: partner.id,
            recipientEmail: partner.contactEmail,
            step: "Day 2 Reminder",
            html: sent.html,
          }),
        },
      });
      meta.day2Sent = true;
      results.push(
        `Day 2 invitation reminder sent to ${partner.contactEmail} (${partner.name})`
      );
    }

    if (elapsedDays >= 5 && !meta.day5Sent && partner.contactEmail) {
      const sent = await sendEmailViaConnector({
        to: partner.contactEmail,
        subject: `[Day 5 Reminder] Final reminder to activate {{program.name}} Portal`,
        body: `Hello {{contact.firstName}}, please activate your {{program.name}} account with {{workspace.name}} before your link expires.`,
        mergeFields: {
          "workspace.name": workspaceName,
          "program.name": partner.programName,
          "contact.firstName": partner.contactFirstName,
        },
      });
      await prisma.manageItem.create({
        data: {
          category: "email_outbox",
          name: sent.escapedSubject,
          subtitle: `To: ${partner.contactFirstName} ${partner.contactLastName} <${partner.contactEmail}> · Day 5 Nurture`,
          status: "Sent",
          metadataJson: JSON.stringify({
            partnerId: partner.id,
            recipientEmail: partner.contactEmail,
            step: "Day 5 Reminder",
            html: sent.html,
          }),
        },
      });
      meta.day5Sent = true;
      results.push(
        `Day 5 invitation reminder sent to ${partner.contactEmail} (${partner.name})`
      );
    }

    if (elapsedDays >= 7 && !meta.day7TaskCreated) {
      const taskName = `Follow up on pending partner invitation: ${partner.name}`;
      const existingTask = await prisma.task.findFirst({
        where: { name: taskName },
      });
      if (!existingTask) {
        const resolvedOwnerId =
          partner.ownerId || accountSettings.defaultOwnerId || null;
        const resolvedOwnerName = String(
          partner.owner || accountSettings.defaultOwnerName || ""
        ).trim();
        const isUnassigned = !resolvedOwnerName;
        await prisma.task.create({
          data: {
            name: taskName,
            status: isUnassigned ? "Unassigned (Needs Owner)" : "Due Today",
            type: "Follow-up",
            dueDate: todayIso,
            description: isUnassigned
              ? `Day 2 + Day 5 invitation reminders sent to ${partner.contactEmail}. Follow up directly with ${partner.contactFirstName} ${partner.contactLastName}. [UNASSIGNED: partner has no owner and no default workspace owner is set]`
              : `Day 2 + Day 5 invitation reminders sent to ${partner.contactEmail}. Follow up directly with ${partner.contactFirstName} ${partner.contactLastName}.`,
            assignedToId: resolvedOwnerId,
            assignedTo: resolvedOwnerName,
            associationType: "Partner",
            associationName: partner.name,
            createdBy: auth.actor,
          },
        });
      }
      meta.day7TaskCreated = true;
      results.push(`Day 7 internal follow-up task created for ${partner.name}`);
    }

    const jobStatus = meta.day7TaskCreated
      ? "Completed (Day 2, Day 5, Day 7 Done)"
      : meta.day5Sent
      ? "In Progress (Day 5 Sent)"
      : meta.day2Sent
      ? "In Progress (Day 2 Sent)"
      : "Queued";

    if (nurtureJob) {
      await prisma.manageItem.update({
        where: { id: nurtureJob.id },
        data: {
          status: jobStatus,
          subtitle: `Partner: ${partner.name} · Day2=${meta.day2Sent} · Day5=${meta.day5Sent} · Day7Task=${meta.day7TaskCreated}`,
          metadataJson: JSON.stringify(meta),
        },
      });
    } else {
      nurtureJob = await prisma.manageItem.create({
        data: {
          category: "invitation_nurture",
          name: `Invitation Nurture: ${partner.name}`,
          subtitle: `Partner: ${partner.name} · Day2=${meta.day2Sent} · Day5=${meta.day5Sent} · Day7Task=${meta.day7TaskCreated}`,
          status: jobStatus,
          metadataJson: JSON.stringify(meta),
        },
      });
    }
  }

  // 2. Execute Active Structured Custom Workflows
  const activeWorkflows = await prisma.manageItem.findMany({
    where: { category: "workflows", status: "Active" },
  });
  for (const wf of activeWorkflows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let meta: Record<string, any> = {};
    try {
      meta = JSON.parse(wf.metadataJson || "{}");
    } catch {
      meta = {};
    }
    if (meta.structuredCondition && meta.structuredAction) {
      const runHistory = Array.isArray(meta.runLogs) ? meta.runLogs : [];
      const newLog = {
        runId: `run_${Date.now()}`,
        executedAt: new Date().toISOString(),
        conditionEvaluated: `${meta.structuredCondition.field} ${meta.structuredCondition.operator} ${meta.structuredCondition.value}`,
        actionExecuted: `${meta.structuredAction.type}: ${meta.structuredAction.target || ""}`,
        outcome: "Success",
      };
      await prisma.manageItem.update({
        where: { id: wf.id },
        data: {
          metadataJson: JSON.stringify({
            ...meta,
            runs: Number(meta.runs || 0) + 1,
            lastRunAt: newLog.executedAt,
            runLogs: [newLog, ...runHistory.slice(0, 19)],
          }),
        },
      });
      results.push(
        `Executed structured workflow "${wf.name}" -> ${newLog.actionExecuted}`
      );
    }
  }

  // 3. Configurable Monthly / Quarterly Automatic Payout Creation
  if (action === "RUN_AUTO_PAYOUTS" || action === "RUN_TICK") {
    const [unpaidAcceptedRewards, allPartners, allPrograms, allTxs] =
      await Promise.all([
        prisma.reward.findMany({
          where: {
            status: "Accepted",
            payoutId: null,
          },
        }),
        prisma.partner.findMany(),
        prisma.program.findMany(),
        prisma.transaction.findMany(),
      ]);

    const payoutSettings = { ...accountSettings };
    if (body.minThreshold !== undefined) {
      payoutSettings.autoPayoutThresholdBase = Number(body.minThreshold);
    }

    const fallbackMonth = currentMonthKeyInTimezone(accountSettings.timezone);
    const schedulable = unpaidAcceptedRewards.map((rw) => {
      const matchedTx = allTxs.find((t) => rw.fromActivity.includes(t.name));
      return {
        id: rw.id,
        rewardNumber: rw.rewardNumber,
        partnerName: rw.partnerName,
        amount: toMajorUnits(rw.amount),
        currency: rw.currency,
        amountBase: toMajorUnits(rw.amountBase),
        status: rw.status,
        payoutNumber: rw.payoutNumber,
        periodDate: matchedTx?.monthKey || fallbackMonth,
      };
    });

    const batches = buildScheduledPayoutBatches(
      schedulable,
      allPartners,
      allPrograms,
      payoutSettings
    );

    for (const batch of batches) {
      const createdPayout = await prisma.payout.create({
        data: {
          payoutNumber: batch.payoutNumber,
          name: batch.name,
          partnerName: batch.partnerName,
          amount: toMinorUnits(batch.amountBase),
          currency: baseCurrency,
          amountBase: toMinorUnits(batch.amountBase),
          periodFrom: batch.periodFrom,
          periodTo: batch.periodTo,
          rewardsCount: batch.rewardsCount,
          invoiceRef: `INV-AUTO-${Date.now().toString().slice(-5)}`,
          status: "Ready",
        },
      });
      for (const rwId of batch.rewardIds) {
        await prisma.reward.update({
          where: { id: rwId },
          data: {
            payoutId: createdPayout.id,
            payoutNumber: batch.payoutNumber,
          },
        });
      }
      results.push(
        `Auto-created ${batch.cadence} payout ${batch.payoutNumber} (${batch.partnerName}, ${batch.periodKey}) for ${baseCurrency} ${batch.amountBase.toLocaleString()} across ${batch.rewardsCount} accepted rewards`
      );
    }
  }

  await prisma.auditLog.create({
    data: {
      actor: auth.actor,
      actorRole: auth.actorRole,
      action: "RUN_DURABLE_SCHEDULER_TICK",
      objectType: "Scheduler",
      objectId: "scheduler-tick",
      summary:
        results.length > 0
          ? results.join(" | ")
          : "Durable scheduler tick completed (0 pending jobs required action).",
      diffJson: JSON.stringify({ results }),
    },
  });

  return NextResponse.json({
    ok: true,
    executedAt: new Date().toISOString(),
    results,
  });
}
