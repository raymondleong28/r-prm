import { prisma } from "./prisma";
import { toMajorUnits, type GeneratedRewardResult } from "./prmEngine";
import { customerHistoryPosition, rewardsForEvent, sortableMonthKey, type RewardEvent } from "./rewardRules";

// Turns live events (transaction recorded, deal won, lead accepted) into reward records,
// using the partner's level rules. Safe to call more than once for the same event.

export async function nextRewardNumber(): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number | string }>>(
    `SELECT nextval('"reward_number_seq"')::text AS n`
  );
  return `RW-${String(rows[0]?.n ?? "")}`;
}

/** Saves generated rewards; a reward whose rule already paid for this event is skipped. */
export async function persistGeneratedRewards(
  generated: GeneratedRewardResult[],
  sourceId: string
): Promise<{ created: number; skipped: number; rewardIds: string[] }> {
  let created = 0;
  let skipped = 0;
  const rewardIds: string[] = [];
  for (const g of generated) {
    const sourceKey = `${g.ruleId}::${sourceId}`;
    const existing = await prisma.reward.findUnique({ where: { sourceKey } });
    if (existing) {
      skipped++;
      continue;
    }
    try {
      const row = await prisma.reward.create({
        data: {
          rewardNumber: await nextRewardNumber(),
          partnerName: g.partnerName,
          recipientName: g.partnerName,
          type: g.valueType,
          amount: g.amountMinor,
          currency: g.currency,
          amountBase: g.amountBaseMinor,
          fromActivity: g.fromActivity,
          fromRewardRule: g.ruleTitle,
          status: g.status === "Validated" ? "Accepted" : "Pending",
          sourceKey,
          comment: `Rule "${g.ruleTitle}"${g.billingMonth ? ` · month ${g.billingMonth}` : ""} · FX ${g.fxRate} (${g.fxRateDate})`,
        },
      });
      rewardIds.push(row.id);
      created++;
    } catch (err) {
      // Another request saved the same reward first (unique sourceKey): not a second payment
      if (String(err).includes("Unique constraint") || String(err).includes("P2002")) {
        skipped++;
        continue;
      }
      throw err;
    }
  }
  return { created, skipped, rewardIds };
}

async function partnerAndPrograms(partnerName: string) {
  const [partner, programs] = await Promise.all([
    prisma.partner.findFirst({ where: { name: partnerName } }),
    prisma.program.findMany(),
  ]);
  return { partner, programs };
}

function cancelledBefore(customer: { status: string; canceledDate: string }, txMonthKey: string): boolean {
  if (customer.status !== "Canceled") return false;
  const cancelMonth = String(customer.canceledDate || "").slice(0, 7);
  if (!cancelMonth) return true; // cancelled, date unknown: treat as cancelled
  return cancelMonth <= sortableMonthKey(txMonthKey);
}

export async function buildTransactionEvent(transactionId: string): Promise<RewardEvent | null> {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) return null;
  const customer = tx.customerId ? await prisma.customer.findUnique({ where: { id: tx.customerId } }) : null;
  const history = customer
    ? await prisma.transaction.findMany({
        where: { customerId: customer.id },
        select: { id: true, monthKey: true, createdAt: true, amountBase: true },
      })
    : [];
  const pos = customer
    ? customerHistoryPosition(
        { id: tx.id, monthKey: tx.monthKey, createdAt: tx.createdAt, amountBase: tx.amountBase },
        history
      )
    : { monthIndex: 1, transactionIndex: 1, runningSum: toMajorUnits(tx.amountBase) };
  const amount = toMajorUnits(tx.amount);
  return {
    trigger: customer ? "transaction_added_customer" : tx.dealName ? "transaction_added_deal" : "new_transaction",
    sourceId: tx.id,
    sourceLabel: tx.name,
    partnerName: tx.partnerName,
    currency: tx.currency,
    amount,
    record: { ...tx, amount, amountBase: toMajorUnits(tx.amountBase) },
    customer: customer ? { ...customer, revenuesBase: toMajorUnits(customer.revenuesBase) } : null,
    hasDeal: Boolean(tx.dealName),
    monthIndex: pos.monthIndex,
    transactionIndex: pos.transactionIndex,
    runningSum: pos.runningSum,
    monthlySubscriptionFee: amount,
    // A customer counts as the partner's client unless it had already cancelled when this transaction happened
    isStillPartnerClient: customer ? !cancelledBefore(customer, sortableMonthKey(tx.monthKey) || tx.createdAt.toISOString().slice(0, 7)) : true,
  };
}

export async function generateRewardsForTransaction(transactionId: string, baseCurrency?: string) {
  const event = await buildTransactionEvent(transactionId);
  if (!event) return { created: 0, skipped: 0, rewardIds: [] as string[] };
  const { partner, programs } = await partnerAndPrograms(event.partnerName);
  if (!partner) return { created: 0, skipped: 0, rewardIds: [] as string[] };
  return persistGeneratedRewards(rewardsForEvent(partner, programs, event, undefined, baseCurrency), event.sourceId);
}

export async function generateRewardsForDealWon(dealId: string, baseCurrency?: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || deal.stage !== "Closed Won") return { created: 0, skipped: 0, rewardIds: [] as string[] };
  const { partner, programs } = await partnerAndPrograms(deal.partnerName);
  if (!partner) return { created: 0, skipped: 0, rewardIds: [] as string[] };
  const amount = toMajorUnits(deal.amount);
  const event: RewardEvent = {
    trigger: "deal_closed_won",
    sourceId: deal.id,
    sourceLabel: deal.name,
    partnerName: deal.partnerName,
    currency: deal.currency,
    amount,
    record: { ...deal, amount, amountBase: toMajorUnits(deal.amountBase) },
  };
  return persistGeneratedRewards(rewardsForEvent(partner, programs, event, undefined, baseCurrency), deal.id);
}

export async function generateRewardsForLeadAccepted(leadId: string, baseCurrency?: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.status !== "Accepted" || !lead.sourcePartnerName) {
    return { created: 0, skipped: 0, rewardIds: [] as string[] };
  }
  const { partner, programs } = await partnerAndPrograms(lead.sourcePartnerName);
  if (!partner) return { created: 0, skipped: 0, rewardIds: [] as string[] };
  const event: RewardEvent = {
    trigger: "lead_accepted",
    sourceId: lead.id,
    sourceLabel: `Lead ${lead.firstName} ${lead.lastName}${lead.company ? ` · ${lead.company}` : ""}`.trim(),
    partnerName: lead.sourcePartnerName,
    currency: baseCurrency || "",
    amount: 0,
    record: { ...lead },
  };
  return persistGeneratedRewards(rewardsForEvent(partner, programs, event, undefined, baseCurrency), lead.id);
}
