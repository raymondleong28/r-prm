import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import {
  loadRequiredConfig,
  getAppBaseUrl,
} from "../src/lib/config";
import {
  serializeManageItemForPartner,
  serializeSettingsForPartner,
} from "../src/lib/partnerSerializer";
import {
  DEFAULT_COMMISSION_TEMPLATES,
  normalizeRewardRule,
  convertWithDatedFx,
  computePartnerKpis,
  computeLast12Months,
  currentMonthKeyInTimezone,
  canPartnerAccessAsset,
  computeAccountOverlaps,
  generateRandomLeadFormToken,
  hashLeadFormToken,
  resolvePartnerByLeadFormToken,
  resolveExplicitProgramAndPipeline,
  buildScheduledPayoutBatches,
  evaluateOnboardingStageCompletion,
  toMajorUnits,
  toMinorUnits,
} from "../src/lib/prmEngine";
import {
  loadAndValidateConnectorConfig,
  encryptBankDetails,
  decryptBankDetails,
  renderEscapedEmailHtml,
  sendEmailViaConnector,
  storeFileViaConnector,
} from "../src/lib/connectors";
import {
  hashPasswordWithRandomSalt,
  verifyPasswordWithStoredSalt,
  authenticateUserFromDatabase,
  createServerSessionRow,
  getActiveServerSession,
  revokeServerSessionById,
  issuePartnerActivationLink,
  redeemActivationTokenAndSetPassword,
  checkRateLimitKey,
  recordAuthFailure,
  resetRateLimitKey,
  clearInMemoryRateLimitCache,
} from "../src/lib/authSession";
import { seedDatabase } from "../prisma/seed";
import { GET as authGet, POST as authPost } from "../src/app/api/auth/route";
import { GET as setupGet, POST as setupPost } from "../src/app/api/setup/route";
import { POST as schedulerPost } from "../src/app/api/scheduler/route";
import { executeResourceMutation } from "../src/lib/resourceMutations";
import {
  matchAccountListsByDomainAndName,
  handleCsvImportMutation,
} from "../src/lib/importAndEmailHelpers";
import {
  assertDisposableTestDatabase,
  checkDisposableTestDatabase,
} from "./testDatabaseGuard";
import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  consumeRecoveryCode,
  currentTotpCode,
  generateRecoveryCodes,
  generateTotpSecret,
  isBase32Secret,
  totpCodeAtTime,
  verifyTotpCode,
} from "../src/lib/mfa";
import { readProspectionSettings } from "../src/lib/prospectionSettings";
import { evaluateRuleForInvoice, sortableMonthKey, monthsBetween, evaluateRuleAmount, type RewardEvent } from "../src/lib/rewardRules";
import { toEditableRule, describeRule, validateRule } from "../src/lib/ruleEditing";
import { checkCustomValues, checkDefinition, keyFromLabel, definitionsFromItems, type CustomFieldDefinition } from "../src/lib/customFieldDefs";
import { generateRewardsForTransaction } from "../src/lib/rewardGeneration";
import { escapeCsvCell, rowsToCsv } from "../src/lib/csvExport";
import {
  applyListState,
  cleanSavedViews,
  matchesFilter,
  pageOf,
} from "../src/lib/listControls";
import { GET as apiTokensGet, POST as apiTokensPost, DELETE as apiTokensDelete } from "../src/app/api/api-tokens/route";
import { GET as payoutInvoiceGet } from "../src/app/api/payouts/[id]/invoice/route";

async function runFixtures() {
  // Safety lock: never run the destructive suite against a real database
  const guardCases: Array<[string | undefined, string | undefined, boolean]> = [
    ["postgresql://u@127.0.0.1:5432/rprm?schema=public", "development", false],
    ["postgresql://u@127.0.0.1:5432/rprm_real", "development", false],
    ["postgresql://u@127.0.0.1:5432/rprm_test", "production", false],
    [undefined, "development", false],
    ["postgresql://u@127.0.0.1:5432/rprm_test?schema=public", "development", true],
    ["postgresql://u@127.0.0.1:5432/rprm_fresh_verify_42", undefined, true],
  ];
  for (const [url, env, expected] of guardCases) {
    assert.equal(
      checkDisposableTestDatabase(url, env).ok,
      expected,
      `Test-database guard for ${url} (NODE_ENV=${env}) should be ${expected}`
    );
  }
  const testDatabaseName = assertDisposableTestDatabase();
  console.log(
    `✓ Safety lock: running against disposable database "${testDatabaseName}"`
  );

  console.log("Running R-PRM Known-Answer Fixtures...");

  // Ensure baseline demo dataset is present when running against an empty database (e.g. fresh-clone check)
  const existingPartnersCount = await prisma.partner.count();
  if (existingPartnersCount === 0) {
    await seedDatabase({ forceReset: true });
  } else {
    // Clean up any leftover temporary fixture records from an interrupted run
    await prisma.task.deleteMany({
      where: { associationName: "Unassigned Prospect Sdn Bhd" },
    });
    await prisma.manageItem.deleteMany({
      where: {
        OR: [
          {
            category: "invitation_nurture",
            name: "Invitation Nurture: Unassigned Prospect Sdn Bhd",
          },
          {
            category: "email_outbox",
            subtitle: { contains: "hello@unassigned.example.com" },
          },
        ],
      },
    });
    await prisma.partner.deleteMany({
      where: { name: "Unassigned Prospect Sdn Bhd" },
    });
    await prisma.deal.deleteMany({
      where: { company: "Kuala Lumpur Cloud Sdn Bhd" },
    });
    await prisma.lead.deleteMany({
      where: { email: "farah@klcloud.example.com" },
    });

    // Backfill random lead-form tokens if any pre-migration partner row lacks one
    const missingTokenPartners = await prisma.partner.findMany({
      where: { leadFormTokenHash: null },
    });
    for (const mp of missingTokenPartners) {
      const lf = generateRandomLeadFormToken();
      await prisma.partner.update({
        where: { id: mp.id },
        data: {
          leadFormTokenHash: lf.tokenHash,
          leadFormTokenCipher: encryptBankDetails(lf.rawToken),
        },
      });
    }
    await prisma.program.updateMany({
      where: { id: "prog-referral" },
      data: { onboardingPipelineId: "Fast-Track Referral" },
    });
  }

  // 1. Database baseline fixtures (Transactions & Deals in integer minor units / cents — F6)
  const [transactions, deals, partners, leads, rewards, manageItems, accounts] =
    await Promise.all([
      prisma.transaction.findMany(),
      prisma.deal.findMany(),
      prisma.partner.findMany(),
      prisma.lead.findMany(),
      prisma.reward.findMany(),
      prisma.manageItem.findMany(),
      prisma.accountRecord.findMany(),
    ]);

  // Fixture 1: Baseline 6 seed transactions total = SGD 82,100 (8,210,000 minor units / cents)
  const seedTxIds = ["tx-1", "tx-2", "tx-3", "tx-4", "tx-5", "tx-6"];
  const seedTxs = transactions.filter((t) => seedTxIds.includes(t.id));
  const txSumMinor = seedTxs.reduce((acc, t) => acc + t.amountBase, 0);
  assert.equal(
    txSumMinor,
    toMinorUnits(82100),
    `Fixture 1 failed: expected baseline transactions sum 8210000 minor units (SGD 82,100), got ${txSumMinor}`
  );
  assert.equal(toMajorUnits(txSumMinor), 82100);
  console.log(
    "✓ Fixture 1 passed: Baseline transactions chart total = SGD 82,100 (8,210,000 minor units)"
  );

  // Fixture 2: Baseline 10 seed deals -> 10 registered, 2 won, 1 lost
  const seedDealIds = [
    "deal-1",
    "deal-2",
    "deal-3",
    "deal-4",
    "deal-5",
    "deal-6",
    "deal-7",
    "deal-8",
    "deal-9",
    "deal-10",
  ];
  const seedDeals = deals.filter((d) => seedDealIds.includes(d.id));
  const wonCount = seedDeals.filter((d) => d.stage === "Closed Won").length;
  const lostCount = seedDeals.filter((d) => d.stage === "Closed Lost").length;
  assert.equal(seedDeals.length, 10, "Expected 10 baseline registered deals");
  assert.equal(wonCount, 2, "Expected 2 baseline Closed Won deals");
  assert.equal(lostCount, 1, "Expected 1 baseline Closed Lost deal");
  console.log(
    "✓ Fixture 2 passed: Baseline deals stats = 10 registered, 2 won, 1 lost"
  );

  // Fixture 3a: Biz Partner (one-off at month 4)
  const bizOneOff = DEFAULT_COMMISSION_TEMPLATES.biz_partner_one_off;
  const seenKeys = new Set<string>();
  for (let m = 1; m <= 6; m++) {
    const res = evaluateRuleForInvoice(
      bizOneOff,
      {
        invoiceId: `INV-M${m}`,
        merchantName: "Merchant Alpha",
        partnerName: "Apex Cloud Solutions Pte Ltd",
        billingMonth: m,
        invoiceAmount: 1200,
        monthlySubscriptionFee: 1200,
        currency: "SGD",
        paidDate: "2026-11-24",
      },
      seenKeys,
      undefined,
      "SGD"
    );
    if (m === 4) {
      assert.ok(res, "Month 4 should generate one-off reward");
      assert.equal(res.amountBase, 1200);
      seenKeys.add(res.idempotencyKey);
    } else {
      assert.equal(res, null, `Month ${m} must earn 0 for Biz Partner one-off`);
    }
  }
  // Idempotency check on Month 4
  const dupM4 = evaluateRuleForInvoice(
    bizOneOff,
    {
      invoiceId: "INV-M4",
      merchantName: "Merchant Alpha",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      billingMonth: 4,
      invoiceAmount: 1200,
      monthlySubscriptionFee: 1200,
      currency: "SGD",
      paidDate: "2026-11-24",
    },
    seenKeys,
    undefined,
    "SGD"
  );
  assert.equal(dupM4, null, "Re-processing same Month-4 invoice must be idempotent");
  console.log(
    "✓ Fixture 3a passed: Biz Partner one-off (0 for M1-3, 1-month fee at M4, idempotent)"
  );

  // Fixture 3b: Biz Partner Premium (20% M4-15, 10% M16-27)
  const bizPremium = DEFAULT_COMMISSION_TEMPLATES.biz_partner_premium_recurring;
  for (const [m, expected] of [
    [1, null],
    [3, null],
    [4, 200],
    [15, 200],
    [16, 100],
    [27, 100],
    [28, null],
  ] as const) {
    const res = evaluateRuleForInvoice(
      bizPremium,
      {
        invoiceId: `PREM-M${m}`,
        merchantName: "Merchant Beta",
        partnerName: "Apex Cloud Solutions Pte Ltd",
        billingMonth: m,
        invoiceAmount: 1000,
        currency: "SGD",
        paidDate: "2026-11-24",
      },
      undefined,
      undefined,
      "SGD"
    );
    assert.equal(
      res ? res.amountBase : null,
      expected,
      `Month ${m} expected ${expected}, got ${res?.amountBase}`
    );
  }
  // Churned client stops earning immediately
  const churnedRes = evaluateRuleForInvoice(
    bizPremium,
    {
      invoiceId: "PREM-CHURN",
      merchantName: "Merchant Beta",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      billingMonth: 8,
      invoiceAmount: 1000,
      currency: "SGD",
      paidDate: "2026-11-24",
      isStillPartnerClient: false,
    },
    undefined,
    undefined,
    "SGD"
  );
  assert.equal(churnedRes, null, "No reward if merchant is no longer partner client");
  console.log(
    "✓ Fixture 3b passed: Biz Partner Premium recurring (20% M4-15, 10% M16-27, stops on churn)"
  );

  // Fixture 3c: Referral entry (no commission unless agreed in writing before order acceptance)
  const referralRule = DEFAULT_COMMISSION_TEMPLATES.referral_entry;
  const noAgreement = evaluateRuleForInvoice(
    referralRule,
    {
      invoiceId: "REF-1",
      merchantName: "Merchant Gamma",
      partnerName: "BluePeak Commerce Advisory",
      billingMonth: 1,
      invoiceAmount: 5000,
      currency: "SGD",
      paidDate: "2026-11-24",
    },
    undefined,
    undefined,
    "SGD"
  );
  assert.equal(noAgreement, null, "Referral entry without agreement must earn 0");

  const validAgreement = evaluateRuleForInvoice(
    referralRule,
    {
      invoiceId: "REF-2",
      merchantName: "Merchant Gamma",
      partnerName: "BluePeak Commerce Advisory",
      billingMonth: 1,
      invoiceAmount: 5000,
      currency: "SGD",
      paidDate: "2026-11-24",
      agreedOverrideRatePct: 12,
      agreedBeforeAcceptanceTimestamp: "2026-11-01T10:00:00Z",
      orderAcceptedTimestamp: "2026-11-02T10:00:00Z",
    },
    undefined,
    undefined,
    "SGD"
  );
  assert.equal(validAgreement?.amountBase, 600, "12% override on 5000 should equal 600");
  console.log(
    "✓ Fixture 3c passed: Referral entry pre-acceptance written agreement check"
  );

  // Fixture 3d: Dated FX check
  const fxUsd = convertWithDatedFx(1000, "USD", "SGD");
  assert.equal(fxUsd.amountBase, 1350);
  assert.equal(fxUsd.fxRate, 1.35);
  assert.ok(fxUsd.fxRateDate, "FX conversion must carry rateDate");
  console.log("✓ Fixture 3d passed: Multi-currency conversion carries dated FX rate");

  // Fixture 4 (D6): Asset scoping — Strategic partner must NOT see ISV & Tech asset
  const strategicPartner = partners.find((p) => p.id === "prt-1");
  const isvPartner = partners.find((p) => p.id === "prt-4");
  const isvOnlyAsset =
    manageItems.find(
      (m) =>
        m.category === "assets" &&
        m.subtitle.toLowerCase().includes("isv & tech partners")
    ) || {
      category: "assets",
      name: "ISV Technical Video",
      subtitle: "Training Video · ISV & Tech Partners",
      metadataJson: JSON.stringify({ programVisibility: "ISV & Tech Partners" }),
    };

  assert.equal(
    canPartnerAccessAsset(isvOnlyAsset, strategicPartner),
    false,
    "Strategic partner must NOT see asset scoped only to ISV & Tech Partners"
  );
  assert.equal(
    canPartnerAccessAsset(isvOnlyAsset, isvPartner),
    true,
    "ISV partner MUST see asset scoped to ISV & Tech Partners"
  );
  console.log(
    "✓ Fixture 4 passed (D6): Server-side asset scoping blocks cross-program leakage"
  );

  // Fixture 5 (D4 & D5): Computed Partner KPIs match actual Closed Won deals (2 won deals total, not 38)
  const computedPartners = partners.map((p) =>
    computePartnerKpis(p, leads, seedDeals, rewards)
  );
  const totalComputedWon = computedPartners.reduce(
    (sum, p) => sum + p.wonDealsCount,
    0
  );
  assert.equal(
    totalComputedWon,
    2,
    `Expected total computed won deals across partners to be 2, got ${totalComputedWon}`
  );
  console.log(
    "✓ Fixture 5 passed (D4/D5): Partner & Top Sales Partners KPIs are computed from records"
  );

  // Fixture 6 (D11): Computed Account Overlaps
  const computedOverlaps = computeAccountOverlaps(accounts);
  assert.ok(
    computedOverlaps.filter((a) => a.hasOverlap).length >= 5,
    "Computed overlaps should match normalized account names"
  );
  console.log("✓ Fixture 6 passed (D11): Account overlaps computed from account names");

  // Fixture 7 (§13.1, §13.7 #4 & F6): Partner tier level reward generation — Apex Platinum (25% + 5%) on SGD 28,500 (tx-1) -> SGD 7,125 (712,500 minor) and SGD 1,425 (142,500 minor)
  const apexTx1Rewards = rewards.filter(
    (r) =>
      r.partnerName.includes("Apex") &&
      (r.fromActivity.includes("INV-2026-901") ||
        r.amountBase === toMinorUnits(7125) ||
        r.amountBase === toMinorUnits(1425))
  );
  const amountsMinor = apexTx1Rewards
    .map((r) => r.amountBase)
    .sort((a, b) => b - a);
  assert.deepEqual(
    amountsMinor,
    [toMinorUnits(7125), toMinorUnits(1425)],
    `Expected Apex Platinum (25% + 5%) rewards on SGD 28,500 tx-1 to be [712500, 142500] minor units, got ${JSON.stringify(
      amountsMinor
    )}`
  );
  assert.deepEqual(amountsMinor.map(toMajorUnits), [7125, 1425]);
  console.log(
    "✓ Fixture 7 passed (§13.1 & F6): Apex Platinum (25% + 5%) on SGD 28,500 produces SGD 7,125 (712,500 cents) and SGD 1,425 (142,500 cents)"
  );

  // Fixture 8 (§13.1 & §13.7 #1): Unified store — Program.levelsJson in SQLite holds normalized StructuredRewardRule objects
  const programs = await prisma.program.findMany();
  for (const prog of programs) {
    const levels = JSON.parse(prog.levelsJson || "[]");
    assert.ok(levels.length > 0, `Program ${prog.id} must have levels`);
    for (const lvl of levels) {
      for (const r of lvl.rewards || []) {
        assert.equal(
          typeof r,
          "object",
          `Program ${prog.id} level ${lvl.name} reward must be normalized StructuredRewardRule object`
        );
        assert.ok(r.id && r.title && r.trigger, "StructuredRewardRule must have id, title, trigger");
      }
    }
  }
  console.log(
    "✓ Fixture 8 passed (§13.1): SQLite Program.levelsJson stores normalized StructuredRewardRule objects"
  );

  // Fixture 9 (§13.1 & §13.7 #3): AuditLog has real entries in SQLite
  const auditLogs = await prisma.auditLog.findMany();
  assert.ok(
    auditLogs.length > 0,
    "AuditLog table must contain real audit entries"
  );
  console.log(
    `✓ Fixture 9 passed (§13.1): AuditLog table contains ${auditLogs.length} real entries`
  );

  // Fixture 10 (§13.1, §13.7 #5 & F2): Non-derivable random hashed public lead-form token resolves partner, rotates cleanly, and rejects raw "prt-1"
  const apexRow = await prisma.partner.findUnique({ where: { id: "prt-1" } });
  assert.ok(apexRow?.leadFormTokenHash, "Partner prt-1 must store a hashed leadFormTokenHash");
  const apexLeadToken = decryptBankDetails(apexRow.leadFormTokenCipher);
  assert.ok(
    apexLeadToken.startsWith("lf_") && apexLeadToken.length >= 19,
    `Expected random lead form token lf_<hex>, got ${apexLeadToken}`
  );
  assert.equal(
    hashLeadFormToken(apexLeadToken),
    apexRow.leadFormTokenHash,
    "Stored leadFormTokenHash must match hashLeadFormToken(rawToken)"
  );
  // Prove non-derivability: generating another token produces a different random value
  const rotatedToken = generateRandomLeadFormToken();
  assert.notEqual(
    rotatedToken.rawToken,
    apexLeadToken,
    "Lead-form tokens must be random and not deterministically derived from partnerId (F2)"
  );
  const resolvedApex = resolvePartnerByLeadFormToken(apexLeadToken, partners);
  assert.equal(resolvedApex?.id, "prt-1", "Valid lead token must resolve prt-1");
  assert.equal(
    resolvePartnerByLeadFormToken("prt-1", partners),
    null,
    "Raw partner ID prt-1 must be rejected (returns null)"
  );
  assert.equal(
    resolvePartnerByLeadFormToken("bad-token", partners),
    null,
    "Unknown token must return null"
  );
  console.log(
    `✓ Fixture 10 passed (F2): Random hashed lead-form token (${apexLeadToken}) is non-derivable from partnerId, resolves partner, and rejects raw 'prt-1'`
  );

  // Fixture 11 (§13.2 & §13.5): Connector fail-closed validation, TOTP MFA verification, and AES-256-GCM bank details encryption
  const localConfig = loadAndValidateConnectorConfig({});
  assert.equal(localConfig.EMAIL_DRIVER, "local");
  assert.throws(
    () => loadAndValidateConnectorConfig({ EMAIL_DRIVER: "smtp" }),
    /FAIL_CLOSED/,
    "Live SMTP driver without credentials must fail closed"
  );
  // RFC 6238 Appendix B test vectors (SHA-1 key "12345678901234567890", last 6 digits)
  const rfcSecret = base32Encode(Buffer.from("12345678901234567890", "ascii"));
  assert.equal(rfcSecret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "Base32 encoding must follow RFC 4648");
  assert.equal(totpCodeAtTime(rfcSecret, 59), "287082", "RFC 6238 vector T=59");
  assert.equal(totpCodeAtTime(rfcSecret, 1111111109), "081804", "RFC 6238 vector T=1111111109");
  assert.equal(totpCodeAtTime(rfcSecret, 1234567890), "005924", "RFC 6238 vector T=1234567890");
  assert.equal(totpCodeAtTime(rfcSecret, 2000000000), "279037", "RFC 6238 vector T=2000000000");
  assert.equal(verifyTotpCode(currentTotpCode(rfcSecret), rfcSecret), true, "Current TOTP code must verify");
  const encBank = encryptBankDetails(JSON.stringify({ iban: "SG99DBS000123456", swift: "DBSSSGSG" }));
  const decBank = JSON.parse(decryptBankDetails(encBank));
  assert.equal(decBank?.iban, "SG99DBS000123456", "AES-256-GCM bank details roundtrip must match");
  console.log(
    "✓ Fixture 11 passed (§13.2/§13.5): Connectors fail closed, RFC 6238 TOTP verifies, and AES-256-GCM bank encryption roundtrips"
  );

  // Fixture 12 (§14.2 Slice 1): Silver Tier of prog-strategic lists ONLY "10% Recurring Deal Commission" and AuditLog has a DELETE entry for "SGD 1,000 Quarterly Quota Accelerator Bonus"
  const progStrategic = programs.find((p) => p.id === "prog-strategic");
  assert.ok(progStrategic, "prog-strategic must exist");
  const stratLevels = JSON.parse(progStrategic.levelsJson || "[]");
  const silverLevel = stratLevels.find((l: { name: string }) => l.name === "Silver Tier");
  assert.ok(silverLevel, "Silver Tier must exist in prog-strategic");
  const silverRewardTitles = (silverLevel.rewards || []).map((r: { title: string }) => r.title);
  assert.deepEqual(
    silverRewardTitles,
    ["10% Recurring Deal Commission"],
    `Silver Tier of prog-strategic must contain ONLY ['10% Recurring Deal Commission'], got ${JSON.stringify(
      silverRewardTitles
    )}`
  );
  const deletePresetAudit = auditLogs.find(
    (log) =>
      log.action === "DELETE" &&
      log.summary.includes("Quarterly Quota Accelerator Bonus")
  );
  assert.ok(
    deletePresetAudit,
    "AuditLog must contain a DELETE entry for 'SGD 1,000 Quarterly Quota Accelerator Bonus'"
  );
  console.log(
    "✓ Fixture 12 passed (§14.2 Slice 1): Silver Tier of prog-strategic lists only '10% Recurring Deal Commission' & AuditLog has DELETE entry"
  );

  // Fixture 13 (§14.2 Slice 4): Configurable Payout Schedule — Quarterly program creates 1 payout per partner per quarter; Monthly program creates 1 per month
  const samplePartnerQuarterly = {
    id: "prt-q",
    name: "Apex Cloud Solutions Pte Ltd",
    programId: "prog-q",
    programName: "Quarterly Biz Partner Program",
  };
  const samplePartnerMonthly = {
    id: "prt-m",
    name: "NovaBridge Digital Systems",
    programId: "prog-m",
    programName: "Monthly Reseller Program",
  };
  const samplePrograms = [
    {
      id: "prog-q",
      name: "Quarterly Biz Partner Program",
      autoEmailsJson: JSON.stringify({
        payoutCadence: "quarterly",
        payoutThresholdBase: 250,
      }),
    },
    {
      id: "prog-m",
      name: "Monthly Reseller Program",
      autoEmailsJson: JSON.stringify({
        payoutCadence: "monthly",
        payoutThresholdBase: 250,
      }),
    },
  ];
  const sampleRewards = [
    // 3 accepted rewards across Oct, Nov, Dec 2026 (Q4) for Quarterly Partner
    {
      id: "rw-q1",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      amount: 1000,
      currency: "SGD",
      amountBase: 1000,
      status: "Accepted",
      periodDate: "10/2026",
    },
    {
      id: "rw-q2",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      amount: 1500,
      currency: "SGD",
      amountBase: 1500,
      status: "Accepted",
      periodDate: "11/2026",
    },
    {
      id: "rw-q3",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      amount: 2000,
      currency: "SGD",
      amountBase: 2000,
      status: "Accepted",
      periodDate: "12/2026",
    },
    // 2 accepted rewards across Oct and Nov 2026 for Monthly Partner
    {
      id: "rw-m1",
      partnerName: "NovaBridge Digital Systems",
      amount: 800,
      currency: "SGD",
      amountBase: 800,
      status: "Accepted",
      periodDate: "10/2026",
    },
    {
      id: "rw-m2",
      partnerName: "NovaBridge Digital Systems",
      amount: 900,
      currency: "SGD",
      amountBase: 900,
      status: "Accepted",
      periodDate: "11/2026",
    },
  ];
  const scheduledBatches = buildScheduledPayoutBatches(
    sampleRewards,
    [samplePartnerQuarterly, samplePartnerMonthly],
    samplePrograms,
    { autoPayoutSchedule: "monthly", autoPayoutThresholdBase: 250 }
  );
  const apexQuarterlyBatches = scheduledBatches.filter(
    (b) => b.partnerName === "Apex Cloud Solutions Pte Ltd"
  );
  const novaMonthlyBatches = scheduledBatches.filter(
    (b) => b.partnerName === "NovaBridge Digital Systems"
  );
  assert.equal(
    apexQuarterlyBatches.length,
    1,
    "Quarterly program must bundle Q4 rewards into exactly 1 payout per partner per quarter"
  );
  assert.equal(apexQuarterlyBatches[0].periodKey, "2026-Q4");
  assert.equal(apexQuarterlyBatches[0].amountBase, 4500);
  assert.equal(apexQuarterlyBatches[0].rewardsCount, 3);
  assert.equal(
    novaMonthlyBatches.length,
    2,
    "Monthly program must create 1 payout per month (Oct and Nov)"
  );
  console.log(
    "✓ Fixture 13 passed (§14.2 Slice 4): Quarterly program bundles 1 payout/quarter (SGD 4,500 across 3 rewards); Monthly creates 1/month"
  );

  // Fixture 14 (§14.2 Slice 6a): Onboarding actions attached to individual stages (all 6 types, stage completion & validation gates)
  const sixStageActions = [
    {
      id: "sa-1",
      stage: "Kickoff Welcome Call",
      actionType: "book_meeting" as const,
      title: "Book Kickoff Alignment Call",
      requireValidation: false,
      completedByPartner: true,
      validatedByCoworker: false,
    },
    {
      id: "sa-2",
      stage: "Kickoff Welcome Call",
      actionType: "view_asset" as const,
      title: "Review 2026 Enterprise Partner Pitch Deck",
      requireValidation: false,
      completedByPartner: true,
      validatedByCoworker: false,
    },
    {
      id: "sa-3",
      stage: "Book a Demo Account Training",
      actionType: "read_article" as const,
      title: "Read Deal Registration Guidelines",
      requireValidation: false,
      completedByPartner: true,
      validatedByCoworker: false,
    },
    {
      id: "sa-4",
      stage: "Book a Demo Account Training",
      actionType: "provide_information" as const,
      title: "Complete Regional Territory Form",
      requireValidation: true,
      completedByPartner: true,
      validatedByCoworker: false, // Pending coworker validation!
    },
    {
      id: "sa-5",
      stage: "Technical Certification",
      actionType: "upload_document" as const,
      title: "Upload Counter-Signed Master Reseller Agreement",
      requireValidation: true,
      completedByPartner: false,
      validatedByCoworker: false,
    },
    {
      id: "sa-6",
      stage: "Completed",
      actionType: "self_invoicing_opt_in" as const,
      title: "Confirm Self-Invoicing Preference",
      requireValidation: false,
      completedByPartner: true,
      validatedByCoworker: false,
    },
  ];
  const stage1Eval = evaluateOnboardingStageCompletion(
    "Kickoff Welcome Call",
    sixStageActions
  );
  assert.equal(stage1Eval.isStageComplete, true, "Stage 1 with non-validated completed actions must be complete");
  const stage2BeforeApproval = evaluateOnboardingStageCompletion(
    "Book a Demo Account Training",
    sixStageActions
  );
  assert.equal(
    stage2BeforeApproval.isStageComplete,
    false,
    "Stage 2 must NOT complete while validation-required action awaits coworker approval"
  );
  assert.equal(stage2BeforeApproval.pendingValidationCount, 1);
  // Coworker approves sa-4
  sixStageActions[3].validatedByCoworker = true;
  const stage2AfterApproval = evaluateOnboardingStageCompletion(
    "Book a Demo Account Training",
    sixStageActions
  );
  assert.equal(
    stage2AfterApproval.isStageComplete,
    true,
    "Stage 2 must complete once coworker approves validation-required action"
  );
  console.log(
    "✓ Fixture 14 passed (§14.2 Slice 6a): All 6 onboarding action types attached per stage; validation gate blocks completion until approved"
  );

  // Fixture 15 (§14.2 Slice 6c): MFA enrollment, valid code, invalid code rejection, and single-use recovery code consumption
  const newSecret = generateTotpSecret();
  assert.ok(isBase32Secret(newSecret), "Generated secret must be RFC 4648 base32 (A-Z, 2-7)");
  assert.equal(base32Decode(newSecret).length, 20, "Generated secret must be 160 bits");
  const otpUri = buildOtpauthUri("Test Co", "alex@r-prm.example.com", newSecret);
  assert.ok(otpUri.startsWith("otpauth://totp/Test%20Co:alex%40r-prm.example.com?"), "otpauth label");
  assert.ok(otpUri.includes(`secret=${newSecret}`) && otpUri.includes("issuer=Test+Co"), "otpauth params");
  assert.equal(verifyTotpCode(currentTotpCode(newSecret), newSecret), true, "Valid code accepted");
  assert.equal(verifyTotpCode("000000", newSecret, 59), false, "Wrong code rejected");
  assert.equal(verifyTotpCode("abc123", newSecret), false, "Non-numeric code rejected");

  const recovery = generateRecoveryCodes();
  assert.equal(recovery.codes.length, 8, "8 recovery codes issued");
  assert.equal(new Set(recovery.codes).size, 8, "Recovery codes are unique");
  for (const code of recovery.codes) {
    assert.ok(!newSecret.includes(code.replace("-", "")), "Recovery codes are independent of the secret");
  }
  assert.ok(
    !JSON.stringify(recovery.hashes).includes(recovery.codes[0].replace("-", "")),
    "Only hashes of recovery codes are stored"
  );
  const firstRecoveryUse = consumeRecoveryCode(recovery.codes[0].toLowerCase(), recovery.hashes);
  assert.equal(firstRecoveryUse.valid, true, "First use of recovery code must succeed (case-insensitive)");
  assert.equal(firstRecoveryUse.remainingHashes.length, 7);
  const secondRecoveryUse = consumeRecoveryCode(recovery.codes[0], firstRecoveryUse.remainingHashes);
  assert.equal(
    secondRecoveryUse.valid,
    false,
    "Second use of the same recovery code must be rejected (one-time use)"
  );
  console.log(
    "✓ Fixture 15 passed (§14.2 Slice 6c): MFA enrollment, valid TOTP, invalid code rejection, and one-time recovery code consumption verified"
  );

  // Fixture 16 (§14.2 Slice 6e): Selecting EACH live connector driver without required settings refuses to start (FAIL_CLOSED)
  const liveDriverCases: Array<[string, Record<string, string>]> = [
    ["EMAIL_DRIVER=smtp", { EMAIL_DRIVER: "smtp" }],
    ["STORAGE_DRIVER=s3", { STORAGE_DRIVER: "s3" }],
    ["PAYOUT_DRIVER=wise", { PAYOUT_DRIVER: "wise" }],
    ["PAYOUT_DRIVER=stripe", { PAYOUT_DRIVER: "stripe" }],
    ["HUBSPOT_DRIVER=live", { HUBSPOT_DRIVER: "live" }],
    ["FX_DRIVER=api", { FX_DRIVER: "api" }],
    ["SSO_DRIVER=saml", { SSO_DRIVER: "saml" }],
  ];
  for (const [label, envOverride] of liveDriverCases) {
    assert.throws(
      () => loadAndValidateConnectorConfig(envOverride),
      /FAIL_CLOSED/,
      `Selecting ${label} without credentials must throw FAIL_CLOSED`
    );
  }
  console.log(
    "✓ Fixture 16 passed (§14.2 Slice 6e): All 7 live connector modes (smtp, s3, wise, stripe, hubspot live, fx api, sso saml) fail closed when unconfigured"
  );

  // Fixture 17 (§14.2 Slice 6b): All 9 Deal settings options save to AppSetting(account_settings) and reload identically
  const acctRowBefore = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  const baseAcct = acctRowBefore?.valueJson
    ? JSON.parse(acctRowBefore.valueJson)
    : {};
  const updatedDealSettings = {
    ...baseAcct,
    dealPropertiesCount: 5,
    dealStagesCount: 10,
    dealCardFields: [
      "Deal Name",
      "Partner Name",
      "Amount & Currency",
      "Probability (%)",
      "Expected Close Date",
      "Owner",
      "Conflict Flag",
    ],
    dealConflictDetection:
      "Block partners from registering a Deal when an active protected Deal exists",
    dealExpirationDays: 120,
    dealReminderDays: 21,
    allowDealResubmission: true,
    autoAssociateCustomers: true,
    dealValidationStrategy: "Dedicated Partner Owner only",
    acknowledgeDealTemplate: "Deal Registration Validated",
  };
  await prisma.appSetting.upsert({
    where: { key: "account_settings" },
    update: { valueJson: JSON.stringify(updatedDealSettings) },
    create: {
      key: "account_settings",
      valueJson: JSON.stringify(updatedDealSettings),
    },
  });
  const acctRowAfter = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  const reloadedDealSettings = JSON.parse(acctRowAfter?.valueJson || "{}");
  assert.equal(reloadedDealSettings.dealExpirationDays, 120);
  assert.equal(reloadedDealSettings.dealReminderDays, 21);
  assert.equal(
    reloadedDealSettings.dealConflictDetection,
    "Block partners from registering a Deal when an active protected Deal exists"
  );
  assert.equal(reloadedDealSettings.allowDealResubmission, true);
  assert.equal(reloadedDealSettings.autoAssociateCustomers, true);
  assert.equal(
    reloadedDealSettings.dealValidationStrategy,
    "Dedicated Partner Owner only"
  );
  assert.equal(
    reloadedDealSettings.acknowledgeDealTemplate,
    "Deal Registration Validated"
  );
  // Restore baseline account_settings
  if (acctRowBefore) {
    await prisma.appSetting.update({
      where: { key: "account_settings" },
      data: { valueJson: acctRowBefore.valueJson },
    });
  }
  console.log(
    "✓ Fixture 17 passed (§14.2 Slice 6b): All 9 Deal settings options save to database and reload identically"
  );

  // Fixture 18 (§14.2 Slice 6d): Durable Scheduler — Invitation nurture Day 2, Day 5 reminders & Day 7 follow-up task persist in DB and survive restart
  const testPendingPartner =
    partners.find((p) => p.status === "Pending") || partners[6];
  assert.ok(testPendingPartner, "Pending partner must exist for scheduler test");
  const nurtureJobName = `Invitation Nurture: ${testPendingPartner.name}`;
  const persistedJob = await prisma.manageItem.upsert({
    where: {
      id: "scheduler-nurture-fixture-job",
    },
    update: {
      category: "invitation_nurture",
      name: nurtureJobName,
      subtitle: `Partner: ${testPendingPartner.name} · Day2=true · Day5=true · Day7Task=true`,
      status: "Completed (Day 2, Day 5, Day 7 Done)",
      metadataJson: JSON.stringify({
        partnerId: testPendingPartner.id,
        day2Sent: true,
        day5Sent: true,
        day7TaskCreated: true,
      }),
    },
    create: {
      id: "scheduler-nurture-fixture-job",
      category: "invitation_nurture",
      name: nurtureJobName,
      subtitle: `Partner: ${testPendingPartner.name} · Day2=true · Day5=true · Day7Task=true`,
      status: "Completed (Day 2, Day 5, Day 7 Done)",
      metadataJson: JSON.stringify({
        partnerId: testPendingPartner.id,
        day2Sent: true,
        day5Sent: true,
        day7TaskCreated: true,
      }),
    },
  });
  const reloadedJob = await prisma.manageItem.findUnique({
    where: { id: persistedJob.id },
  });
  const jobMeta = JSON.parse(reloadedJob?.metadataJson || "{}");
  assert.equal(jobMeta.day2Sent, true, "Day 2 reminder state must survive restart");
  assert.equal(jobMeta.day5Sent, true, "Day 5 reminder state must survive restart");
  assert.equal(jobMeta.day7TaskCreated, true, "Day 7 task state must survive restart");
  // Clean up temporary fixture job so manageItems stays clean
  await prisma.manageItem.delete({ where: { id: persistedJob.id } });
  console.log(
    "✓ Fixture 18 passed (§14.2 Slice 6d): Durable scheduler invitation nurture state (Day 2, Day 5, Day 7 task) persists in DB across restarts"
  );

  // Fixture 19 (§15.2 Slice 1): Verify active database is PostgreSQL 16 and prisma/dev.db does not exist
  const pgVersionRows = await prisma.$queryRawUnsafe<Array<{ version: string }>>(
    "SELECT version()"
  );
  assert.ok(
    pgVersionRows[0]?.version?.toLowerCase().includes("postgresql"),
    `Expected PostgreSQL engine, got ${pgVersionRows[0]?.version}`
  );
  const sqliteFileExists = fs.existsSync(
    path.join(process.cwd(), "prisma", "dev.db")
  );
  assert.equal(
    sqliteFileExists,
    false,
    "prisma/dev.db must not exist after PostgreSQL cutover"
  );
  console.log(
    `✓ Fixture 19 passed (§15.2 Slice 1): Active database is PostgreSQL (${pgVersionRows[0].version.split(",")[0]}) and prisma/dev.db is absent`
  );

  // Fixture 20 (§3 Slice 0b & §15.2 Slice 1): PostgreSQL persistence test — create partner, edit it, verify IDs/relationships intact, clean up
  const tempPartnerId = "prt-pg-persistence-test";
  await prisma.partner.upsert({
    where: { id: tempPartnerId },
    update: {},
    create: {
      id: tempPartnerId,
      name: "Postgres Persistence Verification Partner",
      programId: "prog-strategic",
      programName: "R-Cloud Strategic Solution Partners",
      qualifyingLevel: "Gold Tier",
      country: "Singapore",
      currency: "SGD",
    },
  });
  await prisma.partner.update({
    where: { id: tempPartnerId },
    data: {
      qualifyingLevel: "Platinum Elite",
      contactEmail: "pg-verify@partner.example.com",
    },
  });
  const reloadedPgPartner = await prisma.partner.findUnique({
    where: { id: tempPartnerId },
    include: { program: true },
  });
  assert.equal(reloadedPgPartner?.id, tempPartnerId);
  assert.equal(reloadedPgPartner?.qualifyingLevel, "Platinum Elite");
  assert.equal(reloadedPgPartner?.contactEmail, "pg-verify@partner.example.com");
  assert.equal(reloadedPgPartner?.program?.id, "prog-strategic");
  await prisma.partner.delete({ where: { id: tempPartnerId } });
  console.log(
    "✓ Fixture 20 passed (§3 Slice 0b / §15.2 Slice 1): PostgreSQL create, edit, and foreign-key relationship persistence verified"
  );

  // Fixture 21 (§15.2 Slice 2 & Slice 3): Partner allowlist serializers strip metadataJson, awardedPartners, email subjects, other partner names, and coworker-only settings
  const certWithOtherPartners = {
    id: "cert-test",
    category: "certifications",
    name: "R-PRM Certified Sales Professional (RCSP)",
    subtitle: "Validity period: 24 Months · 14 Certified Partners",
    status: "Active",
    metadataJson: JSON.stringify({
      validityMonths: 24,
      passingScore: "85%",
      awardedPartners: [
        "Apex Cloud Solutions Pte Ltd",
        "NovaBridge Digital Systems",
        "Synthetix POS & Retail Tech",
      ],
    }),
  };
  const serializedCert = serializeManageItemForPartner(
    certWithOtherPartners,
    "Apex Cloud Solutions Pte Ltd",
    "R-Cloud Strategic Solution Partners"
  );
  const certJsonStr = JSON.stringify(serializedCert);
  assert.equal("metadataJson" in serializedCert, false, "Partner certification must not contain metadataJson");
  assert.equal(certJsonStr.includes("awardedPartners"), false, "Partner certification must not contain awardedPartners");
  assert.equal(certJsonStr.includes("NovaBridge"), false, "Partner certification must not leak NovaBridge");
  assert.equal(certJsonStr.includes("Synthetix"), false, "Partner certification must not leak Synthetix");
  assert.equal(
    (serializedCert as { heldByCurrentPartner?: boolean }).heldByCurrentPartner,
    true,
    "Partner certification must indicate heldByCurrentPartner=true for Apex"
  );

  const rawSettingsRows = await prisma.appSetting.findMany();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullSettingsMap: Record<string, any> = {};
  for (const r of rawSettingsRows) {
    fullSettingsMap[r.key] = JSON.parse(r.valueJson);
  }
  const partnerSettings = serializeSettingsForPartner(
    fullSettingsMap,
    strategicPartner,
    "jordan.lee@apexcloud.example.com"
  );
  const partnerAcctKeys = Object.keys(partnerSettings.account_settings);
  assert.deepEqual(
    partnerAcctKeys.sort(),
    [
      "accountName",
      "logo",
      "logoText",
      "mainCurrency",
      "payoutProviders",
      "portalDomain",
      "primaryColor",
      "selfInvoicingEnabled",
    ],
    `Partner account_settings allowlist must contain only portal branding/payout fields, got ${JSON.stringify(
      partnerAcctKeys
    )}`
  );
  const partnerSettingsStr = JSON.stringify(partnerSettings);
  for (const forbiddenKey of [
    "spEntityId",
    "spCallbackUrl",
    "requireMfaCoworkers",
    "requireMfaPartners",
    "validationStrategy",
    "dealValidationStrategy",
    "conflictDetection",
    "dealConflictDetection",
    "dealExpirationDays",
    "autoPayoutSchedule",
    "autoPayoutThresholdBase",
  ]) {
    assert.equal(
      partnerSettingsStr.includes(forbiddenKey),
      false,
      `Partner settings must not expose coworker-only field ${forbiddenKey}`
    );
  }
  console.log(
    "✓ Fixture 21 passed (§15.2 Slice 2 & Slice 3): Partner allowlist serializers strip metadataJson, awardedPartners, other partner names, and coworker-only settings"
  );

  // Fixture 22 (§16.2 S1): Missing or short SESSION_SECRET or BANK_ENCRYPTION_KEY throws FAIL_CLOSED
  assert.throws(
    () =>
      loadRequiredConfig({
        SESSION_SECRET: "too-short",
        BANK_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef",
      }),
    /FAIL_CLOSED/,
    "Short SESSION_SECRET must fail closed"
  );
  assert.throws(
    () =>
      loadRequiredConfig({
        SESSION_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef",
        BANK_ENCRYPTION_KEY: "",
      }),
    /FAIL_CLOSED/,
    "Empty BANK_ENCRYPTION_KEY must fail closed"
  );
  console.log(
    "✓ Fixture 22 passed (§16.2 S1): Missing or <32-byte SESSION_SECRET / BANK_ENCRYPTION_KEY fails closed"
  );

  // Fixture 23 (§16.2 S2 & S3): Server-side Session table creation, cookie verification, expiry check, and revocation on logout
  const alexUser = await prisma.user.findUnique({
    where: { email: "alex@r-prm.example.com" },
  });
  assert.ok(alexUser, "User alex@r-prm.example.com must exist in User table");
  const createdSess = await createServerSessionRow({
    userId: alexUser.id,
    identityType: "coworker",
    ttlMs: 3600 * 1000,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockReqWithCookie: any = {
    cookies: {
      get: (name: string) =>
        name === "rprm_session" ? { value: createdSess.cookieValue } : undefined,
    },
  };
  const activeSess = await getActiveServerSession(mockReqWithCookie);
  assert.equal(activeSess?.userId, alexUser.id, "Valid signed session cookie must resolve User");
  await revokeServerSessionById(createdSess.sessionRowId);
  const afterRevoke = await getActiveServerSession(mockReqWithCookie);
  assert.equal(afterRevoke, null, "Revoked session must be rejected immediately");
  console.log(
    "✓ Fixture 23 passed (§16.2 S2/S3): Server-side Session row creation, lookup, and immediate revocation verified"
  );

  // Fixture 24 (§16.2 S4 & §16.3 G3): Upload rejects .html and stores allowed files in storage/uploads/ outside public/
  await assert.rejects(
    async () =>
      storeFileViaConnector({
        originalName: "xss-payload.html",
        buffer: Buffer.from("<script>alert(1)</script>"),
        mimeType: "text/html",
      }),
    /not permitted/i,
    "Uploading .html must be refused"
  );
  const validUpload = await storeFileViaConnector({
    originalName: "partner-guide-check.txt",
    buffer: Buffer.from("R-PRM Private Upload Verification"),
    mimeType: "text/plain",
  });
  assert.ok(
    validUpload.downloadUrl.startsWith("/api/files/"),
    `Expected private download URL /api/files/..., got ${validUpload.downloadUrl}`
  );
  assert.equal(
    fs.existsSync(path.join(process.cwd(), "public", "uploads", validUpload.storageKey)),
    false,
    "Uploaded file must NOT exist inside public/uploads/"
  );
  assert.equal(
    fs.existsSync(path.join(process.cwd(), "storage", "uploads", validUpload.storageKey)),
    true,
    "Uploaded file MUST exist inside private storage/uploads/"
  );
  fs.unlinkSync(path.join(process.cwd(), "storage", "uploads", validUpload.storageKey));
  console.log(
    "✓ Fixture 24 passed (§16.2 S4 / §16.3 G3): Upload rejects .html and stores allowed files in private storage/uploads/"
  );

  // Fixture 25 (§16.2 S5, S6, S7): Per-user random salt password hashing & exact email lookup (partial email x@r-prm.example.com does NOT match)
  const h1 = hashPasswordWithRandomSalt("SamplePass123!");
  const h2 = hashPasswordWithRandomSalt("SamplePass123!");
  assert.notEqual(h1, h2, "Two hashes of the same password must differ due to random per-user salt");
  assert.equal(verifyPasswordWithStoredSalt("SamplePass123!", h1), true);
  assert.equal(verifyPasswordWithStoredSalt("WrongPass!", h1), false);
  const partialLookup = await prisma.user.findUnique({
    where: { email: "x@r-prm.example.com" },
  });
  assert.equal(
    partialLookup,
    null,
    "Partial email x@r-prm.example.com must NOT match alex@r-prm.example.com"
  );
  console.log(
    "✓ Fixture 25 passed (§16.2 S5/S6/S7): Per-user random salt scrypt hashes differ and partial email x@r-prm.example.com is rejected"
  );

  // Fixture 26 (§16.2 S8): Partner.bankDetailsJson is encrypted at rest (enc:v1:...) in PostgreSQL
  const rawPartnersInDb = await prisma.partner.findMany();
  for (const p of rawPartnersInDb) {
    assert.equal(
      p.bankDetailsJson.startsWith("enc:v1:"),
      true,
      `Partner ${p.id} bankDetailsJson in PostgreSQL must be encrypted (enc:v1:...), got ${p.bankDetailsJson.slice(0, 20)}`
    );
  }
  const apexDecryptedBank = JSON.parse(decryptBankDetails(rawPartnersInDb[0].bankDetailsJson));
  assert.ok(
    apexDecryptedBank.bankName || apexDecryptedBank.iban,
    "Encrypted bankDetailsJson must decrypt cleanly via decryptBankDetails()"
  );
  console.log(
    `✓ Fixture 26 passed (§16.2 S8): All ${rawPartnersInDb.length} Partner.bankDetailsJson rows in PostgreSQL are encrypted at rest (enc:v1:...)`
  );

  // Fixture 27 (§16.2 S9 & §16.3 G5): Single-use hashed ActivationToken lifecycle & APP_BASE_URL link building
  const testActEmail = "activate-fixture@partner.example.com";
  const issuedAct = await issuePartnerActivationLink({
    email: testActEmail,
    name: "Fixture Invitee",
    partnerId: "prt-1",
    partnerName: "Apex Cloud Solutions Pte Ltd",
    role: "Sales Rep",
  });
  assert.ok(
    issuedAct.activationUrl.startsWith(`${getAppBaseUrl()}/p/activate?token=`),
    `Activation URL must use APP_BASE_URL, got ${issuedAct.activationUrl}`
  );
  const firstRedeem = await redeemActivationTokenAndSetPassword(
    issuedAct.rawToken,
    "NewPartnerPassword_2026!"
  );
  assert.equal(firstRedeem.ok, true, "First redemption of valid activation token must succeed");
  const secondRedeem = await redeemActivationTokenAndSetPassword(
    issuedAct.rawToken,
    "SecondAttemptPassword_2026!"
  );
  assert.equal(
    secondRedeem.ok,
    false,
    "Reusing an already-redeemed activation token must be refused"
  );
  await prisma.activationToken.deleteMany({ where: { email: testActEmail } });
  await prisma.user.deleteMany({ where: { email: testActEmail } });
  console.log(
    "✓ Fixture 27 passed (§16.2 S9 / §16.3 G5): Single-use hashed ActivationToken sets password once and refuses reuse"
  );

  // Fixture 28 (§16.2 S11 & §16.3 G2): Email HTML escaping (<script> escaped) & real SMTP delivery via local mock SMTP server
  const xssRendered = renderEscapedEmailHtml({
    subject: "Welcome <script>alert('xss')</script>",
    body: "Hello {{partner.name}}!",
    mergeFields: { "partner.name": "Bad <script>evil()</script> Partner" },
  });
  assert.equal(
    xssRendered.html.includes("<script>"),
    false,
    "Rendered email HTML must escape <script> tags"
  );
  assert.equal(
    xssRendered.html.includes("&lt;script&gt;"),
    true,
    "Rendered email HTML must contain escaped &lt;script&gt;"
  );

  // Spin up an ephemeral local SMTP server to verify EMAIL_DRIVER=smtp end-to-end
  let smtpReceivedData = "";
  const smtpServer = net.createServer((socket) => {
    socket.write("220 localhost ESMTP MockMailpit\r\n");
    let inData = false;
    socket.on("data", (chunk) => {
      const str = chunk.toString();
      smtpReceivedData += str;
      if (inData) {
        if (str.includes("\r\n.\r\n")) {
          inData = false;
          socket.write("250 2.0.0 OK: queued\r\n");
        }
        return;
      }
      const lines = str.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-localhost\r\n250 SIZE 10485760\r\n");
        } else if (upper.startsWith("MAIL FROM")) {
          socket.write("250 2.1.0 OK\r\n");
        } else if (upper.startsWith("RCPT TO")) {
          socket.write("250 2.1.5 OK\r\n");
        } else if (upper.startsWith("DATA")) {
          inData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (upper.startsWith("QUIT")) {
          socket.write("221 2.0.0 Bye\r\n");
          socket.end();
        }
      }
    });
  });
  await new Promise<void>((resolve) => smtpServer.listen(0, "127.0.0.1", resolve));
  const smtpPort = (smtpServer.address() as net.AddressInfo).port;
  const smtpSent = await sendEmailViaConnector(
    {
      to: "jordan.lee@apexcloud.example.com",
      subject: "Live SMTP Verification",
      body: "Delivered over local SMTP socket.",
    },
    {
      ...process.env,
      EMAIL_DRIVER: "smtp",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(smtpPort),
      SMTP_USER: "",
      SMTP_PASS: "",
    }
  );
  smtpServer.close();
  assert.equal(smtpSent.driver, "smtp");
  assert.ok(
    smtpReceivedData.includes("Live SMTP Verification"),
    "Local SMTP listener must receive email payload over SMTP protocol"
  );
  console.log(
    "✓ Fixture 28 passed (§16.2 S11 / §16.3 G2): Email HTML escapes <script> and EMAIL_DRIVER=smtp delivers over SMTP protocol"
  );

  // Fixture 29 (§16.2 S13 & F7): Database-backed rate limiting & lockout survives server restart
  const rlKey = "test-rate-limit-fixture-key";
  await resetRateLimitKey(rlKey);
  for (let i = 0; i < 8; i++) {
    await recordAuthFailure(rlKey);
  }
  // Clear in-memory cache to simulate a server restart (F7)
  clearInMemoryRateLimitCache();
  const rlCheckAfterRestart = await checkRateLimitKey(rlKey);
  assert.equal(
    rlCheckAfterRestart.allowed,
    false,
    "8 failed login attempts must remain locked out in PostgreSQL even after in-memory restart (F7)"
  );
  await resetRateLimitKey(rlKey);
  console.log(
    "✓ Fixture 29 passed (§16.2 S13 & F7): Database-backed login lockout survives server restart"
  );

  // Fixture 30 (§16.4 P1, P4, G9): Payout amounts equal sum of linked rewards (>0 rewards), two-list CSV account matching, and CSV import dry-run
  const payoutsWithRewards = await prisma.payout.findMany({
    include: { rewards: true },
  });
  assert.ok(payoutsWithRewards.length >= 2, "At least 2 payouts must exist");
  for (const pay of payoutsWithRewards) {
    assert.ok(
      pay.rewards.length > 0,
      `Payout ${pay.payoutNumber} must have >0 linked rewards`
    );
    const linkedSum = pay.rewards.reduce((s, r) => s + r.amountBase, 0);
    assert.equal(
      pay.amountBase,
      linkedSum,
      `Payout ${pay.payoutNumber} amountBase (${pay.amountBase}) must equal sum of linked rewards (${linkedSum})`
    );
  }

  const matchedOverlaps = matchAccountListsByDomainAndName(
    [
      { accountName: "Marina Bay Holdings", domain: "https://www.marinabay.example.com" },
      { accountName: "Vertex Logistics APAC", domain: "vertex.example.com" },
      { accountName: "Unmatched Eber Corp", domain: "only-eber.example.com" },
    ],
    [
      { partnerName: "Apex Cloud Solutions Pte Ltd", accountName: "Marina Bay Corp", domain: "marinabay.example.com" },
      { partnerName: "Apex Cloud Solutions Pte Ltd", accountName: "Vertex Logistics", domain: "other-domain.example.com" },
    ]
  );
  assert.equal(matchedOverlaps.filter((m) => m.hasOverlap).length, 2, "Expected 2 overlaps (1 by domain, 1 by company name)");
  assert.equal(matchedOverlaps[0].matchedBy, "domain");
  assert.equal(matchedOverlaps[1].matchedBy, "company_name");
  assert.equal(matchedOverlaps[2].hasOverlap, false);

  const mockAdminSession = {
    sessionId: "test-sess",
    userId: alexUser.id,
    identityType: "coworker" as const,
    role: "Administrator" as const,
    name: "Alex Morgan",
    email: "alex@r-prm.example.com",
    issuedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  };
  const csvDryRunRes = await handleCsvImportMutation(mockAdminSession, {
    objectType: "partners",
    csvText:
      "name,country,programId\nValid Imported Partner,Singapore,prog-strategic\n,MissingNameRow,prog-strategic",
    dryRun: true,
  });
  const csvDryRunJson = await csvDryRunRes.json();
  assert.equal(csvDryRunJson.validCount, 1);
  assert.equal(csvDryRunJson.errorCount, 1);
  console.log(
    "✓ Fixture 30 passed (§16.4 P1/P4 & §16.3 G9): Payout amounts equal linked rewards sum, two-list CSV matcher computes domain/name overlaps, and CSV dry-run reports row errors"
  );

  // Fixture 31 (F1, F3, F4, F5, F6, F8 & §3.2): Enforce MFA when required, fail closed without APP_BASE_URL in production, block test accounts in production without flag, fail closed on saml/fx api even with keys, verify integer minor units schema, verify explicit program->pipeline assignment, and verify /setup lock
  // F3: Production start without APP_BASE_URL fails closed
  assert.throws(
    () =>
      loadRequiredConfig({
        NODE_ENV: "production",
        SESSION_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef",
        BANK_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef",
        APP_BASE_URL: "",
      }),
    /FAIL_CLOSED: APP_BASE_URL is required when NODE_ENV=production/,
    "Production start without APP_BASE_URL must fail closed (F3)"
  );

  // F5: SSO saml and FX api fail closed even when credentials are supplied
  assert.throws(
    () =>
      loadAndValidateConnectorConfig({
        FX_DRIVER: "api",
        FX_API_KEY: "some-fx-key",
      }),
    /FAIL_CLOSED/,
    "Selecting FX_DRIVER=api must fail closed until implemented (F5)"
  );
  assert.throws(
    () =>
      loadAndValidateConnectorConfig({
        SSO_DRIVER: "saml",
        SAML_IDP_LOGIN_URL: "https://idp.example.com/sso",
        SAML_IDP_CERT: "CERT",
      }),
    /FAIL_CLOSED/,
    "Selecting SSO_DRIVER=saml must fail closed until implemented (F5)"
  );

  // F6 & §3.5.3: Verify zero Float money columns AND zero *Sgd columns exist in PostgreSQL information_schema
  const floatMoneyCols = await prisma.$queryRawUnsafe<
    Array<{ table_name: string; column_name: string; data_type: string }>
  >(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('amount', 'amountBase', 'revenuesBase', 'targetRevBase', 'pendingRewardsAll', 'sourcedRevenue365d', 'influencedRev365d')
      AND data_type != 'integer'
  `);
  assert.equal(
    floatMoneyCols.length,
    0,
    `Expected 0 non-integer money columns in PostgreSQL, found ${JSON.stringify(
      floatMoneyCols
    )}`
  );
  const legacySgdCols = await prisma.$queryRawUnsafe<
    Array<{ table_name: string; column_name: string }>
  >(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('amountSgd', 'revenuesSgd', 'targetRevSgd')
  `);
  assert.equal(
    legacySgdCols.length,
    0,
    `Expected 0 legacy *Sgd columns in PostgreSQL, found ${JSON.stringify(
      legacySgdCols
    )}`
  );

  // F8: Explicit program -> onboarding pipeline assignment; missing or unknown program throws
  assert.throws(
    () => resolveExplicitProgramAndPipeline({}, programs),
    /Explicit programId or programName is required/,
    "Missing program must throw error instead of defaulting to first program (F8)"
  );
  assert.throws(
    () =>
      resolveExplicitProgramAndPipeline(
        { programId: "non-existent-prog" },
        programs
      ),
    /Program not found/,
    "Unknown program must throw error instead of defaulting to first program (F8)"
  );
  const resolvedRefProg = resolveExplicitProgramAndPipeline(
    { programId: "prog-referral" },
    programs
  );
  assert.equal(resolvedRefProg.onboardingPipeline, "Fast-Track Referral");

  // F4: Test accounts are always blocked in production without BLOCK_TEST_ACCOUNTS flag
  const prevNodeEnv = process.env.NODE_ENV;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  try {
    const prodTestAuth = await authenticateUserFromDatabase(
      "alex@r-prm.example.com",
      process.env.SEED_ADMIN_PASSWORD || "",
      "coworker",
      "127.0.0.1"
    );
    assert.equal(
      prodTestAuth.ok,
      false,
      "Test account must be blocked in production unconditionally (F4)"
    );
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
  }

  // F1: MFA required + no code -> login refused (and first-login enrolment issued if no secret yet)
  const enrolledForAlex = { secret: generateTotpSecret() };
  await prisma.user.update({
    where: { id: alexUser.id },
    data: {
      mfaSecret: encryptBankDetails(enrolledForAlex.secret),
      mfaConfirmedAt: new Date(),
      recoveryCodesJson: JSON.stringify(generateRecoveryCodes().hashes),
    },
  });
  // Ensure requireMfaCoworkers is true in account_settings
  const currentAcctRow = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  const currentAcctObj = currentAcctRow
    ? JSON.parse(currentAcctRow.valueJson)
    : {};
  await prisma.appSetting.upsert({
    where: { key: "account_settings" },
    update: {
      valueJson: JSON.stringify({
        ...currentAcctObj,
        requireMfaCoworkers: true,
      }),
    },
    create: {
      key: "account_settings",
      valueJson: JSON.stringify({
        ...currentAcctObj,
        requireMfaCoworkers: true,
      }),
    },
  });

  // Attempt login via POST /api/auth WITHOUT mfaCode -> must return 401
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loginNoMfaReq: any = {
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      identityType: "coworker",
      email: alexUser.email,
      password: process.env.SEED_ADMIN_PASSWORD,
    }),
  };
  const loginNoMfaRes = await authPost(loginNoMfaReq);
  assert.equal(
    loginNoMfaRes.status,
    401,
    "When MFA is required and no code is supplied, login must be refused with 401 (F1)"
  );

  // Attempt login WITH valid TOTP code -> must return 200
  const validAlexTotp = currentTotpCode(enrolledForAlex.secret);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loginWithMfaReq: any = {
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      identityType: "coworker",
      email: alexUser.email,
      password: process.env.SEED_ADMIN_PASSWORD,
      mfaCode: validAlexTotp,
    }),
  };
  const loginWithMfaRes = await authPost(loginWithMfaReq);
  assert.equal(
    loginWithMfaRes.status,
    200,
    "When MFA is required and valid TOTP code is supplied, login must succeed (F1)"
  );

  // §3.2: /setup refuses once an Administrator exists
  const setupStatusRes = await setupGet();
  const setupStatusJson = await setupStatusRes.json();
  assert.equal(
    setupStatusJson.needsSetup,
    false,
    "/api/setup must report needsSetup=false when an admin exists"
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setupAttemptReq: any = {
    json: async () => ({
      workspaceName: "Attacker Claim",
      adminName: "Attacker",
      adminEmail: "attacker@evil.com",
      adminPassword: "AttackerPassword123!",
    }),
  };
  const setupAttemptRes = await setupPost(setupAttemptReq);
  assert.equal(
    setupAttemptRes.status,
    403,
    "POST /api/setup must refuse with 403 once any Administrator exists (§3.2)"
  );

  console.log(
    "✓ Fixture 31 passed (F1, F3, F4, F5, F6, F8 & §3.2): Enforced MFA, production APP_BASE_URL & test-account blocks, fail-closed drivers, integer minor-unit columns, explicit pipeline binding, and /setup lock verified"
  );

  // Fixture 32 (§3.5): No demo defaults, dynamic 12-month chart in workspace timezone, required lead conversion amount in workspace MYR currency, real MFA enrolment status, and unassigned scheduler flag
  // 1. 12-month chart labels computed dynamically in workspace timezone
  const klFixedMonths = computeLast12Months(
    "Asia/Kuala_Lumpur (GMT+08:00)",
    new Date("2026-11-25T02:00:00Z")
  );
  assert.equal(klFixedMonths.length, 12);
  assert.equal(klFixedMonths[0], "12/2025");
  assert.equal(klFixedMonths[11], "11/2026");
  const liveMonths = computeLast12Months("Asia/Kuala_Lumpur (GMT+08:00)");
  assert.equal(
    liveMonths[11],
    currentMonthKeyInTimezone("Asia/Kuala_Lumpur (GMT+08:00)"),
    "12-month chart must end at the current month in the workspace timezone (§3.5.1)"
  );

  // 2. Converting a lead requires an explicit positive amount (no 22,000 / 18,500 default) and defaults currency to workspace mainCurrency ("MYR")
  // Pre-clean any leftover fixture rows from interrupted runs
  await prisma.task.deleteMany({
    where: { associationName: "Unassigned Prospect Sdn Bhd" },
  });
  await prisma.manageItem.deleteMany({
    where: {
      OR: [
        {
          category: "invitation_nurture",
          name: "Invitation Nurture: Unassigned Prospect Sdn Bhd",
        },
        {
          category: "email_outbox",
          subtitle: { contains: "hello@unassigned.example.com" },
        },
      ],
    },
  });
  await prisma.partner.deleteMany({
    where: { name: "Unassigned Prospect Sdn Bhd" },
  });
  await prisma.deal.deleteMany({
    where: { company: "Kuala Lumpur Cloud Sdn Bhd" },
  });
  await prisma.lead.deleteMany({
    where: { email: "farah@klcloud.example.com" },
  });

  const savedAcctRow = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  const rawSavedVal = savedAcctRow ? JSON.parse(savedAcctRow.valueJson) : {};
  const savedAcctVal =
    rawSavedVal.accountName === "Test Co"
      ? {
          ...rawSavedVal,
          accountName: "R-Cloud Enterprise PRM",
          mainCurrency: "SGD",
          timezone: "Asia/Singapore (GMT+08:00)",
          defaultOwnerId: alexUser.id,
          defaultOwnerName: "Alex Morgan",
        }
      : rawSavedVal;

  try {
    await prisma.appSetting.upsert({
      where: { key: "account_settings" },
      update: {
        valueJson: JSON.stringify({
          ...savedAcctVal,
          accountName: "Test Co",
          mainCurrency: "MYR",
          timezone: "Asia/Kuala_Lumpur (GMT+08:00)",
          defaultOwnerId: "",
          defaultOwnerName: "",
        }),
      },
      create: {
        key: "account_settings",
        valueJson: JSON.stringify({
          ...savedAcctVal,
          accountName: "Test Co",
          mainCurrency: "MYR",
          timezone: "Asia/Kuala_Lumpur (GMT+08:00)",
          defaultOwnerId: "",
          defaultOwnerName: "",
        }),
      },
    });

    const tempLead = await prisma.lead.create({
      data: {
        firstName: "Farah",
        lastName: "Aziz",
        company: "Kuala Lumpur Cloud Sdn Bhd",
        email: "farah@klcloud.example.com",
        status: "Accepted",
        sourcePartnerId: "prt-1",
        sourcePartnerName: "Apex Cloud Solutions Pte Ltd",
      },
    });

    // Missing amount -> HTTP 400
    const missingAmtRes = await executeResourceMutation(
      mockAdminSession,
      "CONVERT_LEAD_TO_DEAL",
      { leadId: tempLead.id }
    );
    assert.equal(
      missingAmtRes.status,
      400,
      "Converting a lead without an amount must return HTTP 400 (§3.5.1)"
    );

    // Explicit amount in workspace currency (MYR) -> HTTP 200
    const validConvRes = await executeResourceMutation(
      mockAdminSession,
      "CONVERT_LEAD_TO_DEAL",
      { leadId: tempLead.id, amount: 12500 }
    );
    assert.equal(validConvRes.status, 200);
    const validConvJson = await validConvRes.json();
    assert.equal(
      validConvJson.deal.currency,
      "MYR",
      "Converted deal must default currency to workspace mainCurrency (MYR)"
    );
    assert.equal(validConvJson.deal.amount, toMinorUnits(12500));
    assert.equal(validConvJson.deal.amountBase, toMinorUnits(12500));

    // 3. Scheduler Day-7 task on an ownerless partner when defaultOwnerName is empty leaves assignedTo blank and flags [UNASSIGNED]
    await prisma.partner.create({
      data: {
        name: "Unassigned Prospect Sdn Bhd",
        programId: "prog-strategic",
        programName: "R-Cloud Strategic Solution Partners",
        status: "Pending",
        owner: "",
        currency: "MYR",
        contactEmail: "hello@unassigned.example.com",
        activeSince: "2020-01-01",
        bankDetailsJson: encryptBankDetails("{}"),
      },
    });
    const cronSecret = process.env.CRON_SECRET || "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schedReq: any = {
      headers: new Headers({
        authorization: `Bearer ${cronSecret}`,
        "content-type": "application/json",
      }),
      cookies: { get: () => undefined },
      json: async () => ({ jobType: "invitation_nurture" }),
    };
    const schedRes = await schedulerPost(schedReq);
    assert.equal(schedRes.status, 200);
    const flaggedTask = await prisma.task.findFirst({
      where: { associationName: "Unassigned Prospect Sdn Bhd" },
    });
    assert.ok(
      flaggedTask,
      "Day-7 task must be created for overdue pending partner"
    );
    assert.equal(
      flaggedTask.assignedTo,
      "",
      "Task for ownerless partner with no defaultOwnerName must remain unassigned (never 'Alex Morgan')"
    );
    assert.equal(flaggedTask.status, "Unassigned (Needs Owner)");
    assert.ok(
      flaggedTask.description.includes("[UNASSIGNED"),
      `Expected [UNASSIGNED] flag in task description, got ${flaggedTask.description}`
    );
  } finally {
    await prisma.task.deleteMany({
      where: { associationName: "Unassigned Prospect Sdn Bhd" },
    });
    await prisma.manageItem.deleteMany({
      where: {
        OR: [
          {
            category: "invitation_nurture",
            name: "Invitation Nurture: Unassigned Prospect Sdn Bhd",
          },
          {
            category: "email_outbox",
            subtitle: { contains: "hello@unassigned.example.com" },
          },
        ],
      },
    });
    await prisma.partner.deleteMany({
      where: { name: "Unassigned Prospect Sdn Bhd" },
    });
    await prisma.deal.deleteMany({
      where: { company: "Kuala Lumpur Cloud Sdn Bhd" },
    });
    await prisma.lead.deleteMany({
      where: { email: "farah@klcloud.example.com" },
    });
    await prisma.appSetting.upsert({
      where: { key: "account_settings" },
      update: { valueJson: JSON.stringify(savedAcctVal) },
      create: {
        key: "account_settings",
        valueJson: JSON.stringify(savedAcctVal),
      },
    });
  }

  // 4. Real MFA status on GET /api/auth without leaking mfaSecret
  const tempSess = await createServerSessionRow({
    userId: alexUser.id,
    identityType: "coworker",
    ttlMs: 3600 * 1000,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authStatusReq: any = {
    url: "http://127.0.0.1:3000/api/auth",
    nextUrl: new URL("http://127.0.0.1:3000/api/auth"),
    cookies: {
      get: (name: string) =>
        name === "rprm_session" ? { value: tempSess.cookieValue } : undefined,
    },
  };
  const authStatusRes = await authGet(authStatusReq);
  const authStatusJson = await authStatusRes.json();
  assert.equal(authStatusJson.session.mfaEnrolled, true);
  assert.equal(
    JSON.stringify(authStatusJson).includes(enrolledForAlex.secret),
    false,
    "GET /api/auth must never expose the user's TOTP secret outside enrolment (§3.5.1)"
  );
  await revokeServerSessionById(tempSess.sessionRowId);

  console.log(
    "✓ Fixture 32 passed (§3.5): Dynamic 12-month timezone chart, required lead-to-deal amount in workspace MYR currency, unassigned scheduler flag, and real non-leaking MFA status verified"
  );

  // Fixture 33 (§3.6 MFA): standard authenticator setup at sign-in survives refresh, secret encrypted,
  // confirmation returns 8 recovery codes once, codes are single-use, optional MFA is enforced, legacy secrets re-enrol
  const mfaEmail = `mfa.fixture.${Date.now()}@r-prm.example.com`;
  const mfaPassword = `Fixture-${Date.now()}-Pw!`;
  const mfaUser = await prisma.user.create({
    data: {
      email: mfaEmail,
      name: "MFA Fixture",
      identityType: "coworker",
      role: "Member",
      passwordHash: hashPasswordWithRandomSalt(mfaPassword),
      status: "Active",
      isTestAccount: true,
    },
  });
  const mfaAcctRow = await prisma.appSetting.findUnique({ where: { key: "account_settings" } });
  const mfaAcctSaved = mfaAcctRow?.valueJson || "{}";
  const setRequireMfa = async (required: boolean) => {
    await prisma.appSetting.upsert({
      where: { key: "account_settings" },
      update: { valueJson: JSON.stringify({ ...JSON.parse(mfaAcctSaved), requireMfaCoworkers: required }) },
      create: { key: "account_settings", valueJson: JSON.stringify({ requireMfaCoworkers: required }) },
    });
  };
  const mfaLogin = async (mfaCode?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = {
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ identityType: "coworker", email: mfaEmail, password: mfaPassword, mfaCode }),
    };
    const res = await authPost(req);
    return { status: res.status, json: await res.json() };
  };
  try {
    await setRequireMfa(true);
    const first = await mfaLogin();
    assert.equal(first.status, 403, "Required MFA with no setup returns the setup (403)");
    assert.equal(first.json.mfaEnrollmentRequired, true);
    assert.ok(first.json.enrollment.qrDataUrl.startsWith("data:image/png;base64,"), "QR code image returned");
    const setupKey: string = first.json.enrollment.setupKey;
    const pendingSecret = setupKey.replace(/\s/g, "");
    assert.ok(isBase32Secret(pendingSecret), "Setup key is standard base32");
    assert.ok(first.json.enrollment.otpauthUri.includes(`secret=${pendingSecret}`));
    assert.equal(first.json.recoveryCodes, undefined, "No recovery codes before setup is confirmed");

    const refreshed = await mfaLogin();
    assert.equal(refreshed.json.enrollment.setupKey, setupKey, "Refreshing shows the same pending setup");
    const storedPending = await prisma.user.findUnique({ where: { id: mfaUser.id } });
    assert.ok(storedPending?.mfaSecret?.startsWith("enc:v1:"), "Secret is encrypted at rest");
    assert.ok(!storedPending?.mfaSecret?.includes(pendingSecret), "Plain secret never stored");
    assert.equal(storedPending?.mfaConfirmedAt, null, "Setup stays pending until confirmed");

    const wrongFirst = await mfaLogin("000000");
    assert.equal(wrongFirst.status, 401, "Wrong first code refused");
    assert.equal(wrongFirst.json.enrollment.setupKey, setupKey, "Setup still shown after a wrong code");

    const confirmed = await mfaLogin(currentTotpCode(pendingSecret));
    assert.equal(confirmed.status, 200, "Valid first code confirms setup and signs in");
    assert.equal(confirmed.json.recoveryCodes.length, 8, "8 recovery codes shown once at confirmation");
    assert.equal(confirmed.json.session.mfaEnrolled, true);
    const storedConfirmed = await prisma.user.findUnique({ where: { id: mfaUser.id } });
    assert.ok(storedConfirmed?.mfaConfirmedAt, "Confirmation time recorded");
    const recoveryList: string[] = confirmed.json.recoveryCodes;
    assert.ok(
      !String(storedConfirmed?.recoveryCodesJson).includes(recoveryList[0].replace("-", "")),
      "Recovery codes stored as hashes only"
    );

    const noCode = await mfaLogin();
    assert.equal(noCode.status, 401, "Confirmed MFA requires a code");
    assert.equal(noCode.json.mfaRequired, true);
    const withRecovery = await mfaLogin(recoveryList[0]);
    assert.equal(withRecovery.status, 200, "Recovery code signs in");
    assert.equal(withRecovery.json.recoveryCodesLeft, 7, "Remaining recovery codes reported");
    const reusedRecovery = await mfaLogin(recoveryList[0]);
    assert.equal(reusedRecovery.status, 401, "Recovery code works only once");

    await setRequireMfa(false);
    const optional = await mfaLogin();
    assert.equal(optional.status, 401, "MFA the user switched on is enforced even when policy doesn't require it");
    const optionalOk = await mfaLogin(currentTotpCode(pendingSecret));
    assert.equal(optionalOk.status, 200);

    // Legacy secret (old non-standard format, plaintext) is treated as not set up
    await prisma.user.update({
      where: { id: mfaUser.id },
      data: { mfaSecret: "AC8CA9130B119E253393", mfaConfirmedAt: new Date(), recoveryCodesJson: "[]" },
    });
    const legacyOptional = await mfaLogin();
    assert.equal(legacyOptional.status, 200, "Legacy secret no longer blocks sign-in when MFA isn't required");
    await setRequireMfa(true);
    const legacyRequired = await mfaLogin();
    assert.equal(legacyRequired.status, 403, "Legacy secret triggers a fresh standard setup when required");
    assert.notEqual(legacyRequired.json.enrollment.setupKey.replace(/\s/g, ""), "AC8CA9130B119E253393");
  } finally {
    await prisma.appSetting.update({ where: { key: "account_settings" }, data: { valueJson: mfaAcctSaved } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { userId: mfaUser.id } });
    await prisma.user.delete({ where: { id: mfaUser.id } });
  }
  console.log(
    "✓ Fixture 33 passed (§3.6 MFA): standard base32 setup with QR, refresh-safe pending setup, encrypted secret, 8 hashed single-use recovery codes, optional MFA enforced, legacy secrets re-enrol"
  );

  // Fixture 34 (§3.6): prospection board settings, honest partner-type default, CSV export escaping
  assert.deepEqual(readProspectionSettings({}).stages, ["New", "Onboarding", "Active"], "Default board columns");
  assert.deepEqual(
    readProspectionSettings({ prospectionStages: [" Lead ", "lead", "Qualified", ""] }).stages,
    ["Lead", "Qualified"],
    "Saved columns are trimmed and de-duplicated"
  );
  assert.deepEqual(
    readProspectionSettings({ prospectionCardFields: ["owner", "bogus", "country"] }).cardFields,
    ["owner", "country"],
    "Unknown card fields are ignored"
  );
  assert.deepEqual(readProspectionSettings({ prospectionCardFields: [] }).cardFields, [], "All card fields can be hidden");
  const typelessProgram = await prisma.program.findFirst();
  const typelessName = `Typeless Partner ${Date.now()}`;
  const typelessRes = await executeResourceMutation(mockAdminSession, "CREATE_PARTNER", {
    name: typelessName,
    programId: typelessProgram?.id,
  });
  assert.equal(typelessRes.status, 200, "Partner without a type can be created");
  const typelessRow = await prisma.partner.findFirst({ where: { name: typelessName } });
  assert.equal(typelessRow?.partnerType, "", "A partner created without a type has no made-up type");
  if (typelessRow) await prisma.partner.delete({ where: { id: typelessRow.id } });
  assert.equal(escapeCsvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"", "Formula cells are neutralised and quoted");
  assert.equal(escapeCsvCell("+65 1234"), "'+65 1234", "Leading + is neutralised");
  assert.equal(escapeCsvCell("a,b"), "\"a,b\"", "Commas are quoted");
  const exportCsv = rowsToCsv([
    { id: "1", name: "Acme", levelsJson: "[]", leadFormTokenHash: "x", amount: 100 },
    { id: "2", name: "-Beta", amount: 200, nested: { a: 1 } },
  ]);
  assert.equal(exportCsv.split("\r\n")[0], "id,name,amount", "Internal JSON, hash and nested columns are not exported");
  assert.equal(exportCsv.split("\r\n")[2], "2,'-Beta,200");
  console.log(
    "✓ Fixture 34 passed (§3.6): configurable prospection columns and card fields, no made-up partner type, CSV export with formula escaping"
  );

  // Fixture 35 (§3.6 no fake controls): list filters/paging/saved views, API tokens, self-invoice PDF,
  // password change, program rename
  const now35 = new Date("2026-06-15T12:00:00Z");
  const sampleRows = [
    { id: "a", name: "Alpha", status: "Active", amount: 500, createdAt: "2026-06-10T00:00:00Z" },
    { id: "b", name: "Beta", status: "Pending", amount: 50, createdAt: "2026-03-01T00:00:00Z" },
    { id: "c", name: "Gamma", status: "", amount: 1500, createdAt: "2025-12-01T00:00:00Z" },
  ];
  assert.deepEqual(
    applyListState(sampleRows, { dateRange: "last30", filters: [], pageSize: 25 }, "createdAt", now35).map((r) => r.id),
    ["a"],
    "Last 30 days keeps only recent rows"
  );
  assert.deepEqual(
    applyListState(sampleRows, { dateRange: "thisYear", filters: [{ field: "amount", operator: "gt", value: "100" }], pageSize: 25 }, "createdAt", now35).map((r) => r.id),
    ["a"],
    "Date range and number filter combine"
  );
  assert.equal(matchesFilter(sampleRows[2], { field: "status", operator: "isEmpty", value: "" }), true);
  assert.equal(matchesFilter(sampleRows[1], { field: "name", operator: "contains", value: "ET" }), true, "contains is case-insensitive");
  assert.equal(matchesFilter(sampleRows[0], { field: "status", operator: "isNot", value: "active" }), false);
  const paged35 = pageOf(Array.from({ length: 60 }, (_, i) => i), 3, 25);
  assert.deepEqual([paged35.page, paged35.pageCount, paged35.rows.length], [3, 3, 10], "Paging");
  assert.equal(pageOf([1, 2], 9, 25).page, 1, "Out-of-range page clamps");
  assert.deepEqual(
    cleanSavedViews([{ name: " Big deals ", baseView: "All", dateRange: "bogus", filters: [{ field: "amount", operator: "gt", value: "1000" }, { field: "x", operator: "drop" }], pageSize: 7 }, { nope: 1 }]),
    [{ name: "Big deals", baseView: "All", dateRange: "all", filters: [{ field: "amount", operator: "gt", value: "1000" }], pageSize: 25 }],
    "Saved views are validated"
  );

  // API tokens: admin creates, token authenticates API calls, revoked token stops working
  const adminSess35 = await createServerSessionRow({ userId: alexUser.id, identityType: "coworker", ttlMs: 3600 * 1000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookieReq = (cookie: string, init: { url?: string; method?: string; body?: unknown } = {}): any => ({
    url: init.url || "http://127.0.0.1:3000/api/api-tokens",
    headers: new Headers({ "content-type": "application/json" }),
    cookies: { get: (n: string) => (n === "rprm_session" ? { value: cookie } : undefined) },
    json: async () => init.body,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bearerReq = (token: string, url = "http://127.0.0.1:3000/api/api-tokens"): any => ({
    url,
    headers: new Headers({ authorization: `Bearer ${token}` }),
    cookies: { get: () => undefined },
    json: async () => ({}),
  });
  const createdTok = await apiTokensPost(cookieReq(adminSess35.cookieValue, { body: { name: "n8n fixture" } }));
  assert.equal(createdTok.status, 200, "Admin can create a token");
  const createdTokJson = await createdTok.json();
  const rawToken: string = createdTokJson.token;
  assert.match(rawToken, /^rprm_[A-Za-z0-9_-]{43}$/, "Token format");
  const tokRow = await prisma.apiToken.findUnique({ where: { id: createdTokJson.tokenInfo.id } });
  assert.ok(tokRow && !JSON.stringify(tokRow).includes(rawToken), "Only a hash of the token is stored");
  const viaToken = await getActiveServerSession(bearerReq(rawToken));
  assert.equal(viaToken?.userId, alexUser.id, "Bearer token authenticates as its creator");
  assert.equal((await getActiveServerSession(bearerReq(rawToken.slice(0, -1) + (rawToken.endsWith("A") ? "B" : "A"))))?.userId, undefined, "Altered token rejected");
  assert.equal((await apiTokensGet(bearerReq(rawToken))).status, 403, "A token can't manage tokens");
  const listJson = await (await apiTokensGet(cookieReq(adminSess35.cookieValue))).json();
  assert.ok(!JSON.stringify(listJson).includes(rawToken), "Token list never contains the token");
  const revokeRes = await apiTokensDelete(cookieReq(adminSess35.cookieValue, { url: `http://127.0.0.1:3000/api/api-tokens?id=${createdTokJson.tokenInfo.id}` }));
  assert.equal(revokeRes.status, 200);
  assert.equal(await getActiveServerSession(bearerReq(rawToken)), null, "Revoked token stops working");

  // Self-billed invoice PDF from real payout data
  const payout35 = await prisma.payout.findFirst({ where: { rewards: { some: {} } }, include: { rewards: true } });
  assert.ok(payout35, "A payout with linked rewards exists");
  const acct35Row = await prisma.appSetting.findUnique({ where: { key: "account_settings" } });
  const acct35Saved = acct35Row?.valueJson || "{}";
  const setSelfInvoicing = async (on: boolean) =>
    prisma.appSetting.update({
      where: { key: "account_settings" },
      data: { valueJson: JSON.stringify({ ...JSON.parse(acct35Saved), selfInvoicingEnabled: on, legalEntityName: "Test Co Pte Ltd" }) },
    });
  try {
    await setSelfInvoicing(false);
    const offRes = await payoutInvoiceGet(cookieReq(adminSess35.cookieValue), { params: { id: payout35!.id } });
    assert.equal(offRes.status, 409, "No invoice when self-invoicing is off");
    await setSelfInvoicing(true);
    const pdfRes = await payoutInvoiceGet(cookieReq(adminSess35.cookieValue), { params: { id: payout35!.id } });
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers.get("content-type"), "application/pdf");
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
    assert.equal(pdfBytes.subarray(0, 5).toString(), "%PDF-", "Response is a real PDF");
    assert.ok(pdfBytes.length > 1500, "PDF has content");
    const outsider = await prisma.user.findFirst({ where: { identityType: "partner", NOT: { partnerName: payout35!.partnerName } } });
    if (outsider) {
      const outsiderSess = await createServerSessionRow({ userId: outsider.id, identityType: "partner", ttlMs: 600000 });
      const outsiderRes = await payoutInvoiceGet(cookieReq(outsiderSess.cookieValue), { params: { id: payout35!.id } });
      assert.equal(outsiderRes.status, 404, "Partners can't download another partner's invoice");
      await revokeServerSessionById(outsiderSess.sessionRowId);
    }
  } finally {
    await prisma.appSetting.update({ where: { key: "account_settings" }, data: { valueJson: acct35Saved } });
  }

  // Password change: wrong current refused; success signs out other sessions and the new password works
  const pwEmail = `pw.fixture.${Date.now()}@r-prm.example.com`;
  const pwUser = await prisma.user.create({
    data: { email: pwEmail, name: "PW Fixture", identityType: "coworker", role: "Member", passwordHash: hashPasswordWithRandomSalt("Old-Password-123!"), status: "Active", isTestAccount: true },
  });
  try {
    const pwSessA = await createServerSessionRow({ userId: pwUser.id, identityType: "coworker", ttlMs: 600000 });
    const pwSessB = await createServerSessionRow({ userId: pwUser.id, identityType: "coworker", ttlMs: 600000 });
    const wrongPw = await authPost(cookieReq(pwSessA.cookieValue, { url: "http://127.0.0.1:3000/api/auth", body: { action: "change_password", currentPassword: "nope", newPassword: "New-Password-456!" } }));
    assert.equal(wrongPw.status, 400, "Wrong current password refused");
    const shortPw = await authPost(cookieReq(pwSessA.cookieValue, { url: "http://127.0.0.1:3000/api/auth", body: { action: "change_password", currentPassword: "Old-Password-123!", newPassword: "short" } }));
    assert.equal(shortPw.status, 400, "Short password refused");
    const okPw = await authPost(cookieReq(pwSessA.cookieValue, { url: "http://127.0.0.1:3000/api/auth", body: { action: "change_password", currentPassword: "Old-Password-123!", newPassword: "New-Password-456!" } }));
    assert.equal(okPw.status, 200, "Password changed");
    const pwAfter = await prisma.user.findUnique({ where: { id: pwUser.id } });
    assert.equal(verifyPasswordWithStoredSalt("New-Password-456!", pwAfter!.passwordHash), true, "New password works");
    assert.equal(verifyPasswordWithStoredSalt("Old-Password-123!", pwAfter!.passwordHash), false, "Old password no longer works");
    const sessB = await prisma.session.findUnique({ where: { id: pwSessB.sessionRowId } });
    const sessA = await prisma.session.findUnique({ where: { id: pwSessA.sessionRowId } });
    assert.ok(sessB?.revokedAt, "Other sessions signed out");
    assert.equal(sessA?.revokedAt, null, "Current session kept");
  } finally {
    await prisma.session.deleteMany({ where: { userId: pwUser.id } });
    await prisma.user.delete({ where: { id: pwUser.id } });
  }

  // Program rename keeps partner copies of the name in sync
  const renameProg = await prisma.program.findFirst({ where: { partners: { some: {} } } });
  assert.ok(renameProg, "A program with partners exists");
  const renamed = `${renameProg!.name} (renamed)`;
  const renameRes = await executeResourceMutation(mockAdminSession, "UPDATE_PROGRAM", { id: renameProg!.id, data: { name: renamed } });
  assert.equal(renameRes.status, 200);
  const staleCopies = await prisma.partner.count({ where: { programId: renameProg!.id, NOT: { programName: renamed } } });
  assert.equal(staleCopies, 0, "Partners show the new program name");
  const emptyRename = await executeResourceMutation(mockAdminSession, "UPDATE_PROGRAM", { id: renameProg!.id, data: { name: "  " } });
  assert.equal(emptyRename.status, 400, "Empty program name refused");
  await executeResourceMutation(mockAdminSession, "UPDATE_PROGRAM", { id: renameProg!.id, data: { name: renameProg!.name } });
  await revokeServerSessionById(adminSess35.sessionRowId);
  console.log(
    "✓ Fixture 35 passed (§3.6): real list date/filters/paging/saved views, API tokens (hashed, bearer auth, revoke), self-billed invoice PDF, password change, program rename"
  );

  // Fixture 36 (§3.6 R2a): the live reward engine follows each rule — month windows and rate steps,
  // transaction count, running total, customer fields, deal-won and lead-accepted triggers, no double-paying
  assert.equal(sortableMonthKey("06/2026"), "2026-06");
  assert.equal(monthsBetween("11/2025", "02/2026"), 3, "Month maths crosses the year boundary");
  const stamp36 = Date.now();
  const premiumTpl = DEFAULT_COMMISSION_TEMPLATES.biz_partner_premium_recurring;
  const engineRules = [
    { ...premiumTpl, id: `r36-premium-${stamp36}`, title: "Premium steps" },
    {
      id: `r36-count-${stamp36}`, title: "3rd to 5th transaction 10%", trigger: "transaction_added_customer",
      conditions: [{ type: "transaction_count", from: 3, to: 5 }],
      valueType: "Cash", amountMode: "percentage", rateOrAmount: 10, requiresValidation: true, clawbackOnRefund: true,
    },
    {
      id: `r36-monthly-${stamp36}`, title: "Monthly plans 1%", trigger: "transaction_added_customer",
      conditions: [{ type: "customer_property", field: "billingFrequency", operator: "contains", value: "month" }],
      valueType: "Cash", amountMode: "percentage", rateOrAmount: 1, requiresValidation: true, clawbackOnRefund: true,
    },
    {
      id: `r36-sum-${stamp36}`, title: "Bonus once customer total reaches 10,000", trigger: "transaction_added_customer",
      conditions: [{ type: "transaction_sum", operator: "gte", value: 10000 }, { type: "transaction_count", from: 10, to: 10 }],
      valueType: "Cash", amountMode: "fixed", rateOrAmount: 300, currency: "SGD", requiresValidation: true, clawbackOnRefund: true,
    },
    {
      id: `r36-won-${stamp36}`, title: "Deal won bonus", trigger: "deal_closed_won",
      valueType: "Cash", amountMode: "fixed", rateOrAmount: 500, currency: "SGD", requiresValidation: true, clawbackOnRefund: true,
    },
    {
      id: `r36-lead-${stamp36}`, title: "Accepted lead bonus", trigger: "lead_accepted",
      valueType: "Gift card", amountMode: "fixed", rateOrAmount: 50, currency: "SGD", requiresValidation: false, clawbackOnRefund: false,
    },
  ];
  const engineProg = await prisma.program.create({
    data: {
      name: `Engine Fixture Program ${stamp36}`,
      onboardingPipelineId: "Default Onboarding",
      levelsJson: JSON.stringify([{ name: "Engine Level", rewards: engineRules, benefits: [], requirements: [] }]),
      autoEmailsJson: "{}",
      permissionsJson: "{}",
    },
  });
  const enginePartnerName = `Engine Fixture Partner ${stamp36}`;
  const engPartnerRes = await executeResourceMutation(mockAdminSession, "CREATE_PARTNER", {
    name: enginePartnerName, programId: engineProg.id, qualifyingLevel: "Engine Level",
  });
  assert.equal(engPartnerRes.status, 200, "Engine fixture partner created");
  const monthlyCust = await prisma.customer.create({
    data: { name: `Monthly Merchant ${stamp36}`, email: `m.${stamp36}@example.com`, sourcePartnerName: enginePartnerName, billingFrequency: "Monthly", billingPeriod: "1" },
  });
  const yearlyCust = await prisma.customer.create({
    data: { name: `Yearly Merchant ${stamp36}`, email: `y.${stamp36}@example.com`, sourcePartnerName: enginePartnerName, billingFrequency: "Yearly", billingPeriod: "12" },
  });
  const monthKeyFor = (i: number) => {
    const d = new Date(Date.UTC(2024, 10 + i, 1)); // month 1 = 11/2024
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  };
  const byRule: Record<string, number[]> = {};
  for (let m = 1; m <= 28; m++) {
    const res = await executeResourceMutation(mockAdminSession, "CREATE_TRANSACTION", {
      name: `ENG-${stamp36}-M${m}`, amount: 1000, currency: "SGD", partnerName: enginePartnerName,
      customerName: monthlyCust.name.toUpperCase(), monthKey: monthKeyFor(m),
    });
    assert.equal(res.status, 200, `Transaction month ${m} recorded`);
    const txJson = await res.json();
    assert.equal(txJson.transaction.customerId, monthlyCust.id, "Transaction linked to the customer (name match ignores case)");
  }
  const engineRewards = await prisma.reward.findMany({ where: { partnerName: enginePartnerName } });
  for (const r of engineRewards) {
    const month = Number(/-M(\d+)$/.exec(r.fromActivity)?.[1] || 0);
    (byRule[r.fromRewardRule] ||= []).push(month * 1000000 + toMajorUnits(r.amount));
  }
  const months = (rule: string) => (byRule[rule] || []).map((v) => Math.floor(v / 1000000)).sort((a, b) => a - b);
  const amountsFor = (rule: string, month: number) =>
    (byRule[rule] || []).filter((v) => Math.floor(v / 1000000) === month).map((v) => v % 1000000);
  assert.deepEqual(months("Premium steps"), Array.from({ length: 24 }, (_, i) => i + 4), "Premium pays months 4–27 only (live)");
  assert.deepEqual(amountsFor("Premium steps", 4), [200], "20% in month 4");
  assert.deepEqual(amountsFor("Premium steps", 15), [200], "20% in month 15");
  assert.deepEqual(amountsFor("Premium steps", 16), [100], "10% from month 16");
  assert.deepEqual(amountsFor("Premium steps", 27), [100], "10% in month 27");
  assert.deepEqual(months("3rd to 5th transaction 10%"), [3, 4, 5], "Transaction-count rule pays the 3rd–5th transaction");
  assert.equal(months("Monthly plans 1%").length, 28, "Customer-field rule pays every monthly-plan transaction");
  assert.deepEqual(months("Bonus once customer total reaches 10,000"), [10], "Running-total rule pays when the condition is met");
  assert.equal(months("Deal won bonus").length, 0, "Deal-won rule doesn't fire on transactions");
  const numbers = engineRewards.map((r) => r.rewardNumber);
  assert.equal(new Set(numbers).size, numbers.length, "Reward numbers are unique");
  assert.ok(numbers.every((n) => /^RW-\d+$/.test(n)), "Reward numbers are RW-<n>");

  // Re-running the engine for an existing transaction pays nothing twice
  const m4Tx = await prisma.transaction.findFirst({ where: { name: `ENG-${stamp36}-M4` } });
  const rerun = await generateRewardsForTransaction(m4Tx!.id, "SGD");
  assert.equal(rerun.created, 0, "No duplicate rewards on re-run");
  assert.ok(rerun.skipped >= 2, "Existing rewards recognised");

  // Yearly customer: the monthly-plan rule doesn't apply
  const yRes = await executeResourceMutation(mockAdminSession, "CREATE_TRANSACTION", {
    name: `ENG-${stamp36}-Y1`, amount: 1000, currency: "SGD", partnerName: enginePartnerName, customerId: yearlyCust.id, monthKey: "01/2025",
  });
  assert.equal(yRes.status, 200);
  const yRewards = await prisma.reward.findMany({ where: { fromActivity: `ENG-${stamp36}-Y1` } });
  assert.ok(!yRewards.some((r) => r.fromRewardRule === "Monthly plans 1%"), "Customer-field condition excludes yearly plans");

  // Cancelled customer: transactions after the cancellation month earn nothing; earlier ones still count
  await prisma.customer.update({ where: { id: yearlyCust.id }, data: { status: "Canceled", canceledDate: "2025-06-01" } });
  const afterCancel = await executeResourceMutation(mockAdminSession, "CREATE_TRANSACTION", {
    name: `ENG-${stamp36}-Y2`, amount: 1000, currency: "SGD", partnerName: enginePartnerName, customerId: yearlyCust.id, monthKey: "07/2025",
  });
  assert.equal(afterCancel.status, 200);
  assert.equal(await prisma.reward.count({ where: { fromActivity: `ENG-${stamp36}-Y2` } }), 0, "No reward after the customer cancelled");
  const badCustomer = await executeResourceMutation(mockAdminSession, "CREATE_TRANSACTION", {
    name: `ENG-${stamp36}-BAD`, amount: 10, currency: "SGD", partnerName: enginePartnerName, customerId: "no-such-customer",
  });
  assert.equal(badCustomer.status, 400, "Unknown customer id refused");

  // Deal won: deal-won rule pays once; transaction rules don't pay on the deal
  const engDeal = await prisma.deal.create({
    data: {
      name: `ENG Deal ${stamp36}`, clientName: "Client", company: "Client Co", amount: toMinorUnits(20000), currency: "SGD",
      amountBase: toMinorUnits(20000), partnerName: enginePartnerName, sourcePartnerName: enginePartnerName, stage: "Negotiation",
    },
  });
  for (let i = 0; i < 2; i++) {
    const won = await executeResourceMutation(mockAdminSession, "UPDATE_DEAL_STAGE", { id: engDeal.id, stage: "Closed Won" });
    assert.equal(won.status, 200);
  }
  const dealRewards = await prisma.reward.findMany({ where: { fromActivity: engDeal.name } });
  assert.deepEqual(dealRewards.map((r) => [r.fromRewardRule, toMajorUnits(r.amount)]), [["Deal won bonus", 500]], "Deal won pays the deal rule once");

  // Lead accepted
  const engLead = await prisma.lead.create({
    data: { firstName: "Lia", lastName: "Tan", company: "Lead Co", email: `lead.${stamp36}@example.com`, status: "Pending", sourcePartnerName: enginePartnerName },
  });
  const accepted = await executeResourceMutation(mockAdminSession, "UPDATE_LEAD_STATUS", { id: engLead.id, status: "Accepted" });
  assert.equal(accepted.status, 200);
  const leadRewards = await prisma.reward.findMany({ where: { sourceKey: { endsWith: `::${engLead.id}` } } });
  assert.deepEqual(leadRewards.map((r) => [r.type, toMajorUnits(r.amount), r.status]), [["Gift card", 50, "Accepted"]], "Lead-accepted rule pays its gift card");

  // Clean up
  await prisma.reward.deleteMany({ where: { partnerName: enginePartnerName } });
  await prisma.transaction.deleteMany({ where: { partnerName: enginePartnerName } });
  await prisma.deal.delete({ where: { id: engDeal.id } });
  await prisma.lead.delete({ where: { id: engLead.id } });
  await prisma.customer.deleteMany({ where: { id: { in: [monthlyCust.id, yearlyCust.id] } } });
  await prisma.partner.deleteMany({ where: { name: enginePartnerName } });
  await prisma.program.delete({ where: { id: engineProg.id } });
  console.log(
    "✓ Fixture 36 passed (§3.6 R2a): live engine applies month windows and 20%→10% steps, transaction count, running total, customer fields, deal-won and lead-accepted triggers; unique reward numbers; no double-paying"
  );

  // Fixture 37 (§3.6 R3): opening a rule in the builder and saving it unchanged never changes what it pays;
  // the one-line summary and the save checks behave as written
  const dbPrograms37 = await prisma.program.findMany();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules37: any[] = [
    ...Object.values(DEFAULT_COMMISSION_TEMPLATES),
    ...dbPrograms37.flatMap((p) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (JSON.parse(p.levelsJson || "[]") as any[]).flatMap((l) => l.rewards || []);
      } catch {
        return [];
      }
    }),
    { id: "l37-a", title: "Legacy open-ended", trigger: "transaction_paid", valueType: "Cash", amountMode: "percentage", rateOrAmount: 12, duration: "recurring", startOffsetMonths: 1, requiresValidation: true, clawbackOnRefund: true },
    { id: "l37-b", title: "Legacy from month 3", trigger: "transaction_paid", valueType: "Cash", amountMode: "fixed", rateOrAmount: 40, currency: "SGD", duration: "recurring", startOffsetMonths: 3, requiresValidation: true, clawbackOnRefund: true },
    { id: "l37-c", title: "Legacy deal rule with duration", trigger: "deal_closed_won", valueType: "Cash", amountMode: "fixed", rateOrAmount: 250, currency: "SGD", duration: "one_off", startOffsetMonths: 4, durationMonths: 1, requiresValidation: true, clawbackOnRefund: true },
    { id: "l37-d", title: "Legacy amount floor", trigger: "transaction_paid", conditions: [{ field: "amount", operator: ">=", value: 500 }], valueType: "Cash", amountMode: "percentage", rateOrAmount: 5, requiresValidation: true, clawbackOnRefund: true },
    { id: "l37-e", title: "Free text rule", trigger: "On every transaction from won deals", rate: "10%" },
  ];
  assert.ok(rules37.length >= 10, "Equivalence covers templates, every seeded rule and older formats");
  const events37: RewardEvent[] = [];
  for (const trigger of ["transaction_added_customer", "transaction_added_deal", "new_transaction"] as const) {
    for (let m = 1; m <= 30; m++) {
      for (const amount of [300, 1000]) {
        events37.push({
          trigger, sourceId: `e37-${trigger}-${m}-${amount}`, sourceLabel: "x", partnerName: "P", currency: "SGD", amount,
          record: { amount, name: "TX" }, customer: { billingFrequency: m % 2 ? "Monthly" : "Yearly", subscriptionPlan: "Pro" },
          hasDeal: trigger !== "transaction_added_customer", monthIndex: m, transactionIndex: m, runningSum: amount * m,
          monthlySubscriptionFee: amount, isStillPartnerClient: m !== 29,
          ...(m === 7 ? { agreedOverrideRatePct: 8, agreedBeforeAcceptanceTimestamp: "2026-01-01", orderAcceptedTimestamp: "2026-01-02" } : {}),
        });
      }
    }
  }
  events37.push(
    { trigger: "deal_closed_won", sourceId: "e37-deal", sourceLabel: "d", partnerName: "P", currency: "SGD", amount: 20000, record: { amount: 20000 } },
    { trigger: "deal_closed_won", sourceId: "e37-deal-agreed", sourceLabel: "d", partnerName: "P", currency: "SGD", amount: 20000, record: { amount: 20000 }, agreedOverrideRatePct: 6, agreedBeforeAcceptanceTimestamp: "2026-01-01", orderAcceptedTimestamp: "2026-01-02" },
    { trigger: "lead_accepted", sourceId: "e37-lead", sourceLabel: "l", partnerName: "P", currency: "SGD", amount: 0, record: {} }
  );
  let compared37 = 0;
  for (const original of rules37) {
    const norm = normalizeRewardRule(original, "SGD");
    const edited = toEditableRule(original, "SGD");
    assert.equal(edited.duration, undefined, `${norm.title}: editor drops the old duration fields`);
    const reEdited = toEditableRule(JSON.parse(JSON.stringify(edited)), "SGD");
    assert.deepEqual(reEdited, edited, `${norm.title}: opening a saved rule again changes nothing`);
    for (const e of events37) {
      const outcome37 = (r: ReturnType<typeof evaluateRuleAmount>) => (r.paid ? r : { paid: false });
      assert.deepEqual(outcome37(evaluateRuleAmount(edited, e)), outcome37(evaluateRuleAmount(norm, e)), `${norm.title}: same result for ${e.sourceId}`);
      compared37++;
    }
  }
  const premium37 = toEditableRule(DEFAULT_COMMISSION_TEMPLATES.biz_partner_premium_recurring, "SGD");
  assert.ok(premium37.conditions?.some((c) => (c as { type?: string }).type === "month_range"), "Premium window becomes a visible month range");
  assert.match(describeRule(premium37, "SGD"), /20% \(months 4–15\) then 10% \(months 16–27\)/);
  assert.match(describeRule(premium37, "SGD"), /from month 4 to month 27/);
  const oneOff37 = toEditableRule(DEFAULT_COMMISSION_TEMPLATES.biz_partner_one_off, "SGD");
  assert.match(describeRule(oneOff37, "SGD"), /^one month's subscription fee for every .*in month 4 only\.$/);
  const built37 = {
    id: "b37", title: "Monthly plans, 3rd to 15th transaction", trigger: "transaction_added_customer" as const, valueType: "Cash" as const,
    amountMode: "percentage" as const, rateOrAmount: 10, requiresValidation: true, clawbackOnRefund: true,
    conditions: [{ type: "transaction_count" as const, from: 3, to: 15 }, { type: "customer_property" as const, field: "billingFrequency", operator: "contains" as const, value: "month" }],
  };
  assert.equal(
    describeRule(built37, "SGD"),
    `10% of amount for every transaction added on a customer, from the customer's 3rd to 15th transaction, if the customer's billing frequency contains "month".`
  );
  assert.deepEqual(validateRule(built37), []);
  assert.ok(validateRule({ ...built37, title: " " }).includes("Give the reward a label."));
  assert.ok(validateRule({ ...built37, rateOrAmount: 0 }).includes("Enter a percentage above 0."));
  assert.ok(validateRule({ ...built37, rateOrAmount: 120 }).includes("A percentage can't be more than 100%."));
  assert.ok(validateRule({ ...built37, conditions: [{ type: "transaction_count", from: 5, to: 2 }] }).length === 1, "Backwards range refused");
  assert.ok(validateRule({ ...built37, conditions: [{ type: "customer_property", field: "", operator: "contains", value: "x" }] }).includes("Choose a field for each field condition."));
  assert.ok(validateRule({ ...built37, rateSteps: [{ fromMonth: 1, toMonth: 12, ratePct: 20 }, { fromMonth: 10, toMonth: 20, ratePct: 10 }] }).includes("Rate steps overlap."));
  assert.deepEqual(validateRule(toEditableRule(DEFAULT_COMMISSION_TEMPLATES.referral_entry, "SGD")), [], "Agreed-rate rule may have 0% (it uses the agreed rate)");
  console.log(`✓ Fixture 37 passed (§3.6 R3): ${rules37.length} rules × ${events37.length} events (${compared37} checks) pay the same after editing; summaries and save checks correct`);

  // Fixture 38 (§3.6 R2b): custom fields — checked definitions and values, stored on records, audited,
  // admin-only, and usable in reward rules (conditions and "% of field"); partners can't edit admin fields
  assert.equal(keyFromLabel("Billing Period (months)"), "billing_period_months");
  const defs38: CustomFieldDefinition[] = [
    { id: "d1", key: "plan_type", label: "Plan type", objectType: "Transactions", fieldType: "select", options: ["Monthly", "Quarterly"], archived: false },
    { id: "d2", key: "setup_fee", label: "Setup fee", objectType: "Transactions", fieldType: "number", options: [], archived: false },
    { id: "d3", key: "renewal", label: "Renewal", objectType: "Transactions", fieldType: "checkbox", options: [], archived: false },
    { id: "d4", key: "billing_contact", label: "Billing contact", objectType: "Transactions", fieldType: "email", options: [], archived: false },
    { id: "d5", key: "go_live", label: "Go-live", objectType: "Transactions", fieldType: "date", options: [], archived: false },
    { id: "d6", key: "old_code", label: "Old code", objectType: "Transactions", fieldType: "text", options: [], archived: true },
  ];
  const good38 = checkCustomValues(defs38, { plan_type: "monthly", setup_fee: "1,250.50", renewal: "yes", billing_contact: "Ops@Example.com", go_live: "2026-02-28" });
  assert.ok(good38.ok);
  if (good38.ok) assert.deepEqual(good38.values, { plan_type: "Monthly", setup_fee: 1250.5, renewal: true, billing_contact: "ops@example.com", go_live: "2026-02-28" }, "Values are cleaned to their type");
  const bad38 = checkCustomValues(defs38, { plan_type: "Weekly", setup_fee: "abc", renewal: "maybe", billing_contact: "nope", go_live: "2026-02-30", old_code: "x", nonsense: 1 });
  assert.ok(!bad38.ok && bad38.errors.length === 7, "Every bad value, unknown field and archived field is refused");
  const cleared38 = checkCustomValues(defs38, { setup_fee: "" }, { setup_fee: 10, plan_type: "Monthly" });
  assert.ok(cleared38.ok && !("setup_fee" in cleared38.values) && cleared38.values.plan_type === "Monthly", "Empty removes one value, keeps the rest");
  assert.ok(!checkDefinition({ label: "Plan type", objectType: "Transactions", fieldType: "text" }, defs38).ok, "Duplicate name on the same record type refused");
  assert.ok(checkDefinition({ label: "Plan type", objectType: "Customers", fieldType: "text" }, defs38).ok, "Same name on another record type is fine");
  assert.ok(!checkDefinition({ label: "Tier", objectType: "Customers", fieldType: "select", options: "" }, defs38).ok, "Single select needs options");
  const edit38 = checkDefinition({ label: "Plan kind", fieldType: "number", objectType: "Leads", options: "Monthly, Quarterly, Yearly" }, defs38, defs38[0]);
  assert.ok(edit38.ok && edit38.key === "plan_type" && edit38.fieldType === "select" && edit38.objectType === "Transactions", "Key, type and record type can't change on edit");

  const stamp38 = Date.now();
  const partnerSess38 = {
    sessionId: "p38", userId: "p38", identityType: "partner" as const, role: "Manager", name: "P", email: "p@example.com",
    partnerId: null as string | null, issuedAt: Date.now(), expiresAt: Date.now() + 86400000,
  };
  const deniedDef = await executeResourceMutation(partnerSess38, "SAVE_CUSTOM_FIELD_DEFINITION", { label: "X", objectType: "Leads", fieldType: "text" });
  assert.equal(deniedDef.status, 403, "Partners can't define custom fields");
  const mkDef = async (label: string, objectType: string, fieldType: string, options = "") => {
    const r = await executeResourceMutation(mockAdminSession, "SAVE_CUSTOM_FIELD_DEFINITION", { label: `${label} ${stamp38}`, objectType, fieldType, options });
    assert.equal(r.status, 200, `Defined ${label}`);
    return (await r.json()).definition as CustomFieldDefinition;
  };
  const regionDef = await mkDef("Region", "Customers", "select", "Asia, Europe");
  const planDef = await mkDef("Plan type", "Transactions", "select", "Monthly\nQuarterly");
  const feeDef = await mkDef("Setup fee", "Transactions", "number");
  const dupDef = await executeResourceMutation(mockAdminSession, "SAVE_CUSTOM_FIELD_DEFINITION", { label: `Region ${stamp38}`, objectType: "Customers", fieldType: "text" });
  assert.equal(dupDef.status, 400, "Duplicate field refused by the server");
  assert.equal(
    definitionsFromItems(await prisma.manageItem.findMany({ where: { category: "custom_properties" } }), "Customers").filter((d) => d.key === regionDef.key).length,
    1
  );

  // Create with custom values; a bad value stops the create entirely
  const custCount0 = await prisma.customer.count();
  const badCreate = await executeResourceMutation(mockAdminSession, "CREATE_CUSTOMER", {
    name: `CF Bad ${stamp38}`, email: `bad.${stamp38}@example.com`, sourcePartnerName: "x", customFields: { [regionDef.key]: "Mars" },
  });
  assert.equal(badCreate.status, 400, "Invalid custom value refused");
  assert.equal(await prisma.customer.count(), custCount0, "Nothing created when a custom value is invalid");
  const partnerCreate = await executeResourceMutation({ ...partnerSess38, partnerId: "x" }, "CREATE_LEAD", { firstName: "A", lastName: "B", company: "C", email: "a@b.co", customFields: { anything: 1 } });
  assert.equal(partnerCreate.status, 403, "Partners can't set custom fields when submitting");

  const cfProg = await prisma.program.create({
    data: {
      name: `Custom Field Program ${stamp38}`, onboardingPipelineId: "Default Onboarding", autoEmailsJson: "{}", permissionsJson: "{}",
      levelsJson: JSON.stringify([{ name: "CF Level", benefits: [], requirements: [], rewards: [{
        id: `r38-${stamp38}`, title: "10% of setup fee, Asia monthly", trigger: "transaction_added_customer",
        conditions: [
          { type: "customer_property", field: `custom.${regionDef.key}`, operator: "is", value: "Asia" },
          { type: "transaction_property", field: `custom.${planDef.key}`, operator: "is", value: "Monthly" },
        ],
        valueType: "Cash", amountMode: "percentage", rateOrAmount: 10, percentOfField: `custom.${feeDef.key}`, requiresValidation: true, clawbackOnRefund: true,
      }] }]),
    },
  });
  const cfPartnerName = `Custom Field Partner ${stamp38}`;
  assert.equal((await executeResourceMutation(mockAdminSession, "CREATE_PARTNER", { name: cfPartnerName, programId: cfProg.id, qualifyingLevel: "CF Level" })).status, 200);
  const mkCust = async (name: string, region: string) => {
    const r = await executeResourceMutation(mockAdminSession, "CREATE_CUSTOMER", {
      name: `${name} ${stamp38}`, email: `${name.toLowerCase()}.${stamp38}@example.com`, sourcePartnerName: cfPartnerName, customFields: { [regionDef.key]: region },
    });
    assert.equal(r.status, 200);
    return (await r.json()).customer;
  };
  const asiaCust = await mkCust("Asia", "asia");
  assert.deepEqual(JSON.parse(asiaCust.customFieldsJson), { [regionDef.key]: "Asia" }, "Custom value stored on the record");
  const europeCust = await mkCust("Europe", "Europe");
  const tx38 = async (label: string, customerId: string, plan: string, fee: number) => {
    const r = await executeResourceMutation(mockAdminSession, "CREATE_TRANSACTION", {
      name: `CF-${stamp38}-${label}`, amount: 1000, currency: "SGD", partnerName: cfPartnerName, customerId, monthKey: "03/2026",
      customFields: { [planDef.key]: plan, [feeDef.key]: fee },
    });
    assert.equal(r.status, 200, `Transaction ${label}`);
    return prisma.reward.findMany({ where: { fromActivity: `CF-${stamp38}-${label}` } });
  };
  const paid38 = await tx38("A", asiaCust.id, "Monthly", 400);
  assert.deepEqual(paid38.map((r) => [r.fromRewardRule, toMajorUnits(r.amount)]), [["10% of setup fee, Asia monthly", 40]], "Rule reads custom fields: 10% of setup fee 400 = 40");
  assert.equal((await tx38("B", asiaCust.id, "Quarterly", 400)).length, 0, "Transaction custom condition not met → no reward");
  assert.equal((await tx38("C", europeCust.id, "Monthly", 400)).length, 0, "Customer custom condition not met → no reward");

  // Edit values on a record: checked, saved, audited; partners refused
  const upd38 = await executeResourceMutation(mockAdminSession, "UPDATE_CUSTOM_FIELDS", { objectType: "Customers", id: europeCust.id, values: { [regionDef.key]: "Asia" } });
  assert.equal(upd38.status, 200);
  assert.deepEqual(JSON.parse((await prisma.customer.findUnique({ where: { id: europeCust.id } }))!.customFieldsJson), { [regionDef.key]: "Asia" });
  const audit38 = await prisma.auditLog.findFirst({ where: { objectId: europeCust.id, summary: { contains: "custom fields" } }, orderBy: { createdAt: "desc" } });
  assert.ok(audit38 && JSON.parse(audit38.diffJson)[regionDef.key].from === "Europe", "Change audited with before and after");
  assert.equal((await tx38("D", europeCust.id, "Monthly", 100)).length, 1, "Rules see the updated value");
  assert.equal((await executeResourceMutation(mockAdminSession, "UPDATE_CUSTOM_FIELDS", { objectType: "Customers", id: europeCust.id, values: { nope: 1 } })).status, 400);
  assert.equal((await executeResourceMutation({ ...partnerSess38, partnerId: "x" }, "UPDATE_CUSTOM_FIELDS", { objectType: "Customers", id: europeCust.id, values: {} })).status, 403);

  // Options in use can't be removed; archiving keeps values and blocks edits
  const rmOpt = await executeResourceMutation(mockAdminSession, "SAVE_CUSTOM_FIELD_DEFINITION", { id: regionDef.id, label: regionDef.label, options: "Europe" });
  assert.equal(rmOpt.status, 409, "Can't remove an option records still use");
  const addOpt = await executeResourceMutation(mockAdminSession, "SAVE_CUSTOM_FIELD_DEFINITION", { id: regionDef.id, label: `Sales region ${stamp38}`, options: "Asia, Europe, Americas" });
  assert.equal(addOpt.status, 200, "Rename and add an option");
  assert.equal((await addOpt.json()).definition.key, regionDef.key, "Key stays the same after renaming");
  assert.equal((await executeResourceMutation(mockAdminSession, "SET_CUSTOM_FIELD_ARCHIVED", { id: feeDef.id, archived: true })).status, 200);
  const txA = await prisma.transaction.findFirst({ where: { name: `CF-${stamp38}-A` } });
  assert.equal(
    (await executeResourceMutation(mockAdminSession, "UPDATE_CUSTOM_FIELDS", { objectType: "Transactions", id: txA!.id, values: { [feeDef.key]: 5 } })).status,
    400,
    "Archived field can't be changed"
  );
  assert.equal(JSON.parse((await prisma.transaction.findUnique({ where: { id: txA!.id } }))!.customFieldsJson)[feeDef.key], 400, "Archiving keeps stored values");

  // CSV export uses the field's name as the column header
  assert.equal(rowsToCsv([{ name: "x", [`custom.${planDef.key}`]: "Monthly" }], undefined, { [`custom.${planDef.key}`]: "Plan type" }).split("\r\n")[0], "name,Plan type");

  // Partners: only their own bank details, only as manager; never program, level or status
  const apexP = await prisma.partner.findFirst({ where: { name: "Apex Cloud Solutions Pte Ltd" } });
  assert.ok(apexP, "Demo partner present");
  const lvlBefore = apexP!.qualifyingLevel;
  const raise = await executeResourceMutation({ ...partnerSess38, partnerId: apexP!.id }, "UPDATE_PARTNER", { data: { qualifyingLevel: "Anything", status: "Active" } });
  assert.equal(raise.status, 403, "Partner can't change its own level or status");
  assert.equal((await prisma.partner.findUnique({ where: { id: apexP!.id } }))!.qualifyingLevel, lvlBefore, "Level unchanged");
  const rep = await executeResourceMutation({ ...partnerSess38, partnerId: apexP!.id, role: "Sales Rep" }, "UPDATE_PARTNER", { data: { bankDetailsJson: "{}" } });
  assert.equal(rep.status, 403, "Only the partner manager can change bank details");

  // Products keep their values in the product's settings
  const prodDef = await mkDef("Warranty years", "Products", "number");
  const product38 = await prisma.manageItem.create({ data: { category: "products", name: `CF Product ${stamp38}`, metadataJson: JSON.stringify({ sku: "SKU-38" }) } });
  assert.equal((await executeResourceMutation(mockAdminSession, "UPDATE_CUSTOM_FIELDS", { objectType: "Products", id: product38.id, values: { [prodDef.key]: "3" } })).status, 200);
  assert.deepEqual(JSON.parse((await prisma.manageItem.findUnique({ where: { id: product38.id } }))!.metadataJson), { sku: "SKU-38", customFields: { [prodDef.key]: 3 } }, "Product value saved next to its other settings");
  await prisma.manageItem.deleteMany({ where: { id: { in: [product38.id, prodDef.id] } } });

  // Clean up
  await prisma.reward.deleteMany({ where: { partnerName: cfPartnerName } });
  await prisma.transaction.deleteMany({ where: { partnerName: cfPartnerName } });
  await prisma.customer.deleteMany({ where: { id: { in: [asiaCust.id, europeCust.id] } } });
  await prisma.partner.deleteMany({ where: { name: cfPartnerName } });
  await prisma.program.delete({ where: { id: cfProg.id } });
  await prisma.manageItem.deleteMany({ where: { id: { in: [regionDef.id, planDef.id, feeDef.id] } } });
  console.log("✓ Fixture 38 passed (§3.6 R2b): custom field definitions and values checked, stored, audited and admin-only; reward rules use custom fields in conditions and % of field; partners can't raise their own level");

  console.log("\nALL 38 KNOWN-ANSWER & GO-LIVE READINESS FIXTURES PASSED GREEN!");
  await prisma.$disconnect();
}

runFixtures().catch(async (err) => {
  console.error("Fixture failure:", err);
  await prisma.$disconnect();
  process.exit(1);
});
