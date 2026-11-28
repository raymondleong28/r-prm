// One reward-rule engine for live data and tests.
// A rule pays when its trigger matches the event and every condition holds (AND).
// Older rule fields (duration, start month, number of months, rate steps, legacy
// conditions) are read as conditions, so existing programs keep their meaning.

import {
  convertWithDatedFx,
  DEFAULT_FX_TABLE,
  getPartnerLevelRules,
  type DatedFxTable,
  type GeneratedRewardResult,
  type MerchantInvoiceEvent,
  type StructuredRewardRule,
} from "./prmEngine";
import { matchesFilter, type FilterOperator } from "./listControls";

export const REWARD_TRIGGERS = [
  { id: "transaction_added_customer", label: "Transaction added on a customer" },
  { id: "transaction_added_deal", label: "Transaction added on a deal" },
  { id: "new_transaction", label: "New transaction" },
  { id: "deal_closed_won", label: "Deal closed won" },
  { id: "lead_accepted", label: "New lead accepted" },
] as const;

export type RewardTrigger =
  | "transaction_added_customer"
  | "transaction_added_deal"
  | "new_transaction"
  | "deal_closed_won"
  | "lead_accepted";

/** New-style conditions (the legacy {field, operator} conditions are still read). */
export type RuleCondition =
  | { type: "month_range"; fromMonth: number; toMonth: number }
  | { type: "transaction_count"; from: number; to: number }
  | { type: "transaction_sum"; operator: "gte" | "lte"; value: number }
  | { type: "transaction_property"; field: string; operator: FilterOperator; value: string }
  | { type: "customer_property"; field: string; operator: FilterOperator; value: string };

export type RewardEvent = {
  trigger: RewardTrigger;
  /** Stable id of the thing that caused the reward (transaction, deal or lead id). */
  sourceId: string;
  /** Shown on the reward as "from activity". */
  sourceLabel: string;
  partnerName: string;
  currency: string;
  /** Amount of the transaction or deal, in major units of `currency`. */
  amount: number;
  /** Fields of the transaction / deal / lead, for property conditions and "% of field". */
  record: Record<string, unknown>;
  customer?: Record<string, unknown> | null;
  hasDeal?: boolean;
  /** Month of this transaction counted from the customer's first transaction month (1-based). */
  monthIndex?: number;
  /** This is the customer's Nth transaction (1-based). */
  transactionIndex?: number;
  /** Total of the customer's transactions up to and including this one (major units). */
  runningSum?: number;
  monthlySubscriptionFee?: number;
  isStillPartnerClient?: boolean;
  agreedOverrideRatePct?: number;
  agreedBeforeAcceptanceTimestamp?: string;
  orderAcceptedTimestamp?: string;
};

const TRANSACTION_TRIGGERS = new Set<RewardTrigger>([
  "transaction_added_customer",
  "transaction_added_deal",
  "new_transaction",
]);

/** Maps older trigger names onto the current ones. */
export function normaliseTrigger(trigger: string | undefined): RewardTrigger {
  switch (trigger) {
    case "transaction_added_customer":
    case "transaction_added_deal":
    case "new_transaction":
    case "deal_closed_won":
    case "lead_accepted":
      return trigger;
    case "lead_converted":
      return "lead_accepted";
    default:
      return "new_transaction"; // "transaction_paid" and anything unknown
  }
}

export function triggerMatches(ruleTrigger: string | undefined, event: RewardEvent): boolean {
  const t = normaliseTrigger(ruleTrigger);
  if (t === "new_transaction") return TRANSACTION_TRIGGERS.has(event.trigger);
  if (t === "transaction_added_customer") return TRANSACTION_TRIGGERS.has(event.trigger) && Boolean(event.customer);
  if (t === "transaction_added_deal") return TRANSACTION_TRIGGERS.has(event.trigger) && Boolean(event.hasDeal);
  return t === event.trigger;
}

/** Month window implied by the older fields (start month, one-off / number of months). */
function legacyMonthWindow(rule: StructuredRewardRule): [number, number] | null {
  const hasLegacy =
    rule.startOffsetMonths !== undefined || rule.durationMonths !== undefined || rule.duration !== undefined;
  if (!hasLegacy) return null;
  const start = rule.startOffsetMonths ?? 1;
  if (rule.duration === "one_off") return [start, start];
  if (rule.durationMonths) return [start, start + rule.durationMonths - 1];
  return [start, Number.POSITIVE_INFINITY];
}

function newConditions(rule: StructuredRewardRule): RuleCondition[] {
  return (Array.isArray(rule.conditions) ? rule.conditions : []).filter(
    (c): c is RuleCondition => Boolean(c && typeof (c as RuleCondition).type === "string")
  );
}

function legacyConditions(rule: StructuredRewardRule) {
  return (Array.isArray(rule.conditions) ? rule.conditions : []).filter(
    (c) => c && typeof (c as { field?: unknown }).field === "string" && !(c as RuleCondition).type
  ) as Array<{ field: string; operator: string; value: unknown; valueTo?: number }>;
}

function conditionHolds(c: RuleCondition, e: RewardEvent): boolean {
  switch (c.type) {
    case "month_range":
      return e.monthIndex !== undefined && e.monthIndex >= c.fromMonth && e.monthIndex <= c.toMonth;
    case "transaction_count":
      return e.transactionIndex !== undefined && e.transactionIndex >= c.from && e.transactionIndex <= c.to;
    case "transaction_sum":
      if (e.runningSum === undefined) return false;
      return c.operator === "gte" ? e.runningSum >= c.value : e.runningSum <= c.value;
    case "transaction_property":
      return matchesFilter(e.record, { field: c.field, operator: c.operator, value: c.value });
    case "customer_property":
      return Boolean(e.customer) && matchesFilter(e.customer!, { field: c.field, operator: c.operator, value: c.value });
    default:
      return false;
  }
}

function legacyConditionHolds(
  c: { field: string; operator: string; value: unknown; valueTo?: number },
  e: RewardEvent
): boolean {
  switch (c.field) {
    case "agreedBeforeAcceptance": {
      const hasRate = typeof e.agreedOverrideRatePct === "number" && e.agreedOverrideRatePct > 0;
      const inOrder =
        Boolean(e.agreedBeforeAcceptanceTimestamp) &&
        Boolean(e.orderAcceptedTimestamp) &&
        String(e.agreedBeforeAcceptanceTimestamp) <= String(e.orderAcceptedTimestamp);
      return hasRate && inOrder;
    }
    case "amount": {
      const v = Number(c.value);
      if (c.operator === ">=") return e.amount >= v;
      if (c.operator === "<=") return e.amount <= v;
      if (c.operator === "==") return e.amount === v;
      if (c.operator === "between") return e.amount >= v && e.amount <= Number(c.valueTo);
      return true;
    }
    case "subscriptionPlan":
      return String(e.customer?.subscriptionPlan ?? "").toLowerCase() === String(c.value).toLowerCase();
    case "dealType":
      return String(e.record.dealType ?? "").toLowerCase() === String(c.value).toLowerCase();
    case "billingMonth": {
      if (e.monthIndex === undefined) return false;
      const v = Number(c.value);
      if (c.operator === ">=") return e.monthIndex >= v;
      if (c.operator === "<=") return e.monthIndex <= v;
      if (c.operator === "==") return e.monthIndex === v;
      if (c.operator === "between") return e.monthIndex >= v && e.monthIndex <= Number(c.valueTo);
      return true;
    }
    default:
      return true;
  }
}

/** Numeric value of a record field (major units for "amount"). */
function fieldNumber(e: RewardEvent, field: string): number | null {
  if (field === "amount") return e.amount;
  const raw = e.record[field];
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && String(raw ?? "") !== "" ? n : null;
}

export type RuleEvaluation =
  | { paid: true; amount: number; currency: string; ratePct?: number }
  | { paid: false; reason: string };

/** Decides whether a rule pays for an event, and how much (major units). */
export function evaluateRuleAmount(rule: StructuredRewardRule, e: RewardEvent): RuleEvaluation {
  if (!triggerMatches(rule.trigger, e)) return { paid: false, reason: "trigger does not match" };
  const isTransaction = TRANSACTION_TRIGGERS.has(e.trigger);
  if (isTransaction && e.isStillPartnerClient === false) {
    return { paid: false, reason: "customer is no longer the partner's client" };
  }
  if (isTransaction) {
    const window = legacyMonthWindow(rule);
    if (window) {
      const m = e.monthIndex ?? 1;
      if (m < window[0] || m > window[1]) return { paid: false, reason: `month ${m} outside ${window[0]}–${window[1]}` };
    }
  }
  for (const c of newConditions(rule)) {
    if (!conditionHolds(c, e)) return { paid: false, reason: `condition ${c.type} not met` };
  }
  for (const c of legacyConditions(rule)) {
    if (!legacyConditionHolds(c, e)) return { paid: false, reason: `condition ${c.field} not met` };
  }

  if (rule.amountMode === "fixed") {
    return rule.rateOrAmount > 0
      ? { paid: true, amount: rule.rateOrAmount, currency: rule.currency || e.currency }
      : { paid: false, reason: "fixed amount is zero" };
  }
  if (rule.amountMode === "one_month_subscription") {
    const fee = e.monthlySubscriptionFee ?? e.amount;
    const share = (rule.rateOrAmount || 100) / 100;
    const amount = Math.round(fee * share * 100) / 100;
    return amount > 0 ? { paid: true, amount, currency: e.currency } : { paid: false, reason: "no subscription fee" };
  }
  // percentage
  let pct = rule.rateOrAmount;
  if (rule.rateSteps && rule.rateSteps.length > 0) {
    const m = e.monthIndex ?? 1;
    const step = rule.rateSteps.find((s) => m >= s.fromMonth && m <= s.toMonth);
    if (!step) return { paid: false, reason: `no rate step for month ${m}` };
    pct = step.ratePct;
  } else if (typeof e.agreedOverrideRatePct === "number" && rule.rateOrAmount === 0) {
    pct = e.agreedOverrideRatePct;
  }
  const base = fieldNumber(e, rule.percentOfField || "amount");
  if (base === null) return { paid: false, reason: `field ${rule.percentOfField} has no number` };
  const amount = Math.round(base * (pct / 100) * 100) / 100;
  return amount > 0 ? { paid: true, amount, currency: e.currency, ratePct: pct } : { paid: false, reason: "amount is zero" };
}

/** Full reward result with currency conversion, or null when the rule doesn't pay. */
export function evaluateRule(
  rule: StructuredRewardRule,
  e: RewardEvent,
  fxTable: DatedFxTable = DEFAULT_FX_TABLE,
  baseCurrency?: string,
  idempotencyKey = `${rule.id}::${e.sourceId}`
): GeneratedRewardResult | null {
  const result = evaluateRuleAmount(rule, e);
  if (!result.paid) return null;
  const fx = convertWithDatedFx(result.amount, result.currency, baseCurrency, fxTable);
  return {
    idempotencyKey,
    ruleId: rule.id,
    ruleTitle: rule.title,
    partnerName: e.partnerName,
    fromActivity: e.sourceLabel,
    valueType: rule.valueType || "Cash",
    amount: result.amount,
    amountMinor: fx.originalAmountMinor,
    currency: fx.currency,
    amountBase: fx.amountBase,
    amountBaseMinor: fx.amountBaseMinor,
    fxRate: fx.fxRate,
    fxRateDate: fx.fxRateDate,
    status: rule.requiresValidation ? "Pending" : "Validated",
    billingMonth: e.monthIndex ?? 0,
  };
}

/** Month keys are stored as "MM/YYYY"; also accepts "YYYY-MM". Returns "YYYY-MM" (sortable) or "". */
export function sortableMonthKey(key: string | null | undefined): string {
  const k = String(key || "").trim();
  let m = /^(\d{1,2})\/(\d{4})$/.exec(k);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = /^(\d{4})-(\d{1,2})/.exec(k);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  return "";
}

/** Months between two month keys (b − a). */
export function monthsBetween(a: string, b: string): number {
  const [ya, ma] = sortableMonthKey(a).split("-").map(Number);
  const [yb, mb] = sortableMonthKey(b).split("-").map(Number);
  if (!ya || !ma || !yb || !mb) return 0;
  return (yb - ya) * 12 + (mb - ma);
}

export type CustomerTransactionLite = { id: string; monthKey: string; createdAt: Date | string; amountBase: number };

/** Position of a transaction in its customer's history: month index, Nth transaction, running total (major base units). */
export function customerHistoryPosition(
  current: CustomerTransactionLite,
  history: CustomerTransactionLite[]
): { monthIndex: number; transactionIndex: number; runningSum: number } {
  const order = (t: CustomerTransactionLite) =>
    `${sortableMonthKey(t.monthKey) || "9999-99"}|${new Date(t.createdAt).toISOString()}|${t.id}`;
  const all = history.some((t) => t.id === current.id) ? history : [...history, current];
  const sorted = [...all].sort((x, y) => (order(x) < order(y) ? -1 : order(x) > order(y) ? 1 : 0));
  const idx = sorted.findIndex((t) => t.id === current.id);
  const upTo = sorted.slice(0, idx + 1);
  const firstMonth = sorted.find((t) => sortableMonthKey(t.monthKey))?.monthKey || current.monthKey;
  return {
    monthIndex:
      sortableMonthKey(current.monthKey) && sortableMonthKey(firstMonth)
        ? monthsBetween(firstMonth, current.monthKey) + 1
        : 1,
    transactionIndex: idx + 1,
    runningSum: upTo.reduce((s, t) => s + t.amountBase, 0) / 100,
  };
}

/** Monthly-invoice helper used by the commission fixtures (billing month = month index). */
export function evaluateRuleForInvoice(
  rule: StructuredRewardRule,
  event: MerchantInvoiceEvent,
  existingIdempotencyKeys: Set<string> = new Set(),
  fxTable: DatedFxTable = DEFAULT_FX_TABLE,
  baseCurrency?: string
): GeneratedRewardResult | null {
  const key = `${event.invoiceId}::${rule.id}::M${event.billingMonth}`;
  if (existingIdempotencyKeys.has(key)) return null;
  return evaluateRule(
    rule,
    {
      trigger: "new_transaction",
      sourceId: event.invoiceId,
      sourceLabel: `${event.invoiceId} · ${event.merchantName} (Month ${event.billingMonth})`,
      partnerName: event.partnerName,
      currency: event.currency,
      amount: event.invoiceAmount,
      record: { amount: event.invoiceAmount },
      monthIndex: event.billingMonth,
      monthlySubscriptionFee: event.monthlySubscriptionFee,
      isStillPartnerClient: event.isStillPartnerClient,
      agreedOverrideRatePct: event.agreedOverrideRatePct,
      agreedBeforeAcceptanceTimestamp: event.agreedBeforeAcceptanceTimestamp,
      orderAcceptedTimestamp: event.orderAcceptedTimestamp,
    },
    fxTable,
    baseCurrency,
    key
  );
}

/** Every reward a partner's level rules produce for one event. */
export function rewardsForEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partner: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programs: any[],
  e: RewardEvent,
  fxTable: DatedFxTable = DEFAULT_FX_TABLE,
  baseCurrency?: string
): GeneratedRewardResult[] {
  return getPartnerLevelRules(partner, programs)
    .map((rule) => evaluateRule(rule, e, fxTable, baseCurrency))
    .filter((r): r is GeneratedRewardResult => r !== null);
}
