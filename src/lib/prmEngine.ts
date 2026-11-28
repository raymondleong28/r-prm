// Pure, deterministic R-PRM domain engine for:
// - Computed Dashboard & Partner KPIs
// - Structured Commission & Reward Rule Evaluation, Lifecycle & Clawback
// - Multi-currency conversion with dated FX rates into workspace base currency
// - Server-side Asset & Content Scoping
// - Computed Account Mapping Overlaps
// - Timezone-aware 12-month chart window calculation

export interface DatedFxTable {
  rateDate: string;
  source: string;
  rates: Record<string, number>;
}

export const DEFAULT_FX_TABLE: DatedFxTable = {
  rateDate: "2026-11-24",
  source: "Reference FX Table",
  rates: {
    SGD: 1.0,
    USD: 1.35,
    EUR: 1.45,
    MYR: 0.3,
    GBP: 1.7,
    AUD: 0.88,
  },
};

export const SUPPORTED_CURRENCIES: string[] = Object.keys(DEFAULT_FX_TABLE.rates);

export const CURRENCY_LABELS: Record<string, string> = {
  SGD: "Singapore Dollar",
  USD: "US Dollar",
  EUR: "Euro",
  MYR: "Malaysian Ringgit",
  GBP: "British Pound",
  AUD: "Australian Dollar",
};

export function extractIanaTimezone(timezoneSetting?: string | null): string {
  const raw = String(timezoneSetting || "").trim();
  if (!raw) return "UTC";
  const candidate = raw.split(/\s+/)[0] || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

// §3.5.1: Compute the last 12 months (MM/YYYY) ending at today in the workspace timezone
export function computeLast12Months(
  timezoneSetting?: string | null,
  now: Date = new Date()
): string[] {
  const tz = extractIanaTimezone(timezoneSetting);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const yearPart = Number(parts.find((p) => p.type === "year")?.value || now.getUTCFullYear());
  const monthPart = Number(parts.find((p) => p.type === "month")?.value || now.getUTCMonth() + 1);

  const months: string[] = [];
  for (let offset = 11; offset >= 0; offset--) {
    let m = monthPart - offset;
    let y = yearPart;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    months.push(`${String(m).padStart(2, "0")}/${y}`);
  }
  return months;
}

export function currentMonthKeyInTimezone(
  timezoneSetting?: string | null,
  now: Date = new Date()
): string {
  const window12 = computeLast12Months(timezoneSetting, now);
  return window12[window12.length - 1];
}

export function currentIsoDateInTimezone(
  timezoneSetting?: string | null,
  now: Date = new Date()
): string {
  const tz = extractIanaTimezone(timezoneSetting);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value || String(now.getUTCFullYear());
  const m = parts.find((p) => p.type === "month")?.value || String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = parts.find((p) => p.type === "day")?.value || String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// F6: Money stored as integer minor units (cents) with a currency code
export function toMinorUnits(value: number | string | null | undefined): number {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function toMajorUnits(minorUnits: number | null | undefined): number {
  const num = Number(minorUnits || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num) / 100;
}

export function normalizeInputToMinorUnits(
  value: number | string | null | undefined,
  isAlreadyMinor = false
): number {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  if (isAlreadyMinor) return Math.round(num);
  return Math.round(num * 100);
}

export function convertWithDatedFx(
  amount: number,
  currency?: string,
  baseCurrency?: string,
  fxTable: DatedFxTable = DEFAULT_FX_TABLE
) {
  if (!fxTable.rateDate) {
    throw new Error("FX conversion refused: missing FX rateDate");
  }
  const anchor = Object.keys(fxTable.rates)[0];
  const targetCode = String(baseCurrency || anchor).trim().toUpperCase();
  const code = String(currency || targetCode).trim().toUpperCase();
  const sourceRate = fxTable.rates[code];
  const targetRate = fxTable.rates[targetCode];
  if (typeof sourceRate !== "number") {
    throw new Error(`FX conversion refused: unsupported currency ${code}`);
  }
  if (typeof targetRate !== "number" || targetRate <= 0) {
    throw new Error(`FX conversion refused: unsupported base currency ${targetCode}`);
  }
  const fxRate =
    code === targetCode
      ? 1
      : Math.round((sourceRate / targetRate) * 1000000) / 1000000;
  const amountBase = Math.round(amount * fxRate * 100) / 100;
  const originalAmountMinor = Math.round(amount * 100);
  const amountBaseMinor = Math.round(originalAmountMinor * fxRate);
  return {
    originalAmount: amount,
    originalAmountMinor,
    currency: code,
    baseCurrency: targetCode,
    amountBase,
    amountBaseMinor,
    fxRate,
    fxRateDate: fxTable.rateDate,
    fxSource: fxTable.source,
  };
}

export interface StructuredCondition {
  field:
    | "amount"
    | "dealType"
    | "subscriptionPlan"
    | "billingMonth"
    | "agreedBeforeAcceptance";
  operator: ">=" | "==" | "<=" | "between";
  value: string | number | boolean;
  valueTo?: number;
}

export interface RateStep {
  fromMonth: number;
  toMonth: number;
  ratePct: number;
}

export interface StructuredRewardRule {
  id: string;
  title: string;
  trigger:
    | "transaction_paid"
    | "transaction_added_customer"
    | "transaction_added_deal"
    | "new_transaction"
    | "deal_closed_won"
    | "lead_accepted"
    | "lead_converted";
  /** Legacy {field, operator} conditions and new {type, ...} conditions (see rewardRules.ts). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditions?: Array<StructuredCondition | Record<string, any>>;
  /** For percentage rules: which numeric field of the transaction/deal the % applies to (default "amount"). */
  percentOfField?: string;
  valueType: "Cash" | "Coupon" | "Gift card" | "Credit";
  amountMode: "percentage" | "fixed" | "one_month_subscription";
  rateOrAmount: number;
  currency?: string;
  duration: "one_off" | "recurring";
  startOffsetMonths?: number;
  durationMonths?: number;
  rateSteps?: RateStep[];
  requiresValidation: boolean;
  clawbackOnRefund: boolean;
}

// Upgrade legacy free-text reward JSON objects into StructuredRewardRule objects automatically
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeRewardRule(raw: any, fallbackCurrency?: string): StructuredRewardRule {
  if (raw && raw.amountMode && raw.valueType) {
    return raw as StructuredRewardRule;
  }
  const rateStr = String(raw?.rate || "10%");
  const isPct = rateStr.includes("%");
  const numericVal = parseFloat(rateStr.replace(/[^0-9.]/g, "")) || 10;
  const triggerText = String(raw?.trigger || "").toLowerCase();
  const trigger: StructuredRewardRule["trigger"] = triggerText.includes(
    "closed won"
  )
    ? "deal_closed_won"
    : triggerText.includes("lead")
    ? "lead_accepted"
    : "transaction_paid";

  return {
    id: raw?.id || `rule-${Date.now()}`,
    title: raw?.title || "Standard Commission Rule",
    trigger,
    conditions: [],
    valueType: "Cash",
    amountMode: isPct ? "percentage" : "fixed",
    rateOrAmount: numericVal,
    currency: raw?.currency || fallbackCurrency,
    duration: isPct ? "recurring" : "one_off",
    startOffsetMonths: 1,
    durationMonths: isPct ? 12 : 1,
    rateSteps: [],
    requiresValidation: true,
    clawbackOnRefund: true,
  };
}

export interface MerchantInvoiceEvent {
  invoiceId: string;
  merchantName: string;
  partnerName: string;
  billingMonth: number; // 1 = month 1, 4 = month 4, etc.
  invoiceAmount: number;
  monthlySubscriptionFee?: number;
  currency: string;
  paidDate: string;
  isStillPartnerClient?: boolean;
  isRefunded?: boolean;
  // For per-deal written override before order acceptance
  agreedOverrideRatePct?: number;
  agreedBeforeAcceptanceTimestamp?: string;
  orderAcceptedTimestamp?: string;
}

export interface GeneratedRewardResult {
  idempotencyKey: string;
  ruleId: string;
  ruleTitle: string;
  partnerName: string;
  fromActivity: string;
  valueType: "Cash" | "Coupon" | "Gift card" | "Credit";
  amount: number;
  amountMinor: number;
  currency: string;
  amountBase: number;
  amountBaseMinor: number;
  fxRate: number;
  fxRateDate: string;
  status: "Pending" | "Validated";
  billingMonth: number;
}

// Editable starter commission rule templates (seeded into ManageItem category "commission_templates" so admins can edit them)
export const DEFAULT_COMMISSION_TEMPLATES: Record<
  "biz_partner_one_off" | "biz_partner_premium_recurring" | "referral_entry",
  StructuredRewardRule
> = {
  biz_partner_one_off: {
    id: "tpl-biz-oneoff",
    title: "Biz Partner — 1 Month Subscription at Month-4 Paid Invoice",
    trigger: "transaction_paid",
    valueType: "Cash",
    amountMode: "one_month_subscription",
    rateOrAmount: 100, // 100% of 1 month subscription
    duration: "one_off",
    startOffsetMonths: 4,
    durationMonths: 1,
    requiresValidation: true,
    clawbackOnRefund: true,
  },
  biz_partner_premium_recurring: {
    id: "tpl-biz-premium",
    title: "Biz Partner Premium — 20% Months 4–15, 10% Months 16–27",
    trigger: "transaction_paid",
    valueType: "Cash",
    amountMode: "percentage",
    rateOrAmount: 20,
    duration: "recurring",
    startOffsetMonths: 4,
    durationMonths: 24, // months 4..27 inclusive
    rateSteps: [
      { fromMonth: 4, toMonth: 15, ratePct: 20 },
      { fromMonth: 16, toMonth: 27, ratePct: 10 },
    ],
    requiresValidation: true,
    clawbackOnRefund: true,
  },
  referral_entry: {
    id: "tpl-referral-entry",
    title: "Referral Entry — Per-Deal Written Override Before Order Acceptance",
    trigger: "transaction_paid",
    conditions: [
      { field: "agreedBeforeAcceptance", operator: "==", value: true },
    ],
    valueType: "Cash",
    amountMode: "percentage",
    rateOrAmount: 0, // uses event.agreedOverrideRatePct when valid
    duration: "one_off",
    startOffsetMonths: 1,
    durationMonths: 1,
    requiresValidation: true,
    clawbackOnRefund: true,
  },
};

// Compute Partner KPIs dynamically from leads, deals, rewards
export function computePartnerKpis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partner: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leads: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deals: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rewards: any[]
) {
  const pLeads = leads.filter(
    (l) =>
      l.sourcePartnerName === partner.name || l.sourcePartnerId === partner.id
  );
  const pDeals = deals.filter(
    (d) => d.partnerName === partner.name || d.partnerId === partner.id
  );
  const wonDeals = pDeals.filter((d) => d.stage === "Closed Won");
  const openDeals = pDeals.filter(
    (d) => d.stage !== "Closed Won" && d.stage !== "Closed Lost"
  );
  const pRewards = rewards.filter((r) => r.partnerName === partner.name);
  const pendingRewards = pRewards.filter((r) => r.status === "Pending");

  const sourcedRevenue365d = wonDeals.reduce(
    (sum, d) => sum + Number(d.amountBase || 0),
    0
  );
  const influencedRev365d = openDeals.reduce(
    (sum, d) => sum + Number(d.amountBase || 0),
    0
  );
  const pendingRewardsAll = pendingRewards.reduce(
    (sum, r) => sum + Number(r.amountBase || 0),
    0
  );
  const winRatePct =
    pDeals.length > 0 ? Math.round((wonDeals.length / pDeals.length) * 100) : 0;

  return {
    ...partner,
    leadFormToken: partner.leadFormToken || undefined,
    submittedLeads365d: pLeads.length,
    registeredDeals365d: pDeals.length,
    wonDealsCount: wonDeals.length,
    wonDealsAmountBase: sourcedRevenue365d,
    winRatePct,
    sourcedRevenue365d,
    influencedRev365d,
    pendingRewardsAll,
    _computedAt: new Date().toISOString(),
  };
}

// F2: Random, Non-Derivable, Rotatable Per-Partner Public Lead Form Token (stored hashed in PostgreSQL)
export function hashLeadFormToken(rawToken: string): string {
  let h1 = 0xdeadbeef ^ rawToken.length;
  let h2 = 0x41c6ce57 ^ rawToken.length;
  let h3 = 0x9e3779b9 ^ rawToken.length;
  let h4 = 0x85ebca6b ^ rawToken.length;
  for (let i = 0; i < rawToken.length; i++) {
    const ch = rawToken.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 =
    Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^
    Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 =
    Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^
    Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  return `lfh_${[h1, h2, h3, h4]
    .map((x) => (x >>> 0).toString(16).padStart(8, "0"))
    .join("")}`;
}

export function generateRandomLeadFormToken(): {
  rawToken: string;
  tokenHash: string;
} {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rawToken = `lf_${hex}`;
  return {
    rawToken,
    tokenHash: hashLeadFormToken(rawToken),
  };
}

export function resolvePartnerByLeadFormToken(
  token: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partners: any[]
) {
  if (!token || !token.startsWith("lf_") || token.length < 16) {
    return null; // Reject raw partner IDs or malformed tokens
  }
  const candidateHash = hashLeadFormToken(token);
  return (
    partners.find(
      (p) =>
        (p.leadFormTokenHash && p.leadFormTokenHash === candidateHash) ||
        (p.leadFormToken && p.leadFormToken === token)
    ) || null
  );
}

// F8: Explicit program -> onboarding pipeline assignment (no name-based "referral" check or default to first program)
export function resolveExplicitProgramAndPipeline(
  programInput: { programId?: string | null; programName?: string | null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programs: any[]
): {
  programId: string;
  programName: string;
  onboardingPipeline: string;
} {
  const cleanId = String(programInput.programId || "").trim();
  const cleanName = String(programInput.programName || "").trim();
  if (!cleanId && !cleanName) {
    throw new Error(
      "Explicit programId or programName is required; cannot default to first program (F8)"
    );
  }
  const matched = programs.find(
    (p) =>
      (cleanId && p.id === cleanId) ||
      (cleanName && p.name === cleanName)
  );
  if (!matched) {
    throw new Error(
      `Program not found for "${cleanId || cleanName}"; refusing to fall back to first program (F8)`
    );
  }
  const assignedPipeline = String(matched.onboardingPipelineId || "").trim();
  if (!assignedPipeline) {
    throw new Error(
      `Program "${matched.name}" (${matched.id}) does not have an explicit onboardingPipelineId assigned (F8)`
    );
  }
  return {
    programId: matched.id,
    programName: matched.name,
    onboardingPipeline: assignedPipeline,
  };
}

// Look up a Partner's actual Level Rules from their Program
export function getPartnerLevelRules(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partner: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programs: any[]
): StructuredRewardRule[] {
  const prog = programs.find(
    (p) => p.id === partner?.programId || p.name === partner?.programName
  );
  if (!prog) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let levels: any[] = [];
  try {
    levels = JSON.parse(prog.levelsJson || "[]");
  } catch {
    levels = [];
  }
  const matchedLevel =
    levels.find((l) => l.name === partner?.qualifyingLevel) || levels[0];
  if (!matchedLevel || !Array.isArray(matchedLevel.rewards)) return [];
  return matchedLevel.rewards.map((r: unknown) =>
    normalizeRewardRule(r, partner?.currency)
  );
}

// Server-side Asset & Content Scoping
// Combination logic for "some_partners": OR across program/level, group, and partnerId
export function canPartnerAccessAsset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assetItem: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partner: any
): boolean {
  if (!assetItem || !partner) return false;
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(assetItem.metadataJson || "{}");
  } catch {
    meta = {};
  }

  const accessScope = String(meta.accessScope || "");
  if (accessScope === "my_team") {
    return false; // Internal coworkers only
  }
  if (accessScope === "everyone") {
    return true;
  }

  if (accessScope === "some_partners") {
    const allowedPrograms = Array.isArray(meta.allowedPrograms)
      ? (meta.allowedPrograms as string[])
      : [];
    const allowedLevels = Array.isArray(meta.allowedLevels)
      ? (meta.allowedLevels as string[])
      : [];
    const allowedGroups = Array.isArray(meta.allowedGroups)
      ? (meta.allowedGroups as string[])
      : [];
    const allowedPartnerIds = Array.isArray(meta.allowedPartnerIds)
      ? (meta.allowedPartnerIds as string[])
      : [];

    const matchProgram =
      allowedPrograms.includes(partner.programName) ||
      allowedPrograms.includes(partner.programId);
    const matchLevel = allowedLevels.includes(partner.qualifyingLevel);
    const matchGroup = allowedGroups.includes(partner.groupName);
    const matchPartner =
      allowedPartnerIds.includes(partner.id) ||
      allowedPartnerIds.includes(partner.name);

    return matchProgram || matchLevel || matchGroup || matchPartner;
  }

  const vis = String(
    meta.programVisibility || assetItem.subtitle || "All Programs"
  ).toLowerCase();

  if (vis.includes("all programs") || vis.includes("everyone")) {
    return true;
  }
  const pProg = String(partner.programName || "").toLowerCase();
  const pGroup = String(partner.groupName || "").toLowerCase();

  if (vis.includes("isv") && !pProg.includes("isv") && !pGroup.includes("isv")) {
    return false;
  }
  if (
    vis.includes("strategic") &&
    !pProg.includes("strategic") &&
    !pGroup.includes("cloud")
  ) {
    return false;
  }
  if (
    vis.includes("referral") &&
    !pProg.includes("referral") &&
    !pGroup.includes("growth")
  ) {
    return false;
  }

  return true;
}

// Compute Account Mapping Overlaps by matching normalized company key/domain
export function normalizeAccountKey(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(
      /\b(pte|ltd|inc|corp|group|holdings|apac|my|sg|global|supermarkets|resorts|hotels|spas|retail)\b/g,
      ""
    )
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeAccountOverlaps(accounts: any[]) {
  return accounts.map((acc) => {
    const yourKey = normalizeAccountKey(acc.accountName);
    const partnerKey = normalizeAccountKey(
      acc.partnerAccountName || acc.accountName
    );
    const computedOverlap =
      Boolean(yourKey && partnerKey) &&
      (yourKey === partnerKey ||
        yourKey.includes(partnerKey) ||
        partnerKey.includes(yourKey));
    return {
      ...acc,
      hasOverlap: computedOverlap,
      matchConfidence: computedOverlap ? "Exact Normalized Match" : "No Overlap",
    };
  });
}

// Configurable Payout Schedule Engine (Monthly or Quarterly per account, overridable per program)
export type PayoutCadence = "monthly" | "quarterly";

export interface PayoutScheduleConfig {
  cadence: PayoutCadence;
  thresholdBase: number;
}

export interface SchedulableReward {
  id: string;
  rewardNumber?: string;
  partnerName: string;
  amount: number;
  currency: string;
  amountBase: number;
  status: string;
  payoutNumber?: string;
  periodDate?: string; // YYYY-MM-DD or MM/YYYY
}

export function resolvePayoutPeriodKey(
  dateStr: string | undefined,
  cadence: PayoutCadence
): { periodKey: string; periodFrom: string; periodTo: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  const raw = String(dateStr || "").trim();
  if (/^\d{2}\/\d{4}$/.test(raw)) {
    const [m, y] = raw.split("/").map(Number);
    month = m;
    year = y;
  } else if (/^\d{4}-\d{2}/.test(raw)) {
    const [y, m] = raw.slice(0, 7).split("-").map(Number);
    year = y;
    month = m;
  }

  if (cadence === "quarterly") {
    const q = Math.floor((month - 1) / 3) + 1;
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = [3, 12].includes(endMonth) ? 31 : 30;
    return {
      periodKey: `${year}-Q${q}`,
      periodFrom: `${year}-${String(startMonth).padStart(2, "0")}-01`,
      periodTo: `${year}-${String(endMonth).padStart(2, "0")}-${lastDay}`,
    };
  }

  const lastDay = new Date(year, month, 0).getDate();
  return {
    periodKey: `${year}-${String(month).padStart(2, "0")}`,
    periodFrom: `${year}-${String(month).padStart(2, "0")}-01`,
    periodTo: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function resolvePartnerPayoutSchedule(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partner: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programs: any[],
  accountSettings?: {
    autoPayoutSchedule?: string;
    autoPayoutThresholdBase?: number;
  }
): PayoutScheduleConfig {
  const acctRaw = String(
    accountSettings?.autoPayoutSchedule || "monthly"
  ).toLowerCase();
  const defaultCadence: PayoutCadence = acctRaw.includes("quarter")
    ? "quarterly"
    : "monthly";
  const defaultThreshold = Number(
    accountSettings?.autoPayoutThresholdBase ?? 250
  );

  const prog = programs.find(
    (p) => p.id === partner?.programId || p.name === partner?.programName
  );
  if (prog) {
    try {
      const autoCfg = JSON.parse(prog.autoEmailsJson || "{}");
      if (
        autoCfg.payoutCadence === "quarterly" ||
        autoCfg.payoutCadence === "monthly"
      ) {
        return {
          cadence: autoCfg.payoutCadence,
          thresholdBase: Number(
            autoCfg.payoutThresholdBase ?? defaultThreshold
          ),
        };
      }
    } catch {
      // use account default
    }
  }

  return {
    cadence: defaultCadence,
    thresholdBase: defaultThreshold,
  };
}

export function buildScheduledPayoutBatches(
  rewards: SchedulableReward[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partners: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programs: any[],
  accountSettings?: {
    autoPayoutSchedule?: string;
    autoPayoutThresholdBase?: number;
  }
) {
  const eligible = rewards.filter(
    (r) => r.status === "Accepted" && !r.payoutNumber
  );

  const groups: Record<
    string,
    {
      partnerName: string;
      cadence: PayoutCadence;
      thresholdBase: number;
      periodKey: string;
      periodFrom: string;
      periodTo: string;
      rewards: SchedulableReward[];
    }
  > = {};

  for (const rw of eligible) {
    const partner = partners.find((p) => p.name === rw.partnerName);
    const sched = resolvePartnerPayoutSchedule(
      partner,
      programs,
      accountSettings
    );
    const period = resolvePayoutPeriodKey(rw.periodDate, sched.cadence);
    const groupKey = `${rw.partnerName}::${sched.cadence}::${period.periodKey}`;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        partnerName: rw.partnerName,
        cadence: sched.cadence,
        thresholdBase: sched.thresholdBase,
        periodKey: period.periodKey,
        periodFrom: period.periodFrom,
        periodTo: period.periodTo,
        rewards: [],
      };
    }
    groups[groupKey].rewards.push(rw);
  }

  const batches: Array<{
    payoutNumber: string;
    name: string;
    partnerName: string;
    cadence: PayoutCadence;
    periodKey: string;
    periodFrom: string;
    periodTo: string;
    amountBase: number;
    rewardsCount: number;
    rewardIds: string[];
  }> = [];

  let seq = 1;
  for (const grp of Object.values(groups)) {
    const totalBase =
      Math.round(
        grp.rewards.reduce((s, r) => s + Number(r.amountBase || 0), 0) * 100
      ) / 100;
    if (totalBase >= grp.thresholdBase) {
      batches.push({
        payoutNumber: `PO-${grp.periodKey}-${String(seq++).padStart(2, "0")}`,
        name: `${
          grp.cadence === "quarterly" ? "Quarterly" : "Monthly"
        } Auto-Payout (${grp.periodKey}) · ${grp.partnerName}`,
        partnerName: grp.partnerName,
        cadence: grp.cadence,
        periodKey: grp.periodKey,
        periodFrom: grp.periodFrom,
        periodTo: grp.periodTo,
        amountBase: totalBase,
        rewardsCount: grp.rewards.length,
        rewardIds: grp.rewards.map((r) => r.id),
      });
    }
  }

  return batches;
}

// Onboarding Stage Completion & Validation Gate Evaluator
export interface StageActionRecord {
  id: string;
  stage: string;
  actionType:
    | "view_asset"
    | "read_article"
    | "upload_document"
    | "provide_information"
    | "book_meeting"
    | "self_invoicing_opt_in";
  title: string;
  requireValidation: boolean;
  completedByPartner: boolean;
  validatedByCoworker: boolean;
}

export function evaluateOnboardingStageCompletion(
  stage: string,
  actions: StageActionRecord[]
): {
  stage: string;
  totalActions: number;
  completedCount: number;
  pendingValidationCount: number;
  isStageComplete: boolean;
} {
  const stageActions = actions.filter((a) => a.stage === stage);
  let completedCount = 0;
  let pendingValidationCount = 0;

  for (const act of stageActions) {
    if (!act.completedByPartner) {
      continue;
    }
    if (act.requireValidation && !act.validatedByCoworker) {
      pendingValidationCount++;
      continue;
    }
    completedCount++;
  }

  return {
    stage,
    totalActions: stageActions.length,
    completedCount,
    pendingValidationCount,
    isStageComplete:
      stageActions.length > 0 &&
      completedCount === stageActions.length &&
      pendingValidationCount === 0,
  };
}
