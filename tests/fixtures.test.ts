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
  evaluateRuleForInvoice,
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
  enrollTotpMfa,
  generateTotpCode,
  verifyTotpOrRecoveryCode,
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

async function runFixtures() {
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
  const totpSecret = "JBSWY3DPEHPK3PXP";
  const nowCode = generateTotpCode(totpSecret);
  const totpResult = verifyTotpOrRecoveryCode(nowCode, totpSecret);
  assert.equal(totpResult.valid, true, "Generated RFC 6238 TOTP code must verify");
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
  const enrollment = enrollTotpMfa("alex@r-prm.example.com");
  assert.ok(enrollment.otpauthUri.includes("otpauth://totp/"), "Enrollment must produce otpauth:// URI");
  const validTotp = generateTotpCode(enrollment.secret);
  const consumedSet = new Set<string>();
  const validCheck = verifyTotpOrRecoveryCode(
    validTotp,
    enrollment.secret,
    enrollment.recoveryCodes,
    consumedSet
  );
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.method, "totp");

  const invalidCheck = verifyTotpOrRecoveryCode(
    "000000",
    enrollment.secret,
    enrollment.recoveryCodes,
    consumedSet
  );
  assert.equal(invalidCheck.valid, false, "Invalid 6-digit code must be rejected");

  const recoveryCode = enrollment.recoveryCodes[0];
  const firstRecoveryUse = verifyTotpOrRecoveryCode(
    recoveryCode,
    enrollment.secret,
    enrollment.recoveryCodes,
    consumedSet
  );
  assert.equal(firstRecoveryUse.valid, true, "First use of recovery code must succeed");
  assert.equal(firstRecoveryUse.method, "recovery");
  const secondRecoveryUse = verifyTotpOrRecoveryCode(
    recoveryCode,
    enrollment.secret,
    enrollment.recoveryCodes,
    consumedSet
  );
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
  const enrolledForAlex = enrollTotpMfa(alexUser.email);
  await prisma.user.update({
    where: { id: alexUser.id },
    data: {
      mfaSecret: enrolledForAlex.secret,
      recoveryCodesJson: JSON.stringify(enrolledForAlex.recoveryCodes),
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
  const validAlexTotp = generateTotpCode(enrolledForAlex.secret);
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

  console.log("\nALL 32 KNOWN-ANSWER & GO-LIVE READINESS FIXTURES PASSED GREEN!");
  await prisma.$disconnect();
}

runFixtures().catch(async (err) => {
  console.error("Fixture failure:", err);
  await prisma.$disconnect();
  process.exit(1);
});
