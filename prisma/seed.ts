import { PrismaClient } from "@prisma/client";
import {
  normalizeRewardRule,
  generateRandomLeadFormToken,
  DEFAULT_COMMISSION_TEMPLATES,
  toMinorUnits,
} from "../src/lib/prmEngine";
import { encryptBankDetails } from "../src/lib/connectors";
import { hashPasswordWithRandomSalt } from "../src/lib/authSession";
import { rewardsForEvent } from "../src/lib/rewardRules";
import { buildTransactionEvent } from "../src/lib/rewardGeneration";

const prisma = new PrismaClient();

export async function seedDatabase(options?: { forceReset?: boolean }) {
  // §3.2 & §16.3 G10: Demo seed refuses to run when NODE_ENV=production!
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FAIL_CLOSED: Demo seed script refuses to run when NODE_ENV=production"
    );
  }
  const adminPassword = (process.env.SEED_ADMIN_PASSWORD || "").trim();
  const partnerPassword = (process.env.SEED_PARTNER_PASSWORD || "").trim();
  if (!adminPassword || !partnerPassword) {
    throw new Error(
      "FAIL_CLOSED: SEED_ADMIN_PASSWORD and SEED_PARTNER_PASSWORD must be provided in .env"
    );
  }

  // §3.2 #4: Refuse to run when any non-demo data exists
  if (!options?.forceReset) {
    const nonDemoUsers = await prisma.user.count({
      where: { isTestAccount: false },
    });
    const nonDemoPartners = await prisma.partner.count({
      where: {
        NOT: {
          contactEmail: { endsWith: ".example.com" },
        },
      },
    });
    if (nonDemoUsers > 0 || nonDemoPartners > 0) {
      throw new Error(
        `FAIL_CLOSED: Demo seed refuses to run because non-demo data already exists (${nonDemoUsers} non-demo user(s), ${nonDemoPartners} non-demo partner(s)).`
      );
    }
  }

  // Clear existing data in safe order
  await prisma.session.deleteMany();
  await prisma.activationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.noteItem.deleteMany();
  await prisma.manageItem.deleteMany();
  await prisma.trackingLink.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.collaboration.deleteMany();
  await prisma.accountRecord.deleteMany();
  await prisma.businessPlan.deleteMany();
  await prisma.task.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.partnerTeamMember.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.program.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.auditLog.deleteMany();

  const defaultPermissions = JSON.stringify({
    Leads: {
      "Can view leads": { Manager: true, SalesRep: true, Stakeholder: true },
      "Can submit leads": { Manager: true, SalesRep: true, Stakeholder: false },
      "Can convert leads to deals": { Manager: true, SalesRep: true, Stakeholder: false },
    },
    Deals: {
      "Can view deals": { Manager: true, SalesRep: true, Stakeholder: true },
      "Can register deals": { Manager: true, SalesRep: true, Stakeholder: false },
      "Can update deals": { Manager: true, SalesRep: true, Stakeholder: false },
      "Can update deal stages": { Manager: true, SalesRep: false, Stakeholder: false },
      "Can request quote": { Manager: true, SalesRep: true, Stakeholder: false },
      "Can delete deals": { Manager: false, SalesRep: false, Stakeholder: false },
    },
    "Line items": {
      "Can view amounts & line items": { Manager: true, SalesRep: true, Stakeholder: false },
      "Can add/update line items": { Manager: true, SalesRep: false, Stakeholder: false },
    },
    Others: {
      "Can view customers": { Manager: true, SalesRep: true, Stakeholder: true },
      "Can manage account mapping": { Manager: true, SalesRep: false, Stakeholder: false },
    },
  });

  const defaultLevels = JSON.stringify(
    [
      {
        id: "lvl-silver",
        name: "Silver Tier",
        badgeColor: "slate",
        rewards: [
          normalizeRewardRule({
            id: "r1",
            title: "10% Recurring Deal Commission",
            trigger: "On every transaction from won deals",
            rate: "10%",
          }),
        ],
        benefits: [
          { id: "b1", title: "Co-branded Sales Collateral & Portal Access" },
          { id: "b2", title: "Standard Partner Directory Listing" },
        ],
        requirements: [
          { id: "req1", metric: "Minimum annual revenue", target: "SGD 10,000" },
          { id: "req2", metric: "Certified sales reps", target: "1 certified member" },
        ],
      },
      {
        id: "lvl-gold",
        name: "Gold Tier",
        badgeColor: "blue",
        rewards: [
          normalizeRewardRule({
            id: "r2",
            title: "18% Recurring Deal Commission",
            trigger: "On every transaction from won deals",
            rate: "18%",
          }),
          normalizeRewardRule({
            id: "r3",
            title: "SGD 500 Deal Registration Bonus",
            trigger: "On first Closed Won enterprise deal",
            rate: "SGD 500",
          }),
        ],
        benefits: [
          { id: "b3", title: "Dedicated Partner Account Manager (PAM)" },
          { id: "b4", title: "Joint Marketing Development Funds (MDF)" },
        ],
        requirements: [
          { id: "req3", metric: "Minimum annual revenue", target: "SGD 50,000" },
          { id: "req4", metric: "Certified sales reps", target: "3 certified members" },
        ],
      },
      {
        id: "lvl-platinum",
        name: "Platinum Elite",
        badgeColor: "indigo",
        rewards: [
          normalizeRewardRule({
            id: "r4",
            title: "25% Recurring Deal Commission",
            trigger: "On every transaction from won deals",
            rate: "25%",
          }),
          normalizeRewardRule({
            id: "r5",
            title: "5% Platinum Bonus on Every Transaction",
            trigger: "On every transaction",
            rate: "5%",
          }),
        ],
        benefits: [
          { id: "b5", title: "Executive Quarterly Business Reviews & Co-Selling Priority" },
          { id: "b6", title: "Featured Placement in Global Partner Directory" },
        ],
        requirements: [
          { id: "req5", metric: "Minimum annual revenue", target: "SGD 150,000" },
          { id: "req6", metric: "Registration fees", target: "Waived for Strategic Tier" },
        ],
      },
    ]
  );

  // Seed coworker User rows first so ownerId / assignedToId foreign keys are populated on demo records
  const coworkerUsers = [
    {
      email: "alex@r-prm.example.com",
      name: "Alex Morgan",
      role: "Administrator",
    },
    {
      email: "sarah@r-prm.example.com",
      name: "Sarah Jenkins",
      role: "Manager",
    },
    {
      email: "marcus@r-prm.example.com",
      name: "Marcus Vance",
      role: "Manager",
    },
  ];
  const userIdByName: Record<string, string> = {};
  for (const cw of coworkerUsers) {
    const createdCw = await prisma.user.create({
      data: {
        email: cw.email,
        name: cw.name,
        identityType: "coworker",
        role: cw.role,
        passwordHash: hashPasswordWithRandomSalt(adminPassword),
        status: "Active",
        isTestAccount: true,
      },
    });
    userIdByName[cw.name] = createdCw.id;
  }

  const prog1 = await prisma.program.create({
    data: {
      id: "prog-strategic",
      name: "R-Cloud Strategic Solution Partners",
      ownerId: userIdByName["Alex Morgan"],
      owner: "Alex Morgan",
      onboardingPipelineId: "Strategic Partner",
      levelsJson: defaultLevels,
      partnerCount: 4,
      pendingApplications: 2,
      submittedLeads365d: 34,
      registeredDeals365d: 21,
      sourcedRevenue365d: toMinorUnits(148500),
      influencedRev365d: toMinorUnits(92400),
      autoEmailsJson: JSON.stringify({
        acknowledgeSignup: true,
        notifyAccepted: true,
        notifyRejected: true,
      }),
      termsRequired: true,
      termsUrl: "https://r-prm.example.com/legal/partner-terms",
      revenueStrategy: "Sum of deals closed won",
      permissionsJson: defaultPermissions,
    },
  });

  const prog2 = await prisma.program.create({
    data: {
      id: "prog-referral",
      name: "Global Affiliate & Referral Network",
      ownerId: userIdByName["Sarah Jenkins"],
      owner: "Sarah Jenkins",
      onboardingPipelineId: "Fast-Track Referral",
      levelsJson: defaultLevels,
      partnerCount: 2,
      pendingApplications: 1,
      submittedLeads365d: 22,
      registeredDeals365d: 9,
      sourcedRevenue365d: toMinorUnits(64200),
      influencedRev365d: toMinorUnits(41000),
      autoEmailsJson: JSON.stringify({
        acknowledgeSignup: true,
        notifyAccepted: true,
        notifyRejected: false,
      }),
      termsRequired: true,
      termsUrl: "https://r-prm.example.com/legal/referral-terms",
      revenueStrategy: "Sum of paid customer transactions",
      permissionsJson: defaultPermissions,
    },
  });

  const prog3 = await prisma.program.create({
    data: {
      id: "prog-tech",
      name: "ISV & Technology Ecosystem Program",
      ownerId: userIdByName["Marcus Vance"],
      owner: "Marcus Vance",
      onboardingPipelineId: "Strategic Partner",
      levelsJson: defaultLevels,
      partnerCount: 2,
      pendingApplications: 0,
      submittedLeads365d: 14,
      registeredDeals365d: 11,
      sourcedRevenue365d: toMinorUnits(89000),
      influencedRev365d: toMinorUnits(134000),
      autoEmailsJson: JSON.stringify({
        acknowledgeSignup: true,
        notifyAccepted: true,
        notifyRejected: true,
      }),
      termsRequired: false,
      termsUrl: "https://r-prm.example.com/legal/isv-terms",
      revenueStrategy: "Sum of deals closed won",
      permissionsJson: defaultPermissions,
    },
  });

  // Partners (8 synthetic partners across stages/programs)
  const partnersData = [
    {
      id: "prt-1",
      name: "Apex Cloud Solutions Pte Ltd",
      owner: "Alex Morgan",
      groupName: "APAC Cloud Alliances",
      programId: prog1.id,
      programName: prog1.name,
      qualifyingLevel: "Platinum Elite",
      status: "Active",
      onboardingStatus: "Completed",
      onboardingPipeline: "Strategic Partner",
      onboardingStage: "Completed",
      prospectionStage: "Active",
      partnerType: "Reseller",
      country: "Singapore",
      language: "English",
      currency: "SGD",
      activeSince: "2026-01-12",
      submittedLeads365d: 16,
      registeredDeals365d: 11,
      pendingRewardsAll: 4250,
      sourcedRevenue365d: 84500,
      influencedRev365d: 52000,
      contactFirstName: "Jordan",
      contactLastName: "Lee",
      contactEmail: "jordan.lee@apexcloud.example.com",
      contactJobTitle: "VP of Strategic Alliances",
      contactPhone: "+65 6812 9001",
    },
    {
      id: "prt-2",
      name: "NovaBridge Digital Systems",
      owner: "Sarah Jenkins",
      groupName: "APAC Cloud Alliances",
      programId: prog1.id,
      programName: prog1.name,
      qualifyingLevel: "Gold Tier",
      status: "Active",
      onboardingStatus: "Completed",
      onboardingPipeline: "Strategic Partner",
      onboardingStage: "Completed",
      prospectionStage: "Active",
      partnerType: "System Integrator",
      country: "Singapore",
      language: "English",
      currency: "SGD",
      activeSince: "2026-02-20",
      submittedLeads365d: 12,
      registeredDeals365d: 8,
      pendingRewardsAll: 2890,
      sourcedRevenue365d: 64000,
      influencedRev365d: 40400,
      contactFirstName: "Mei",
      contactLastName: "Tan",
      contactEmail: "mei.tan@novabridge.example.com",
      contactJobTitle: "Partner Director",
      contactPhone: "+65 6774 3310",
    },
    {
      id: "prt-3",
      name: "BluePeak Commerce Advisory",
      owner: "Alex Morgan",
      groupName: "Global Growth Agencies",
      programId: prog2.id,
      programName: prog2.name,
      qualifyingLevel: "Gold Tier",
      status: "Active",
      onboardingStatus: "Completed",
      onboardingPipeline: "Strategic Partner",
      onboardingStage: "Completed",
      prospectionStage: "Active",
      partnerType: "Referral Agency",
      country: "Australia",
      language: "English",
      currency: "USD",
      activeSince: "2026-03-08",
      submittedLeads365d: 14,
      registeredDeals365d: 6,
      pendingRewardsAll: 1940,
      sourcedRevenue365d: 46200,
      influencedRev365d: 28000,
      contactFirstName: "Liam",
      contactLastName: "O'Connor",
      contactEmail: "liam@bluepeak.example.com",
      contactJobTitle: "Managing Partner",
      contactPhone: "+61 2 8004 1192",
    },
    {
      id: "prt-4",
      name: "Synthetix POS & Retail Tech",
      owner: "Marcus Vance",
      groupName: "ISV Ecosystem",
      programId: prog3.id,
      programName: prog3.name,
      qualifyingLevel: "Platinum Elite",
      status: "Active",
      onboardingStatus: "Completed",
      onboardingPipeline: "Strategic Partner",
      onboardingStage: "Completed",
      prospectionStage: "Active",
      partnerType: "Technology Partner",
      country: "Malaysia",
      language: "English",
      currency: "MYR",
      activeSince: "2026-04-01",
      submittedLeads365d: 9,
      registeredDeals365d: 7,
      pendingRewardsAll: 1620,
      sourcedRevenue365d: 58000,
      influencedRev365d: 89000,
      contactFirstName: "Aisha",
      contactLastName: "Rahman",
      contactEmail: "aisha@synthetix.example.com",
      contactJobTitle: "Head of Partnerships",
      contactPhone: "+60 3 2788 4500",
    },
    {
      id: "prt-5",
      name: "Vanguard Enterprise Matrix",
      owner: "Alex Morgan",
      groupName: "APAC Cloud Alliances",
      programId: prog1.id,
      programName: prog1.name,
      qualifyingLevel: "Silver Tier",
      status: "Onboarding",
      onboardingStatus: "In progress",
      onboardingPipeline: "Strategic Partner",
      onboardingStage: "Book a Demo Account Training",
      prospectionStage: "Onboarding",
      partnerType: "Reseller",
      country: "United Kingdom",
      language: "English",
      currency: "EUR",
      activeSince: "2026-10-05",
      submittedLeads365d: 4,
      registeredDeals365d: 2,
      pendingRewardsAll: 540,
      sourcedRevenue365d: 18000,
      influencedRev365d: 12000,
      contactFirstName: "Oliver",
      contactLastName: "Bennett",
      contactEmail: "oliver@vanguardmatrix.example.com",
      contactJobTitle: "Channel Lead",
      contactPhone: "+44 20 7946 0823",
    },
    {
      id: "prt-6",
      name: "Stratos FinTech Integrations",
      owner: "Sarah Jenkins",
      groupName: "ISV Ecosystem",
      programId: prog3.id,
      programName: prog3.name,
      qualifyingLevel: "Gold Tier",
      status: "Active",
      onboardingStatus: "In progress",
      onboardingPipeline: "Strategic Partner",
      onboardingStage: "Technical Certification",
      prospectionStage: "Onboarding",
      partnerType: "Technology Partner",
      country: "Singapore",
      language: "English",
      currency: "SGD",
      activeSince: "2026-09-14",
      submittedLeads365d: 5,
      registeredDeals365d: 4,
      pendingRewardsAll: 980,
      sourcedRevenue365d: 31000,
      influencedRev365d: 45000,
      contactFirstName: "Chloe",
      contactLastName: "Goh",
      contactEmail: "chloe@stratosfintech.example.com",
      contactJobTitle: "Alliances Manager",
      contactPhone: "+65 6909 7721",
    },
    {
      id: "prt-7",
      name: "Meridian Growth Guild",
      owner: "Alex Morgan",
      groupName: "Global Growth Agencies",
      programId: prog2.id,
      programName: prog2.name,
      qualifyingLevel: "Silver Tier",
      status: "Pending",
      onboardingStatus: "Not started",
      onboardingPipeline: "Strategic Partner",
      onboardingStage: "Kickoff Welcome Call",
      prospectionStage: "New",
      partnerType: "Referral Agency",
      country: "United States",
      language: "English",
      currency: "USD",
      activeSince: "2026-11-18",
      submittedLeads365d: 0,
      registeredDeals365d: 0,
      pendingRewardsAll: 0,
      sourcedRevenue365d: 0,
      influencedRev365d: 0,
      contactFirstName: "Elena",
      contactLastName: "Rostova",
      contactEmail: "elena@meridianguild.example.com",
      contactJobTitle: "Founder & CEO",
      contactPhone: "+1 415 890 2231",
    },
    {
      id: "prt-8",
      name: "Horizon Retail Accelerator",
      owner: "Marcus Vance",
      groupName: "APAC Cloud Alliances",
      programId: prog1.id,
      programName: prog1.name,
      qualifyingLevel: "Silver Tier",
      status: "Pending",
      onboardingStatus: "Not started",
      onboardingPipeline: "Strategic Partner",
      onboardingStage: "Kickoff Welcome Call",
      prospectionStage: "New",
      partnerType: "Reseller",
      country: "Japan",
      language: "English",
      currency: "USD",
      activeSince: "2026-11-20",
      submittedLeads365d: 2,
      registeredDeals365d: 0,
      pendingRewardsAll: 0,
      sourcedRevenue365d: 0,
      influencedRev365d: 15000,
      contactFirstName: "Kenji",
      contactLastName: "Takahashi",
      contactEmail: "kenji@horizonretail.example.com",
      contactJobTitle: "Director of BD",
      contactPhone: "+81 3 5550 1920",
    },
  ];

  for (const p of partnersData) {
    const lf = generateRandomLeadFormToken();
    await prisma.partner.create({
      data: {
        ...p,
        ownerId: userIdByName[p.owner] || null,
        portalAccess: p.status === "Active" || p.status === "Onboarding",
        pendingRewardsAll: toMinorUnits(p.pendingRewardsAll),
        sourcedRevenue365d: toMinorUnits(p.sourcedRevenue365d),
        influencedRev365d: toMinorUnits(p.influencedRev365d),
        leadFormTokenHash: lf.tokenHash,
        leadFormTokenCipher: encryptBankDetails(lf.rawToken),
        bankDetailsJson: encryptBankDetails(
          JSON.stringify({
            bankName: "DBS Corporate Bank Singapore",
            swiftCode: "DBSSSGSG",
            accountNumber: "003-948271-8",
            beneficiaryName: p.name,
            taxId: "SG-202699182K",
          })
        ),
      },
    });
  }

  // Partner Team Members
  await prisma.partnerTeamMember.createMany({
    data: [
      { name: "Jordan Lee", email: "jordan.lee@apexcloud.example.com", jobTitle: "VP of Strategic Alliances", phone: "+65 6812 9001", partnerName: "Apex Cloud Solutions Pte Ltd", role: "Manager", status: "Active", invitedAt: "2026-01-12" },
      { name: "Darren Koh", email: "darren.koh@apexcloud.example.com", jobTitle: "Senior Solutions Rep", phone: "+65 6812 9044", partnerName: "Apex Cloud Solutions Pte Ltd", role: "Sales Rep", status: "Active", invitedAt: "2026-02-01" },
      { name: "Mei Tan", email: "mei.tan@novabridge.example.com", jobTitle: "Partner Director", phone: "+65 6774 3310", partnerName: "NovaBridge Digital Systems", role: "Manager", status: "Active", invitedAt: "2026-02-20" },
      { name: "Lucas Wright", email: "lucas@bluepeak.example.com", jobTitle: "Account Executive", phone: "+61 2 8004 1199", partnerName: "BluePeak Commerce Advisory", role: "Sales Rep", status: "Pending", invitedAt: "2026-11-15" },
      { name: "Sophia Lin", email: "sophia@vanguardmatrix.example.com", jobTitle: "Technical Consultant", phone: "+44 20 7946 0899", partnerName: "Vanguard Enterprise Matrix", role: "Stakeholder", status: "Sent", invitedAt: "2026-11-21" },
    ],
  });

  // Leads (10 leads including current month & various statuses)
  const leadsData = [
    {
      id: "lead-1",
      firstName: "Claire",
      lastName: "Winslow",
      company: "Aura Luxury Hospitality Group",
      jobTitle: "Chief Digital Officer",
      email: "c.winslow@auraluxury.example.com",
      phone: "+65 9811 2201",
      country: "Singapore",
      retailBrand: "Aura Hotels & Spas",
      outletsCount: 14,
      posSolution: "Oracle Micros",
      remarks: "Seeking unified VIP loyalty & partner referral tracking across 14 APAC properties.",
      status: "Accepted",
      owner: "Alex Morgan",
      source: "Partner Portal",
      sourcePartnerId: "prt-1",
      sourcePartnerName: "Apex Cloud Solutions Pte Ltd",
      assignedPartner: "Apex Cloud Solutions Pte Ltd",
      assignedContact: "Jordan Lee",
      assignedDate: "2026-11-05",
      acceptedBy: "Alex Morgan",
      acceptedDate: "2026-11-06",
      deadline: "2026-12-20",
    },
    {
      id: "lead-2",
      firstName: "Haruto",
      lastName: "Sato",
      company: "Kaze Roastery & Artisanal Cafes",
      jobTitle: "Head of Retail Ops",
      email: "haruto@kazeroastery.example.com",
      phone: "+65 8122 4901",
      country: "Singapore",
      retailBrand: "Kaze Coffee",
      outletsCount: 9,
      posSolution: "Synthetix POS",
      remarks: "Evaluating omnichannel member rewards integration.",
      status: "Accepted",
      owner: "Sarah Jenkins",
      source: "Partner Portal",
      sourcePartnerId: "prt-2",
      sourcePartnerName: "NovaBridge Digital Systems",
      assignedPartner: "NovaBridge Digital Systems",
      assignedContact: "Mei Tan",
      assignedDate: "2026-11-10",
      acceptedBy: "Sarah Jenkins",
      acceptedDate: "2026-11-11",
      deadline: "2026-12-18",
    },
    {
      id: "lead-3",
      firstName: "Nadia",
      lastName: "Khoury",
      company: "Velvet & Vine Boutique Retail",
      jobTitle: "VP of Marketing",
      email: "nadia@velvetvine.example.com",
      phone: "+61 412 889 301",
      country: "Australia",
      retailBrand: "Velvet & Vine",
      outletsCount: 22,
      posSolution: "Shopify POS",
      remarks: "Need tiered membership & automated birthday campaigns.",
      status: "Pending",
      owner: "Alex Morgan",
      source: "Partner Portal",
      sourcePartnerId: "prt-3",
      sourcePartnerName: "BluePeak Commerce Advisory",
      assignedPartner: "BluePeak Commerce Advisory",
      assignedContact: "Liam O'Connor",
      assignedDate: "2026-11-19",
      acceptedBy: "",
      acceptedDate: "",
      deadline: "2026-12-30",
    },
    {
      id: "lead-4",
      firstName: "Benjamin",
      lastName: "Chong",
      company: "Zenith Activewear APAC",
      jobTitle: "Director of E-Commerce",
      email: "b.chong@zenithactive.example.com",
      phone: "+60 12 349 8821",
      country: "Malaysia",
      retailBrand: "Zenith Athletics",
      outletsCount: 31,
      posSolution: "Synthetix POS",
      remarks: "High-volume retail chain migrating from legacy loyalty platform.",
      status: "Accepted",
      owner: "Marcus Vance",
      source: "Shared",
      sourcePartnerId: "prt-4",
      sourcePartnerName: "Synthetix POS & Retail Tech",
      assignedPartner: "Synthetix POS & Retail Tech",
      assignedContact: "Aisha Rahman",
      assignedDate: "2026-11-12",
      acceptedBy: "Aisha Rahman",
      acceptedDate: "2026-11-13",
      deadline: "2026-12-22",
    },
    {
      id: "lead-5",
      firstName: "Evelyn",
      lastName: "Mercer",
      company: "Lumiere Aesthetics & Wellness",
      jobTitle: "COO",
      email: "evelyn@lumierewellness.example.com",
      phone: "+65 9334 7100",
      country: "Singapore",
      retailBrand: "Lumiere Clinics",
      outletsCount: 6,
      posSolution: "Zenoti",
      remarks: "Shared lead for partner-assisted implementation.",
      status: "Pending",
      owner: "Sarah Jenkins",
      source: "Shared",
      sourcePartnerId: "prt-1",
      sourcePartnerName: "Apex Cloud Solutions Pte Ltd",
      assignedPartner: "Apex Cloud Solutions Pte Ltd",
      assignedContact: "Jordan Lee",
      assignedDate: "2026-11-21",
      acceptedBy: "",
      acceptedDate: "",
      deadline: "2027-01-10",
    },
    {
      id: "lead-6",
      firstName: "Victor",
      lastName: "Alvarez",
      company: "Solstice Gourmet Grocers",
      jobTitle: "IT Director",
      email: "valvarez@solsticegrocers.example.com",
      phone: "+65 6449 2019",
      country: "Singapore",
      retailBrand: "Solstice Market",
      outletsCount: 18,
      posSolution: "CloudPOS Pro",
      remarks: "Full loyalty + POS webhook integration across 18 supermarkets.",
      status: "Accepted",
      owner: "Alex Morgan",
      source: "Partner Portal",
      sourcePartnerId: "prt-6",
      sourcePartnerName: "Stratos FinTech Integrations",
      assignedPartner: "Stratos FinTech Integrations",
      assignedContact: "Chloe Goh",
      assignedDate: "2026-10-28",
      acceptedBy: "Alex Morgan",
      acceptedDate: "2026-10-29",
      deadline: "2026-12-05",
    },
  ];

  for (const l of leadsData) {
    await prisma.lead.create({
      data: {
        ...l,
        ownerId: userIdByName[l.owner] || null,
      },
    });
  }

  // Deals across the 10 Kanban stages
  const dealsData = [
    {
      id: "deal-1",
      name: "ENT - Solaris Luxury Resort Group (Annual)",
      owner: "Alex Morgan",
      clientName: "Claire Winslow",
      company: "Solaris Luxury Resort Group",
      amount: 28500,
      currency: "SGD",
      amountSgd: 28500,
      partnerName: "Apex Cloud Solutions Pte Ltd",
      partnerId: "prt-1",
      assignedContact: "Jordan Lee",
      status: "Accepted",
      stage: "Closed Won",
      stageEnteredAt: "2026-11-02",
      source: "Partner Registration",
      sourcePartnerName: "Apex Cloud Solutions Pte Ltd",
      closeDate: "2026-11-02",
      expirationDate: "2027-11-02",
      programName: prog1.name,
      dealType: "New Business",
      subscriptionPlan: "Enterprise Multi-Region",
    },
    {
      id: "deal-2",
      name: "ENT - UrbanPulse Fitness Clubs APAC",
      owner: "Sarah Jenkins",
      clientName: "Daniel Lim",
      company: "UrbanPulse Holdings",
      amount: 19200,
      currency: "SGD",
      amountSgd: 19200,
      partnerName: "NovaBridge Digital Systems",
      partnerId: "prt-2",
      assignedContact: "Mei Tan",
      status: "Accepted",
      stage: "Closed Won",
      stageEnteredAt: "2026-10-24",
      source: "Partner Registration",
      sourcePartnerName: "NovaBridge Digital Systems",
      closeDate: "2026-10-24",
      expirationDate: "2027-10-24",
      programName: prog1.name,
      dealType: "New Business",
      subscriptionPlan: "Enterprise Annual",
    },
    {
      id: "deal-3",
      name: "MM - Artisan Bakers Collective (15 Outlets)",
      owner: "Alex Morgan",
      clientName: "Hannah Abbott",
      company: "Artisan Bakers Collective",
      amount: 12000,
      currency: "USD",
      amountSgd: 16200,
      partnerName: "BluePeak Commerce Advisory",
      partnerId: "prt-3",
      assignedContact: "Liam O'Connor",
      status: "Accepted",
      stage: "Closing Stage",
      stageEnteredAt: "2026-11-18",
      source: "Partner Registration",
      sourcePartnerName: "BluePeak Commerce Advisory",
      closeDate: "2026-12-05",
      expirationDate: "2027-03-05",
      programName: prog2.name,
      dealType: "New Business",
      subscriptionPlan: "Growth Pro Annual",
    },
    {
      id: "deal-4",
      name: "POS - Nectar Tearooms Regional Expansion",
      owner: "Marcus Vance",
      clientName: "Zackary Lau",
      company: "Nectar F&B Group",
      amount: 42000,
      currency: "MYR",
      amountSgd: 12600,
      partnerName: "Synthetix POS & Retail Tech",
      partnerId: "prt-4",
      assignedContact: "Aisha Rahman",
      status: "Accepted",
      stage: "Negotiation Stage",
      stageEnteredAt: "2026-11-14",
      source: "Lead Conversion",
      sourcePartnerName: "Synthetix POS & Retail Tech",
      closeDate: "2026-12-12",
      expirationDate: "2027-02-12",
      programName: prog3.name,
      dealType: "New Business",
      subscriptionPlan: "Growth Pro Annual",
    },
    {
      id: "deal-5",
      name: "ENT - Vertex Department Stores Omnichannel",
      owner: "Alex Morgan",
      clientName: "Grace Ho",
      company: "Vertex Retail Corp",
      amount: 36000,
      currency: "SGD",
      amountSgd: 36000,
      partnerName: "Apex Cloud Solutions Pte Ltd",
      partnerId: "prt-1",
      assignedContact: "Jordan Lee",
      status: "Accepted",
      stage: "Quotation Stage",
      stageEnteredAt: "2026-11-16",
      source: "Partner Registration",
      sourcePartnerName: "Apex Cloud Solutions Pte Ltd",
      closeDate: "2026-12-28",
      expirationDate: "2027-03-28",
      programName: prog1.name,
      dealType: "Expansion",
      subscriptionPlan: "Enterprise Multi-Region",
    },
    {
      id: "deal-6",
      name: "MM - Botanica Skincare Flagship Chain",
      owner: "Sarah Jenkins",
      clientName: "Rachel Teo",
      company: "Botanica Labs Pte Ltd",
      amount: 14500,
      currency: "SGD",
      amountSgd: 14500,
      partnerName: "Stratos FinTech Integrations",
      partnerId: "prt-6",
      assignedContact: "Chloe Goh",
      status: "Accepted",
      stage: "Presentation Stage",
      stageEnteredAt: "2026-11-19",
      source: "Partner Registration",
      sourcePartnerName: "Stratos FinTech Integrations",
      closeDate: "2027-01-15",
      expirationDate: "2027-04-15",
      programName: prog3.name,
      dealType: "New Business",
      subscriptionPlan: "Growth Pro Annual",
    },
    {
      id: "deal-7",
      name: "MM - Nordic Home Furnishings UK",
      owner: "Alex Morgan",
      clientName: "Arthur Pendelton",
      company: "Nordic Home Ltd",
      amount: 11000,
      currency: "EUR",
      amountSgd: 15950,
      partnerName: "Vanguard Enterprise Matrix",
      partnerId: "prt-5",
      assignedContact: "Oliver Bennett",
      status: "Pending",
      stage: "Discovery Stage",
      stageEnteredAt: "2026-11-21",
      source: "Partner Registration",
      sourcePartnerName: "Vanguard Enterprise Matrix",
      closeDate: "2027-01-30",
      expirationDate: "2027-04-30",
      programName: prog1.name,
      dealType: "New Business",
      subscriptionPlan: "Growth Pro Annual",
    },
    {
      id: "deal-8",
      name: "SMB - Metro Optical Boutiques",
      owner: "Sarah Jenkins",
      clientName: "Kevin Yap",
      company: "Metro Vision Group",
      amount: 8400,
      currency: "SGD",
      amountSgd: 8400,
      partnerName: "NovaBridge Digital Systems",
      partnerId: "prt-2",
      assignedContact: "Mei Tan",
      status: "Accepted",
      stage: "Appointment Scheduled",
      stageEnteredAt: "2026-11-22",
      source: "Partner Registration",
      sourcePartnerName: "NovaBridge Digital Systems",
      closeDate: "2027-02-10",
      expirationDate: "2027-05-10",
      programName: prog1.name,
      dealType: "New Business",
      subscriptionPlan: "Starter Annual",
    },
    {
      id: "deal-9",
      name: "SMB - Pacific Surf & Apparel",
      owner: "Marcus Vance",
      clientName: "Toby Mitchell",
      company: "Pacific Surf Co",
      amount: 6800,
      currency: "USD",
      amountSgd: 9180,
      partnerName: "BluePeak Commerce Advisory",
      partnerId: "prt-3",
      assignedContact: "Liam O'Connor",
      status: "Pending",
      stage: "To Work On",
      stageEnteredAt: "2026-11-23",
      source: "Partner Registration",
      sourcePartnerName: "BluePeak Commerce Advisory",
      closeDate: "2027-02-15",
      expirationDate: "2027-05-15",
      programName: prog2.name,
      dealType: "New Business",
      subscriptionPlan: "Starter Annual",
    },
    {
      id: "deal-10",
      name: "MM - Heritage Watchmakers Guild",
      owner: "Alex Morgan",
      clientName: "forrest Gump",
      company: "Heritage Timepieces",
      amount: 15000,
      currency: "SGD",
      amountSgd: 15000,
      partnerName: "Apex Cloud Solutions Pte Ltd",
      partnerId: "prt-1",
      assignedContact: "Jordan Lee",
      status: "Accepted",
      stage: "Closed Lost",
      stageEnteredAt: "2026-10-10",
      source: "Partner Registration",
      sourcePartnerName: "Apex Cloud Solutions Pte Ltd",
      closeDate: "2026-10-10",
      expirationDate: "2026-12-31",
      programName: prog1.name,
      dealType: "New Business",
      subscriptionPlan: "Enterprise Annual",
    },
  ];

  for (const d of dealsData) {
    const { amountSgd, ...dealRest } = d;
    await prisma.deal.create({
      data: {
        ...dealRest,
        ownerId: userIdByName[d.owner] || null,
        amount: toMinorUnits(d.amount),
        amountBase: toMinorUnits(amountSgd),
        lineItemsJson: JSON.stringify([
          { id: "li-1", product: "R-PRM Core Platform License", qty: 1, unitPrice: d.amount * 0.8, total: d.amount * 0.8 },
          { id: "li-2", product: "Dedicated Onboarding & API Integration", qty: 1, unitPrice: d.amount * 0.2, total: d.amount * 0.2 },
        ]),
      },
    });
  }

  // Customers (revenuesBase stored in minor units / cents)
  await prisma.customer.createMany({
    data: [
      { id: "cust-1", name: "Solaris Luxury Resort Group", email: "billing@solarisresorts.example.com", status: "Paying", source: "Deal Conversion", sourcePartnerName: "Apex Cloud Solutions Pte Ltd", becamePayingDate: "2026-11-02", bbid: "BB-2041", sourceDealId: "deal-1", subscriptionPlan: "Enterprise Multi-Region", billingFrequency: "Yearly", billingPeriod: "12 Months", transactionsCount: 3, revenuesBase: toMinorUnits(28500) },
      { id: "cust-2", name: "UrbanPulse Holdings", email: "finance@urbanpulse.example.com", status: "Paying", source: "Deal Conversion", sourcePartnerName: "NovaBridge Digital Systems", becamePayingDate: "2026-10-24", bbid: "BB-2042", sourceDealId: "deal-2", subscriptionPlan: "Enterprise Annual", billingFrequency: "Yearly", billingPeriod: "12 Months", transactionsCount: 2, revenuesBase: toMinorUnits(19200) },
      { id: "cust-3", name: "Emerald Bay Retail Group", email: "ap@emeraldbay.example.com", status: "Paying", source: "Inbound Referral Link", sourcePartnerName: "BluePeak Commerce Advisory", becamePayingDate: "2026-08-15", bbid: "BB-1988", sourceDealId: "deal-3", subscriptionPlan: "Growth Pro Annual", billingFrequency: "Quarterly", billingPeriod: "3 Months", transactionsCount: 4, revenuesBase: toMinorUnits(16400) },
      { id: "cust-4", name: "Kuala Lumpur Gourmet Group", email: "accounts@klgourmet.example.com", status: "Paying", source: "Deal Conversion", sourcePartnerName: "Synthetix POS & Retail Tech", becamePayingDate: "2026-07-01", bbid: "BB-1950", sourceDealId: "deal-4", subscriptionPlan: "Growth Pro Annual", billingFrequency: "Yearly", billingPeriod: "12 Months", transactionsCount: 2, revenuesBase: toMinorUnits(12600) },
      { id: "cust-5", name: "Caspian Logistics & Retail", email: "billing@caspian.example.com", status: "Canceled", source: "Partner Registration", sourcePartnerName: "Stratos FinTech Integrations", becamePayingDate: "2026-03-10", canceledDate: "2026-10-01", bbid: "BB-1812", sourceDealId: "", subscriptionPlan: "Starter Monthly", billingFrequency: "Monthly", billingPeriod: "1 Month", transactionsCount: 6, revenuesBase: toMinorUnits(5400) },
    ],
  });

  // Transactions across recent months for 12-month stacked bar chart (stored in minor units / cents)
  await prisma.transaction.createMany({
    data: [
      { id: "tx-1", name: "INV-2026-901 · Solaris Annual License", amount: toMinorUnits(28500), currency: "SGD", amountBase: toMinorUnits(28500), partnerName: "Apex Cloud Solutions Pte Ltd", customerName: "Solaris Luxury Resort Group", dealName: "ENT - Solaris Luxury Resort Group (Annual)", monthKey: "11/2026" },
      { id: "tx-2", name: "INV-2026-884 · UrbanPulse Annual Subscription", amount: toMinorUnits(19200), currency: "SGD", amountBase: toMinorUnits(19200), partnerName: "NovaBridge Digital Systems", customerName: "UrbanPulse Holdings", dealName: "ENT - UrbanPulse Fitness Clubs APAC", monthKey: "10/2026" },
      { id: "tx-3", name: "INV-2026-842 · Emerald Bay Q4 Renewal", amount: toMinorUnits(6000), currency: "USD", amountBase: toMinorUnits(8100), partnerName: "BluePeak Commerce Advisory", customerName: "Emerald Bay Retail Group", dealName: "MM - Artisan Bakers Collective (15 Outlets)", monthKey: "09/2026" },
      { id: "tx-4", name: "INV-2026-790 · KL Gourmet POS Suite", amount: toMinorUnits(42000), currency: "MYR", amountBase: toMinorUnits(12600), partnerName: "Synthetix POS & Retail Tech", customerName: "Kuala Lumpur Gourmet Group", dealName: "POS - Nectar Tearooms Regional Expansion", monthKey: "08/2026" },
      { id: "tx-5", name: "INV-2026-731 · Emerald Bay Q3 Subscription", amount: toMinorUnits(6150), currency: "USD", amountBase: toMinorUnits(8300), partnerName: "BluePeak Commerce Advisory", customerName: "Emerald Bay Retail Group", dealName: "MM - Artisan Bakers Collective (15 Outlets)", monthKey: "07/2026" },
      { id: "tx-6", name: "INV-2026-688 · Stratos FinTech Add-on Pack", amount: toMinorUnits(5400), currency: "SGD", amountBase: toMinorUnits(5400), partnerName: "Stratos FinTech Integrations", customerName: "Caspian Logistics & Retail", dealName: "MM - Botanica Skincare Flagship Chain", monthKey: "06/2026" },
    ],
  });

  // Generate rewards directly from each Partner's actual Program Level rules
  // Create Payouts first, then link Rewards via real `payoutId` foreign key and compute Payout amounts from linked rewards!
  await prisma.payout.createMany({
    data: [
      {
        id: "pay-1",
        payoutNumber: "PO-2026-04",
        name: "November 2026 Partner Settlement — Synthetix",
        partnerName: "Synthetix POS & Retail Tech",
        amount: toMinorUnits(3780),
        currency: "SGD",
        amountBase: toMinorUnits(3780),
        periodFrom: "2026-08-01",
        periodTo: "2026-11-15",
        rewardsCount: 2,
        status: "Ready",
        invoiceRef: "INV-SYN-884",
        paidDate: "",
      },
      {
        id: "pay-2",
        payoutNumber: "PO-2026-03",
        name: "Q3 Partner Settlement — Stratos FinTech",
        partnerName: "Stratos FinTech Integrations",
        amount: toMinorUnits(972),
        currency: "SGD",
        amountBase: toMinorUnits(972),
        periodFrom: "2026-06-01",
        periodTo: "2026-09-30",
        rewardsCount: 1,
        status: "Paid",
        invoiceRef: "INV-STR-309",
        paidDate: "2026-10-05",
      },
    ],
  });

  const [seededPrograms, seededPartners, seededTransactions] = await Promise.all([
    prisma.program.findMany(),
    prisma.partner.findMany(),
    prisma.transaction.findMany({ orderBy: { id: "asc" } }),
  ]);

  // Link seeded transactions to their customer records (same rule the app uses)
  await prisma.$executeRawUnsafe(
    `UPDATE "Transaction" t SET "customerId" = c."id" FROM "Customer" c WHERE t."customerId" IS NULL AND lower(trim(t."customerName")) = lower(trim(c."name")) AND trim(t."customerName") <> ''`
  );

  let seq = 1041;
  for (const tx of seededTransactions) {
    const partner = seededPartners.find((p) => p.name === tx.partnerName);
    if (!partner) continue;
    const event = await buildTransactionEvent(tx.id);
    if (!event) continue;
    const generated = rewardsForEvent(partner, seededPrograms, event, undefined, "SGD");
    for (const g of generated) {
      const rewardNumber = `RW-${seq--}`;
      const isPaidTx = tx.id === "tx-6";
      const isBatchReadyTx = tx.id === "tx-4";
      await prisma.reward.create({
        data: {
          rewardNumber,
          partnerName: g.partnerName,
          recipientName: g.partnerName,
          type: g.valueType,
          amount: g.amountMinor,
          currency: g.currency,
          amountBase: g.amountBaseMinor,
          fromActivity: g.fromActivity,
          fromRewardRule: g.ruleTitle,
          sourceKey: `${g.ruleId}::${tx.id}`,
          status: isPaidTx ? "Paid" : isBatchReadyTx ? "Accepted" : "Pending",
          payoutNumber: isPaidTx
            ? "PO-2026-03"
            : isBatchReadyTx
            ? "PO-2026-04"
            : "",
          payoutId: isPaidTx ? "pay-2" : isBatchReadyTx ? "pay-1" : null,
          comment: `Rule "${g.ruleTitle}" · FX ${g.fxRate} (${g.fxRateDate})`,
        },
      });
    }
  }
  // New rewards continue numbering after the seeded ones
  await prisma.$queryRawUnsafe(
    `SELECT setval('"reward_number_seq"', GREATEST(1000, COALESCE((SELECT MAX(NULLIF(regexp_replace("rewardNumber", '[^0-9]', '', 'g'), '')::BIGINT) FROM "Reward"), 0)))::text AS n`
  );

  // Partner Users (Main Contacts + PartnerTeamMembers)
  for (const p of seededPartners) {
    await prisma.user.upsert({
      where: { email: p.contactEmail.toLowerCase() },
      update: {},
      create: {
        email: p.contactEmail.toLowerCase(),
        name: `${p.contactFirstName} ${p.contactLastName}`,
        identityType: "partner",
        role: "Manager",
        partnerId: p.id,
        partnerName: p.name,
        isMainContact: true,
        passwordHash: hashPasswordWithRandomSalt(partnerPassword),
        status: p.portalAccess ? "Active" : "Pending",
        isTestAccount: true,
      },
    });
  }

  const allTeamMembers = await prisma.partnerTeamMember.findMany();
  for (const tm of allTeamMembers) {
    const linkedPartner = seededPartners.find((p) => p.name === tm.partnerName);
    await prisma.user.upsert({
      where: { email: tm.email.toLowerCase() },
      update: {},
      create: {
        email: tm.email.toLowerCase(),
        name: tm.name,
        identityType: "partner",
        role: tm.role === "Sales Rep" ? "SalesRep" : tm.role,
        partnerId: linkedPartner?.id || "prt-1",
        partnerName: tm.partnerName,
        isMainContact: false,
        passwordHash: hashPasswordWithRandomSalt(partnerPassword),
        status: "Active",
        isTestAccount: true,
      },
    });
  }

  // Initial AuditLog entries including DELETE of accidental preset reward (§14.2 Slice 1)
  await prisma.auditLog.createMany({
    data: [
      {
        actor: "Ray (Workspace Owner)",
        actorRole: "coworker (Administrator)",
        action: "DELETE",
        objectType: "RewardRule",
        objectId: "prog-strategic:lvl-silver:Quarterly Quota Accelerator Bonus",
        summary:
          'Deleted accidental preset reward rule "SGD 1,000 Quarterly Quota Accelerator Bonus" from Silver Tier of prog-strategic (§14.2 Slice 1)',
        diffJson: JSON.stringify({
          programId: "prog-strategic",
          level: "Silver Tier",
          deletedRuleTitle: "SGD 1,000 Quarterly Quota Accelerator Bonus",
          remainingRules: ["10% Recurring Deal Commission"],
        }),
      },
      {
        actor: "System Engine",
        actorRole: "coworker (Administrator)",
        action: "CREATE",
        objectType: "Reward",
        objectId: "tx-1",
        summary:
          "Computed Platinum Elite rewards for Apex Cloud Solutions (SGD 28,500 -> 25% SGD 7,125 + 5% SGD 1,425)",
        diffJson: JSON.stringify({
          transaction: "INV-2026-901 · Solaris Annual License",
          rewardsSgd: [7125, 1425],
        }),
      },
      {
        actor: "System Engine",
        actorRole: "coworker (Administrator)",
        action: "CREATE",
        objectType: "Reward",
        objectId: "tx-4",
        summary:
          "Computed Platinum Elite rewards for Synthetix POS & Retail Tech (SGD 12,600 -> 25% SGD 3,150 + 5% SGD 630)",
        diffJson: JSON.stringify({
          transaction: "INV-2026-790 · KL Gourmet POS Suite",
          rewardsSgd: [3150, 630],
        }),
      },
    ],
  });

  // Tasks
  await prisma.task.createMany({
    data: [
      { id: "tsk-1", name: "Review Q4 Joint Marketing Plan with Apex Cloud", status: "Due Today", type: "Review", dueDate: "2026-11-24", dueTime: "02:00 PM", description: "Finalize co-branded webinar budget and target account list.", assignedToId: userIdByName["Alex Morgan"], assignedTo: "Alex Morgan", associationType: "Partner", associationName: "Apex Cloud Solutions Pte Ltd", createdBy: "Alex Morgan" },
      { id: "tsk-2", name: "Complete Technical Certification Sandbox Walkthrough", status: "Upcoming", type: "Onboarding", dueDate: "2026-11-28", dueTime: "10:30 AM", description: "Guide Vanguard Enterprise Matrix engineering team through webhook auth.", assignedToId: userIdByName["Sarah Jenkins"], assignedTo: "Sarah Jenkins", associationType: "Partner", associationName: "Vanguard Enterprise Matrix", createdBy: "Alex Morgan" },
      { id: "tsk-3", name: "Follow up on Velvet & Vine Lead Acceptance", status: "Overdue", type: "Follow-up", dueDate: "2026-11-21", dueTime: "09:00 AM", description: "Verify store count and Shopify POS integration timeline.", assignedToId: userIdByName["Alex Morgan"], assignedTo: "Alex Morgan", associationType: "Lead", associationName: "Nadia Khoury · Velvet & Vine", createdBy: "Sarah Jenkins" },
      { id: "tsk-4", name: "Prepare Final Order Form for Artisan Bakers Collective", status: "Upcoming", type: "Call", dueDate: "2026-11-29", dueTime: "04:00 PM", description: "Include 15-outlet annual discount tier.", assignedToId: userIdByName["Alex Morgan"], assignedTo: "Alex Morgan", associationType: "Deal", associationName: "MM - Artisan Bakers Collective (15 Outlets)", createdBy: "Alex Morgan" },
      { id: "tsk-5", name: "Verify Bank & Tax Details for NovaBridge Payout", status: "Completed", type: "Review", dueDate: "2026-11-15", dueTime: "11:00 AM", description: "Confirmed SWIFT code and GST registration.", assignedToId: userIdByName["Marcus Vance"], assignedTo: "Marcus Vance", associationType: "Partner", associationName: "NovaBridge Digital Systems", createdBy: "Alex Morgan", completedBy: "Marcus Vance", completedDate: "2026-11-15" },
    ],
  });

  // Business Plans (targetRevBase stored in minor units / cents)
  await prisma.businessPlan.createMany({
    data: [
      { id: "bp-1", name: "FY2026 APAC Enterprise Hospitality Expansion", partnerName: "Apex Cloud Solutions Pte Ltd", partnerOwner: "Alex Morgan", status: "Active", description: "Target 15 multi-property hotel and resort groups across Singapore, Thailand, and Bali.", startDate: "2026-01-01", endDate: "2026-12-31", achievedPct: 84, targetRevBase: toMinorUnits(100000) },
      { id: "bp-2", name: "H2 2026 Omnichannel F&B POS Bundling Initiative", partnerName: "Synthetix POS & Retail Tech", partnerOwner: "Marcus Vance", status: "Active", description: "Bundle R-PRM loyalty engine with every new Synthetix POS multi-outlet deployment.", startDate: "2026-07-01", endDate: "2026-12-31", achievedPct: 68, targetRevBase: toMinorUnits(85000) },
      { id: "bp-3", name: "FY2027 UK & Europe Channel Launch Plan", partnerName: "Vanguard Enterprise Matrix", partnerOwner: "Alex Morgan", status: "Draft", description: "Establish initial 10 reference customers in UK specialty retail.", startDate: "2027-01-01", endDate: "2027-12-31", achievedPct: 15, targetRevBase: toMinorUnits(120000) },
    ],
  });

  // Account Mapping (Accounts, Overlaps, Collaborations, Data Sources)
  await prisma.accountRecord.createMany({
    data: [
      { id: "acc-1", accountName: "Aura Luxury Hospitality Group", type: "Opportunity", ownerName: "Alex Morgan", ownerEmail: "alex@r-prm.example.com", source: "HubSpot CRM Sync", importedDate: "2026-11-15", hasOverlap: true, partnerName: "Apex Cloud Solutions Pte Ltd", partnerAccountName: "Aura Luxury Hospitality Group", partnerAccountType: "Customer", partnerOwnerName: "Jordan Lee", partnerOwnerEmail: "jordan.lee@apexcloud.example.com", overlapDate: "2026-11-16" },
      { id: "acc-2", accountName: "Vertex Retail Corp", type: "Prospect", ownerName: "Alex Morgan", ownerEmail: "alex@r-prm.example.com", source: "HubSpot CRM Sync", importedDate: "2026-11-15", hasOverlap: true, partnerName: "Apex Cloud Solutions Pte Ltd", partnerAccountName: "Vertex Retail Holdings", partnerAccountType: "Customer", partnerOwnerName: "Jordan Lee", partnerOwnerEmail: "jordan.lee@apexcloud.example.com", overlapDate: "2026-11-17" },
      { id: "acc-3", accountName: "Zenith Activewear APAC", type: "Opportunity", ownerName: "Marcus Vance", ownerEmail: "marcus@r-prm.example.com", source: "Salesforce Sync", importedDate: "2026-11-14", hasOverlap: true, partnerName: "Synthetix POS & Retail Tech", partnerAccountName: "Zenith Activewear MY", partnerAccountType: "Opportunity", partnerOwnerName: "Aisha Rahman", partnerOwnerEmail: "aisha@synthetix.example.com", overlapDate: "2026-11-18" },
      { id: "acc-4", accountName: "Solstice Gourmet Grocers", type: "Prospect", ownerName: "Sarah Jenkins", ownerEmail: "sarah@r-prm.example.com", source: "HubSpot CRM Sync", importedDate: "2026-11-15", hasOverlap: true, partnerName: "Stratos FinTech Integrations", partnerAccountName: "Solstice Supermarkets", partnerAccountType: "Customer", partnerOwnerName: "Chloe Goh", partnerOwnerEmail: "chloe@stratosfintech.example.com", overlapDate: "2026-11-19" },
      { id: "acc-5", accountName: "Solaris Luxury Resort Group", type: "Customer", ownerName: "Alex Morgan", ownerEmail: "alex@r-prm.example.com", source: "HubSpot CRM Sync", importedDate: "2026-11-10", hasOverlap: true, partnerName: "NovaBridge Digital Systems", partnerAccountName: "Solaris Resorts APAC", partnerAccountType: "Prospect", partnerOwnerName: "Mei Tan", partnerOwnerEmail: "mei.tan@novabridge.example.com", overlapDate: "2026-11-20" },
      { id: "acc-6", accountName: "Pacific Rim Aviation Lounges", type: "Prospect", ownerName: "Alex Morgan", ownerEmail: "alex@r-prm.example.com", source: "CSV Account Upload", importedDate: "2026-11-12", hasOverlap: false, partnerName: "BluePeak Commerce Advisory", partnerAccountName: "Pacific Rim Lounges", partnerAccountType: "Prospect", partnerOwnerName: "Liam O'Connor", partnerOwnerEmail: "liam@bluepeak.example.com", overlapDate: "2026-11-21" },
    ],
  });

  await prisma.collaboration.createMany({
    data: [
      { id: "col-1", name: "Co-Sell: Aura Luxury Warm Intro & Executive Demo", status: "Accepted", ownerId: userIdByName["Alex Morgan"], owner: "Alex Morgan", partnerName: "Apex Cloud Solutions Pte Ltd", assignedContact: "Jordan Lee", accountName: "Aura Luxury Hospitality Group", lastActivityDate: "2026-11-22" },
      { id: "col-2", name: "Joint Architecture Review: Vertex Omnichannel POS", status: "Accepted", ownerId: userIdByName["Alex Morgan"], owner: "Alex Morgan", partnerName: "Apex Cloud Solutions Pte Ltd", assignedContact: "Darren Koh", accountName: "Vertex Retail Corp", lastActivityDate: "2026-11-21" },
      { id: "col-3", name: "POS Migration Bundle: Zenith 31 Stores", status: "New", ownerId: userIdByName["Marcus Vance"], owner: "Marcus Vance", partnerName: "Synthetix POS & Retail Tech", assignedContact: "Aisha Rahman", accountName: "Zenith Activewear APAC", lastActivityDate: "2026-11-23" },
      { id: "col-4", name: "Payment Gateway Co-Pitch: Solstice Grocers", status: "Closed", ownerId: userIdByName["Sarah Jenkins"], owner: "Sarah Jenkins", partnerName: "Stratos FinTech Integrations", assignedContact: "Chloe Goh", accountName: "Solstice Gourmet Grocers", lastActivityDate: "2026-11-10" },
    ],
  });

  await prisma.dataSource.createMany({
    data: [
      { id: "ds-1", name: "HubSpot Production CRM — Enterprise Accounts", status: "Active", sharedWith: "All Strategic Partners", type: "CRM Connected", accountType: "Customers, Opportunities & Prospects", lastImportedDate: "2026-11-24", createdBy: "Alex Morgan" },
      { id: "ds-2", name: "Apex Cloud Partner Customer Roster (Q4 CSV)", status: "Active", sharedWith: "Internal Alliance Team", type: "CSV Upload", accountType: "Partner Customers & Prospects", lastImportedDate: "2026-11-18", createdBy: "Jordan Lee" },
      { id: "ds-3", name: "Synthetix POS Installed Base APAC", status: "Active", sharedWith: "Marcus Vance · ISV Team", type: "CRM Connected", accountType: "Partner Customers", lastImportedDate: "2026-11-20", createdBy: "Aisha Rahman" },
    ],
  });

  // Tracking Links (revenuesBase stored in minor units / cents)
  await prisma.trackingLink.createMany({
    data: [
      { id: "lnk-1", name: "Main Enterprise Solution Landing Page", targetUrl: "https://r-prm.example.com/enterprise?utm_source=partner", programId: prog1.id, partnerName: "Apex Cloud Solutions Pte Ltd", uniqueVisitors: 1280, leadsCount: 24, customersCount: 8, transactionsCount: 16, revenuesBase: toMinorUnits(64200) },
      { id: "lnk-2", name: "Interactive ROI Calculator Referral Link", targetUrl: "https://r-prm.example.com/roi-calculator?utm_source=referral", programId: prog2.id, partnerName: "BluePeak Commerce Advisory", uniqueVisitors: 840, leadsCount: 19, customersCount: 5, transactionsCount: 9, revenuesBase: toMinorUnits(32800) },
      { id: "lnk-3", name: "POS Integration Marketplace Listing", targetUrl: "https://r-prm.example.com/integrations/synthetix", programId: prog3.id, partnerName: "Synthetix POS & Retail Tech", uniqueVisitors: 615, leadsCount: 14, customersCount: 6, transactionsCount: 12, revenuesBase: toMinorUnits(41500) },
    ],
  });

  // Manage Hub (14 Sub-Modules + Custom Properties + API Tokens)
  await prisma.manageItem.createMany({
    data: [
      // 1. Assets
      { category: "assets", name: "R-PRM 2026 Enterprise Pitch Deck (PDF)", subtitle: "Sales Enablement · 8.4 MB · Shared with All Programs", status: "Published", metadataJson: JSON.stringify({ fileType: "PDF", folder: "Sales Collateral", downloads: 42 }) },
      { category: "assets", name: "Master Reseller & Referral Agreement Template (DOCX)", subtitle: "Legal & Contracts · 1.2 MB · Strategic Partners", status: "Published", metadataJson: JSON.stringify({ fileType: "DOCX", folder: "Contracts", downloads: 19 }) },
      { category: "assets", name: "Omnichannel API & Webhook Technical Architecture Video", subtitle: "Training Video · 18 mins · ISV & Tech Partners", status: "Published", metadataJson: JSON.stringify({ fileType: "MP4", folder: "Technical Enablement", downloads: 31 }) },
      // 2. Certifications
      { category: "certifications", name: "R-PRM Certified Sales Professional (RCSP)", subtitle: "Validity period: 24 Months · 14 Certified Partners", status: "Active", metadataJson: JSON.stringify({ validityMonths: 24, passingScore: "85%" }) },
      { category: "certifications", name: "R-PRM Certified Solutions Architect & Integrator", subtitle: "Validity period: 12 Months · 8 Certified Partners", status: "Active", metadataJson: JSON.stringify({ validityMonths: 12, passingScore: "90%" }) },
      // 3. Email templates (11 templates)
      { category: "email_templates", name: "Partner Application Received", subtitle: "Subject: Welcome! We've received your R-PRM partner application", status: "Active", metadataJson: JSON.stringify({ trigger: "On partner signup" }) },
      { category: "email_templates", name: "Partner Application Approved", subtitle: "Subject: Congratulations! Your partner portal is ready", status: "Active", metadataJson: JSON.stringify({ trigger: "On application approval" }) },
      { category: "email_templates", name: "New Shared Lead Assigned", subtitle: "Subject: Action Required: A new lead has been shared with you", status: "Active", metadataJson: JSON.stringify({ trigger: "When lead is shared to partner" }) },
      { category: "email_templates", name: "Deal Registration Validated", subtitle: "Subject: Deal Approved: {{deal.name}} is now protected", status: "Active", metadataJson: JSON.stringify({ trigger: "When deal is accepted" }) },
      { category: "email_templates", name: "Deal Expiration Reminder (14 Days)", subtitle: "Subject: Reminder: Protected deal {{deal.name}} expires in 14 days", status: "Active", metadataJson: JSON.stringify({ trigger: "14 days before expiration" }) },
      { category: "email_templates", name: "Reward Approved & Added to Payout", subtitle: "Subject: Commission Reward {{reward.number}} validated", status: "Active", metadataJson: JSON.stringify({ trigger: "On reward validation" }) },
      { category: "email_templates", name: "Payout Settlement Confirmation", subtitle: "Subject: Payout {{payout.number}} has been disbursed", status: "Active", metadataJson: JSON.stringify({ trigger: "When payout marked Paid" }) },
      // 4. Groups
      { category: "groups", name: "APAC Cloud Alliances", subtitle: "4 Partners · 32 Submitted Leads · 21 Registered Deals · 68% Win Rate", status: "Active", metadataJson: JSON.stringify({ partnersCount: 4, submittedLeads: 32, convertedLeadsPct: "62%", sharedLeads: 14, registeredDeals: 21, wonDeals: 14, wonDealsPct: "66.7%" }) },
      { category: "groups", name: "Global Growth Agencies", subtitle: "2 Partners · 14 Submitted Leads · 6 Registered Deals · 50% Win Rate", status: "Active", metadataJson: JSON.stringify({ partnersCount: 2, submittedLeads: 14, convertedLeadsPct: "57%", sharedLeads: 6, registeredDeals: 6, wonDeals: 3, wonDealsPct: "50.0%" }) },
      { category: "groups", name: "ISV Ecosystem", subtitle: "2 Partners · 14 Submitted Leads · 11 Registered Deals · 72% Win Rate", status: "Active", metadataJson: JSON.stringify({ partnersCount: 2, submittedLeads: 14, convertedLeadsPct: "71%", sharedLeads: 9, registeredDeals: 11, wonDeals: 8, wonDealsPct: "72.7%" }) },
      // 5. Help Center
      { category: "help_articles", name: "How to Register & Protect an Enterprise Deal", subtitle: "Collection: Getting Started for Partners · Updated 3 days ago", status: "Published", metadataJson: JSON.stringify({ collection: "Deal Registration", views: 312 }) },
      { category: "help_articles", name: "Connecting Your Bank Account & Downloading Self-Invoices", subtitle: "Collection: Commissions & Payouts · Updated 1 week ago", status: "Published", metadataJson: JSON.stringify({ collection: "Payouts & Billing", views: 245 }) },
      { category: "help_articles", name: "Uploading Customer Lists for Automated Account Mapping", subtitle: "Collection: Co-Selling & Overlaps · Updated 2 weeks ago", status: "Published", metadataJson: JSON.stringify({ collection: "Account Mapping", views: 178 }) },
      // 6. Integrations (14 cards)
      { category: "integrations", name: "HubSpot", subtitle: "CRM · Bi-directional Deal, Lead & Contact Sync", status: "Connected", metadataJson: JSON.stringify({ type: "CRM", badge: "Connected" }) },
      { category: "integrations", name: "Salesforce", subtitle: "CRM · Enterprise Opportunity & Account Mapping Sync", status: "Available", metadataJson: JSON.stringify({ type: "CRM", badge: "" }) },
      { category: "integrations", name: "Stripe", subtitle: "Payment · Automated Subscription Transaction & Payout Sync", status: "Connected", metadataJson: JSON.stringify({ type: "Payment", badge: "Connected" }) },
      { category: "integrations", name: "Chargebee", subtitle: "Payment · Recurring Billing & Invoice Ingestion", status: "Available", metadataJson: JSON.stringify({ type: "Payment", badge: "" }) },
      { category: "integrations", name: "Slack", subtitle: "Communication · Real-time Partner Deal & Lead Alerts", status: "Connected", metadataJson: JSON.stringify({ type: "Communication", badge: "New" }) },
      { category: "integrations", name: "ChatGPT", subtitle: "AI Assistants · Partner Portal Copilot & Deal Summarizer", status: "Available", metadataJson: JSON.stringify({ type: "AI assistants", badge: "New" }) },
      { category: "integrations", name: "Claude", subtitle: "AI Assistants · Automated Joint Business Plan Drafting", status: "Available", metadataJson: JSON.stringify({ type: "AI assistants", badge: "New" }) },
      { category: "integrations", name: "Google Calendar", subtitle: "Meetings · Auto-log Partner QBRs & Co-selling Calls", status: "Connected", metadataJson: JSON.stringify({ type: "Meetings", badge: "Connected" }) },
      { category: "integrations", name: "Fathom", subtitle: "Meetings · AI Call Recording & Deal Note Extraction", status: "Available", metadataJson: JSON.stringify({ type: "Meetings", badge: "New" }) },
      { category: "integrations", name: "Intercom", subtitle: "Support · In-portal Partner Live Chat Widget", status: "Available", metadataJson: JSON.stringify({ type: "Support", badge: "" }) },
      { category: "integrations", name: "Crisp", subtitle: "Support · Shared Partner Support Inbox", status: "Available", metadataJson: JSON.stringify({ type: "Support", badge: "" }) },
      { category: "integrations", name: "Freshchat", subtitle: "Support · Partner Ticketing & Messaging", status: "Available", metadataJson: JSON.stringify({ type: "Support", badge: "" }) },
      { category: "integrations", name: "Zapier", subtitle: "Automation · Connect 6,000+ Apps with Webhooks", status: "Connected", metadataJson: JSON.stringify({ type: "Automation", badge: "Connected" }) },
      { category: "integrations", name: "Gmail", subtitle: "Communication · Two-way Partner Email Thread Sync", status: "Coming soon", metadataJson: JSON.stringify({ type: "Communication", badge: "Coming soon" }) },
      // 7. News
      { category: "news", name: "Q4 Double Commission Accelerator for Enterprise Multi-Region Deals", subtitle: "Published Nov 15, 2026 · Visible to All Strategic & Gold Partners", status: "Published", metadataJson: JSON.stringify({ audience: "All Strategic Partners" }) },
      { category: "news", name: "Introducing Real-Time Account Mapping & Overlap Alerts", subtitle: "Published Nov 02, 2026 · Visible to All Programs", status: "Published", metadataJson: JSON.stringify({ audience: "All Programs" }) },
      // 8. Partner dashboards
      { category: "partner_dashboards", name: "Default Reseller Portal Dashboard", subtitle: "Widgets: Quick Deal Reg, Commission Tracker, Active Assets, Certification Progress", status: "Default", metadataJson: JSON.stringify({ widgetsCount: 6 }) },
      { category: "partner_dashboards", name: "Referral Affiliate Simplified View", subtitle: "Widgets: Referral Links, Click & Lead Funnel, Payout History", status: "Active", metadataJson: JSON.stringify({ widgetsCount: 4 }) },
      // 9. Partner directories
      { category: "directories", name: "Global Public Solution Partner Directory", subtitle: "https://partners.r-prm.example.com/directory · 6 Listed Partners · Filterable by Country & Industry", status: "Live", metadataJson: JSON.stringify({ subdomain: "partners.r-prm" }) },
      // 10. Partner onboarding pipelines
      { category: "onboarding_pipelines", name: "Strategic Partner Onboarding Pipeline", subtitle: "4 Stages: Kickoff Welcome Call → Book a Demo Account Training → Technical Certification → Completed", status: "Active", metadataJson: JSON.stringify({ stages: ["Kickoff Welcome Call", "Book a Demo Account Training", "Technical Certification", "Completed"] }) },
      { category: "onboarding_pipelines", name: "Fast-Track Referral Onboarding", subtitle: "3 Stages: Accept Portal Invite → Banking & Tax Setup → Completed", status: "Active", metadataJson: JSON.stringify({ stages: ["Accept Portal Invite", "Banking & Tax Setup", "Completed"] }) },
      // 11. Products
      { category: "products", name: "R-PRM Enterprise Multi-Region Platform", subtitle: "SKU: RPRM-ENT-01 · Base Annual License (SGD 24,000/yr)", status: "Active", metadataJson: JSON.stringify({ priceSgd: 24000 }) },
      { category: "products", name: "R-PRM Growth Pro Suite", subtitle: "SKU: RPRM-GRW-02 · Mid-Market Annual License (SGD 12,000/yr)", status: "Active", metadataJson: JSON.stringify({ priceSgd: 12000 }) },
      { category: "products", name: "Dedicated Solutions Architect Onboarding Pack", subtitle: "SKU: RPRM-SRV-03 · One-time Implementation Package (SGD 4,500)", status: "Active", metadataJson: JSON.stringify({ priceSgd: 4500 }) },
      // 12. Team (Internal Coworkers)
      { category: "team", name: "Alex Morgan", subtitle: "alex@r-prm.example.com · VP of Global Channels · +65 9100 2200", status: "Administrator", metadataJson: JSON.stringify({ role: "Administrator", invitation: "Accepted" }) },
      { category: "team", name: "Sarah Jenkins", subtitle: "sarah@r-prm.example.com · Senior Partner Account Manager · +65 9100 2201", status: "Manager", metadataJson: JSON.stringify({ role: "Manager", invitation: "Accepted" }) },
      { category: "team", name: "Marcus Vance", subtitle: "marcus@r-prm.example.com · ISV & Tech Alliances Lead · +65 9100 2202", status: "Manager", metadataJson: JSON.stringify({ role: "Manager", invitation: "Accepted" }) },
      // 13. Workflows
      { category: "workflows", name: "Auto-Generate 18% Reward on Closed Won Deal", subtitle: "Trigger: Deal Stage moves to Closed Won → Action: Create Pending Commission Reward", status: "Active", metadataJson: JSON.stringify({ trigger: "Deal Closed Won", runs: 27 }) },
      { category: "workflows", name: "Notify Slack #channel-wins on New Partner Deal Registration", subtitle: "Trigger: Deal Registered by Partner → Action: Post Slack Message & Assign Owner", status: "Active", metadataJson: JSON.stringify({ trigger: "Deal Registered", runs: 64 }) },
      { category: "workflows", name: "Escalate Unaccepted Shared Leads After 72 Hours", subtitle: "Trigger: Shared Lead Pending > 3 Days → Action: Send Reminder Email to Partner Manager", status: "Active", metadataJson: JSON.stringify({ trigger: "Lead Pending 72h", runs: 12 }) },
      // 14. Custom Properties (Settings -> Properties)
      { category: "custom_properties", name: "Lead temperature", subtitle: "", status: "Active", metadataJson: JSON.stringify({ objectType: "Leads", fieldType: "select", key: "lead_temperature", options: ["Hot", "Warm", "Cold"] }) },
      { category: "custom_properties", name: "Competitor in deal", subtitle: "", status: "Active", metadataJson: JSON.stringify({ objectType: "Deals", fieldType: "text", key: "competitor_in_deal", options: [] }) },
      { category: "custom_properties", name: "Registered company tax ID", subtitle: "", status: "Active", metadataJson: JSON.stringify({ objectType: "Partners", fieldType: "text", key: "registered_company_tax_id", options: [] }) },
      { category: "custom_properties", name: "Outlet count", subtitle: "", status: "Active", metadataJson: JSON.stringify({ objectType: "Customers", fieldType: "number", key: "outlet_count", options: [] }) },
      { category: "custom_properties", name: "Invoice number", subtitle: "", status: "Active", metadataJson: JSON.stringify({ objectType: "Transactions", fieldType: "text", key: "invoice_number", options: [] }) },
      // 16. Editable Commission Rule Templates (§3.5.2)
      ...Object.values(DEFAULT_COMMISSION_TEMPLATES).map((tpl) => ({
        category: "commission_templates",
        name: tpl.title,
        subtitle: `${tpl.amountMode} · ${tpl.duration}`,
        status: "Active",
        metadataJson: JSON.stringify({ ...tpl, currency: "SGD" }),
      })),
    ],
  });

  // Notes on Partners, Leads, Deals
  await prisma.noteItem.createMany({
    data: [
      { entityType: "partner", entityId: "prt-1", author: "Alex Morgan", content: "@Jordan Lee confirmed Q4 executive roadshow in Singapore and Kuala Lumpur. MDF co-funding approved for SGD 5,000.", isShared: true },
      { entityType: "lead", entityId: "lead-1", author: "Alex Morgan", content: "Discovery call completed with @Claire Winslow. Converting to enterprise multi-region deal opportunity next week.", isShared: true },
      { entityType: "deal", entityId: "deal-1", author: "Jordan Lee", content: "Signed master service agreement uploaded. Customer requested invoice in SGD.", isShared: true },
    ],
  });

  // App Settings (Dashboard Widgets, Account Settings, User Preferences)
  await prisma.appSetting.create({
    data: {
      key: "dashboard_widgets",
      valueJson: JSON.stringify([
        "leads_from_partners",
        "shared_leads",
        "transactions_chart",
        "pending_rewards",
        "latest_deals",
        "current_leads",
        "top_sales_partners",
        "deals_stats",
      ]),
    },
  });

  await prisma.appSetting.create({
    data: {
      key: "account_settings",
      valueJson: JSON.stringify({
        accountName: "R-Cloud Enterprise PRM",
        workspaceId: "ws_r_cloud_demo",
        workspaceSlug: "r-cloud-global",
        logoText: "RC",
        timezone: "Asia/Singapore (GMT+08:00)",
        mainCurrency: "SGD",
        multiCurrency: true,
        defaultOwnerId: userIdByName["Alex Morgan"],
        defaultOwnerName: "Alex Morgan",
        legalEntityName: "R-Cloud Enterprise Pte Ltd",
        taxId: "SG-202600112Z",
        billingAddress: "10 Marina Boulevard, Singapore",
        leadConsentText:
          "I confirm I have obtained permission from this prospect to share their business contact details with {{workspace.name}}.",
        leadConsentTermsLabel: "Terms & Privacy Policy",
        leadConsentTermsUrl: "https://r-prm.example.com/legal/privacy",
        portalDomain: "https://partners.r-cloud.example.com",
        primaryColor: "#2563EB",
        directorySubdomain: "r-cloud",
        requireMfaCoworkers: true,
        requireMfaPartners: false,
        ssoEnabledCoworkers: true,
        ssoEnabledPartners: false,
        spEntityId: "https://app.r-prm.example.com/saml/metadata",
        spCallbackUrl: "https://app.r-prm.example.com/saml/acs",
        dealExpirationDays: 90,
        dealReminderDays: 14,
        autoAssociateCustomers: true,
        conflictDetection: "Warn on duplicate email or company domain across Leads, Deals, and Customers",
        validationStrategy: "Partner Owner or Administrator",
        autoPayoutSchedule: "Monthly (1st business day)",
        autoPayoutThresholdBase: 250,
        payoutProviders: ["Manual"],
        selfInvoicingEnabled: true,
      }),
    },
  });

  await prisma.appSetting.create({
    data: {
      key: "user_preferences",
      valueJson: JSON.stringify({
        firstName: "Alex",
        lastName: "Morgan",
        email: "alex@r-prm.example.com",
        jobTitle: "VP of Global Channels",
        phone: "+65 9100 2200",
        calendarLink: "https://cal.example.com/alex-morgan/partner-qbr",
        language: "English (US)",
        timezone: "Asia/Singapore (GMT+08:00)",
        mfaEnabled: true,
        googleCalendarConnected: true,
        notifications: {
          "New Lead Submitted by Partner": { inApp: true, email: true },
          "Shared Lead Accepted or Refused": { inApp: true, email: true },
          "New Deal Registered": { inApp: true, email: true },
          "Deal Stage Updated": { inApp: true, email: false },
          "Deal Expiring Soon": { inApp: true, email: true },
          "New Partner Application": { inApp: true, email: true },
          "Reward Pending Validation": { inApp: true, email: false },
          "Account Overlap Detected": { inApp: true, email: true },
        },
      }),
    },
  });
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      console.log("R-PRM PostgreSQL database seeded with synthetic demo data.");
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
