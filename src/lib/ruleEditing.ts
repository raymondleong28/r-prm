// Helpers for the reward-rule builder: turn any stored rule into the editable form,
// describe a rule in one sentence, and check a rule before saving.

import { normalizeRewardRule, type StructuredRewardRule } from "./prmEngine";
import { FILTER_OPERATORS, humaniseField } from "./listControls";
import { normaliseTrigger, REWARD_TRIGGERS, type RuleCondition } from "./rewardRules";

export const TRANSACTION_RULE_TRIGGERS = new Set(["transaction_added_customer", "transaction_added_deal", "new_transaction"]);

export const AGREED_IN_WRITING = { field: "agreedBeforeAcceptance", operator: "==", value: true } as const;

export const CUSTOMER_FIELDS = ["billingFrequency", "billingPeriod", "subscriptionPlan", "status", "source", "name", "email"];
export const TRANSACTION_FIELDS = ["name", "amount", "currency", "dealName", "customerName", "monthKey"];
export const NUMBER_FIELDS = ["amount"];

/** An older field condition the builder can't edit; kept exactly as stored so amounts don't change. */
export type LegacyCondition = { field: string; operator: string; value: unknown; valueTo?: number };
export type EditorCondition = RuleCondition | typeof AGREED_IN_WRITING | LegacyCondition;

export function isLegacyCondition(c: unknown): c is LegacyCondition {
  return Boolean(c && typeof (c as { field?: unknown }).field === "string" && !(c as { type?: unknown }).type && !isAgreedInWriting(c));
}

export function isAgreedInWriting(c: unknown): boolean {
  return Boolean(c && (c as { field?: string }).field === "agreedBeforeAcceptance");
}

/**
 * Editable form of a stored rule. Older fields (duration, start month, number of months)
 * become a month-range condition with the same effect, so editing never changes amounts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toEditableRule(raw: any, baseCurrency?: string): StructuredRewardRule {
  const rule = normalizeRewardRule(raw, baseCurrency);
  const trigger = normaliseTrigger(rule.trigger);
  const conditions: EditorCondition[] = [];
  for (const c of rule.conditions || []) {
    if (isAgreedInWriting(c)) conditions.push(AGREED_IN_WRITING);
    else if (c && typeof (c as RuleCondition).type === "string") conditions.push(c as RuleCondition);
    else if (isLegacyCondition(c)) conditions.push(c);
  }
  const hasLegacy =
    rule.startOffsetMonths !== undefined || rule.durationMonths !== undefined || rule.duration !== undefined;
  if (hasLegacy && TRANSACTION_RULE_TRIGGERS.has(trigger)) {
    const start = rule.startOffsetMonths ?? 1;
    const end =
      rule.duration === "one_off" ? start : rule.durationMonths ? start + rule.durationMonths - 1 : Number.POSITIVE_INFINITY;
    if (!(start <= 1 && end === Number.POSITIVE_INFINITY)) {
      conditions.unshift({ type: "month_range", fromMonth: start, toMonth: Number.isFinite(end) ? end : 9999 });
    }
  }
  const out: StructuredRewardRule = {
    ...rule,
    trigger,
    conditions,
    currency: rule.currency || baseCurrency,
  };
  delete out.duration;
  delete out.startOffsetMonths;
  delete out.durationMonths;
  return out;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function opLabel(op: string): string {
  return FILTER_OPERATORS.find((o) => o.id === op)?.label || op;
}

export function describeCondition(c: EditorCondition): string {
  if (isAgreedInWriting(c)) return "if a rate was agreed in writing before the order was accepted";
  if (isLegacyCondition(c)) {
    const range = c.operator === "between" ? `between ${c.value} and ${c.valueTo}` : `${c.operator} ${String(c.value)}`;
    return `if ${humaniseField(c.field).toLowerCase()} ${range}`;
  }
  const rc = c as RuleCondition;
  switch (rc.type) {
    case "month_range":
      return rc.toMonth >= 9999
        ? `from month ${rc.fromMonth} onwards`
        : rc.fromMonth === rc.toMonth
          ? `in month ${rc.fromMonth} only`
          : `from month ${rc.fromMonth} to month ${rc.toMonth}`;
    case "transaction_count":
      return rc.from === rc.to
        ? `on the customer's ${ordinal(rc.from)} transaction`
        : `from the customer's ${ordinal(rc.from)} to ${ordinal(rc.to)} transaction`;
    case "transaction_sum":
      return `when the customer's transactions total ${rc.operator === "gte" ? "at least" : "at most"} ${rc.value.toLocaleString()}`;
    case "transaction_property":
      return `if the transaction's ${humaniseField(rc.field).toLowerCase()} ${opLabel(rc.operator)}${rc.value !== "" ? ` "${rc.value}"` : ""}`;
    case "customer_property":
      return `if the customer's ${humaniseField(rc.field).toLowerCase()} ${opLabel(rc.operator)}${rc.value !== "" ? ` "${rc.value}"` : ""}`;
    default:
      return "";
  }
}

/** One-sentence summary, e.g. "20% of amount for every transaction added on a customer, from month 4 to month 15". */
export function describeRule(rule: StructuredRewardRule, baseCurrency = ""): string {
  const trigger = normaliseTrigger(rule.trigger);
  const triggerLabel = (REWARD_TRIGGERS.find((t) => t.id === trigger)?.label || "event").toLowerCase();
  let amount: string;
  if (rule.amountMode === "fixed") amount = `${rule.currency || baseCurrency} ${rule.rateOrAmount.toLocaleString()}`;
  else if (rule.amountMode === "one_month_subscription") amount = "one month's subscription fee";
  else if (rule.rateSteps && rule.rateSteps.length > 0)
    amount = rule.rateSteps.map((s) => `${s.ratePct}% (months ${s.fromMonth}–${s.toMonth})`).join(" then ") + ` of ${humaniseField(rule.percentOfField || "amount").toLowerCase()}`;
  else if (rule.rateOrAmount === 0 && (rule.conditions || []).some(isAgreedInWriting)) amount = "the agreed rate";
  else amount = `${rule.rateOrAmount}% of ${humaniseField(rule.percentOfField || "amount").toLowerCase()}`;
  const conds = (rule.conditions || []).map((c) => describeCondition(c as EditorCondition)).filter(Boolean);
  const every = TRANSACTION_RULE_TRIGGERS.has(trigger) ? "every" : "each";
  return `${amount} for ${every} ${triggerLabel.replace(/^new /, "new ")}${conds.length ? ", " + conds.join(", ") : ""}.`;
}

/** Problems that stop a rule from saving (empty list = fine). */
export function validateRule(rule: StructuredRewardRule): string[] {
  const errors: string[] = [];
  if (!rule.title?.trim()) errors.push("Give the reward a label.");
  const agreed = (rule.conditions || []).some(isAgreedInWriting);
  if (rule.amountMode === "percentage") {
    if (rule.rateSteps && rule.rateSteps.length > 0) {
      const steps = [...rule.rateSteps].sort((a, b) => a.fromMonth - b.fromMonth);
      steps.forEach((s, i) => {
        if (!(s.fromMonth >= 1 && s.toMonth >= s.fromMonth)) errors.push(`Rate step ${i + 1}: "to month" must be on or after "from month".`);
        if (!(s.ratePct > 0)) errors.push(`Rate step ${i + 1}: rate must be more than 0%.`);
        if (i > 0 && s.fromMonth <= steps[i - 1].toMonth) errors.push("Rate steps overlap.");
      });
    } else if (!(rule.rateOrAmount > 0) && !agreed) {
      errors.push("Enter a percentage above 0.");
    }
    if (rule.rateOrAmount > 100) errors.push("A percentage can't be more than 100%.");
  }
  if (rule.amountMode === "fixed" && !(rule.rateOrAmount > 0)) errors.push("Enter an amount above 0.");
  for (const c of rule.conditions || []) {
    if (isAgreedInWriting(c) || isLegacyCondition(c)) continue;
    const rc = c as RuleCondition;
    if (rc.type === "month_range" && !(rc.fromMonth >= 1 && rc.toMonth >= rc.fromMonth)) errors.push("Month range: \"to\" must be on or after \"from\".");
    if (rc.type === "transaction_count" && !(rc.from >= 1 && rc.to >= rc.from)) errors.push("Transaction range: \"to\" must be on or after \"from\".");
    if (rc.type === "transaction_sum" && !(Number.isFinite(rc.value) && rc.value >= 0)) errors.push("Running total needs a number.");
    if ((rc.type === "transaction_property" || rc.type === "customer_property") && !rc.field) errors.push("Choose a field for each field condition.");
    const needsValue = FILTER_OPERATORS.find((o) => o.id === (rc as { operator?: string }).operator)?.needsValue;
    if ((rc.type === "transaction_property" || rc.type === "customer_property") && needsValue && !String(rc.value).trim()) errors.push("Field conditions need a value.");
  }
  return errors;
}
