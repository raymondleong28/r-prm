import { normalizeRewardRule, SUPPORTED_CURRENCIES } from "./prmEngine";

/**
 * Explicit Partner-Facing Allowlist Serializers
 *
 * One serializer per partner-reachable object type.
 * - Never returns raw `metadataJson`, `awardedPartners`, email subjects, or admin configuration.
 * - Never leaks another partner's name, program, or level.
 * - For `settings`, returns only what the portal renders: branding (`accountName`, `primaryColor`, `logoText`, `portalDomain`),
 *   `mainCurrency`, `payoutProviders`, `selfInvoicingEnabled`, and the partner's own `user_preferences`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializePartnerForPartner(p: any, includeBankDetails = false) {
  const base = {
    id: p.id,
    name: p.name,
    groupName: p.groupName,
    programId: p.programId,
    programName: p.programName,
    qualifyingLevel: p.qualifyingLevel,
    status: p.status,
    onboardingStatus: p.onboardingStatus,
    onboardingPipeline: p.onboardingPipeline,
    onboardingStage: p.onboardingStage,
    partnerType: p.partnerType,
    country: p.country,
    language: p.language,
    currency: p.currency,
    activeSince: p.activeSince,
    submittedLeads365d: p.submittedLeads365d ?? 0,
    registeredDeals365d: p.registeredDeals365d ?? 0,
    pendingRewardsAll: p.pendingRewardsAll ?? 0,
    sourcedRevenue365d: p.sourcedRevenue365d ?? 0,
    influencedRev365d: p.influencedRev365d ?? 0,
    wonDealsCount: p.wonDealsCount ?? 0,
    contactFirstName: p.contactFirstName,
    contactLastName: p.contactLastName,
    contactEmail: p.contactEmail,
    contactJobTitle: p.contactJobTitle,
    contactPhone: p.contactPhone,
    companyWebsite: p.companyWebsite,
    companyAddress: p.companyAddress,
    employeeCount: p.employeeCount,
    industry: p.industry,
    leadFormToken: p.leadFormToken,
  };
  if (includeBankDetails) {
    return { ...base, bankDetailsJson: p.bankDetailsJson };
  }
  return base;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeProgramForPartner(prog: any, partnerLevelName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let levels: any[] = [];
  try {
    levels = JSON.parse(prog.levelsJson || "[]");
  } catch {
    levels = [];
  }
  const ownLevelOnly = levels
    .filter((lvl) => lvl.name === partnerLevelName)
    .map((lvl) => ({
      id: lvl.id,
      name: lvl.name,
      badgeColor: lvl.badgeColor,
      rewards: Array.isArray(lvl.rewards)
        ? lvl.rewards.map((r: unknown) => normalizeRewardRule(r))
        : [],
      benefits: lvl.benefits || [],
      requirements: lvl.requirements || [],
    }));
  return {
    id: prog.id,
    name: prog.name,
    levelsJson: JSON.stringify(ownLevelOnly),
    permissionsJson: prog.permissionsJson,
    termsRequired: prog.termsRequired,
    termsUrl: prog.termsUrl,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeLeadForPartner(l: any) {
  return {
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    company: l.company,
    jobTitle: l.jobTitle,
    email: l.email,
    phone: l.phone,
    country: l.country,
    retailBrand: l.retailBrand,
    outletsCount: l.outletsCount,
    website: l.website,
    posSolution: l.posSolution,
    remarks: l.remarks,
    status: l.status,
    source: l.source,
    sourcePartnerName: l.sourcePartnerName,
    assignedContact: l.assignedContact,
    assignedDate: l.assignedDate,
    deadline: l.deadline,
    convertedDealId: l.convertedDealId,
    createdAt: l.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeDealForPartner(d: any) {
  return {
    id: d.id,
    name: d.name,
    clientName: d.clientName,
    company: d.company,
    amount: d.amount,
    currency: d.currency,
    amountBase: d.amountBase,
    partnerName: d.partnerName,
    partnerId: d.partnerId,
    assignedContact: d.assignedContact,
    status: d.status,
    stage: d.stage,
    stageEnteredAt: d.stageEnteredAt,
    closeDate: d.closeDate,
    expirationDate: d.expirationDate,
    programName: d.programName,
    dealType: d.dealType,
    subscriptionPlan: d.subscriptionPlan,
    comment: d.comment,
    lineItemsJson: d.lineItemsJson,
    createdAt: d.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeCustomerForPartner(c: any) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    status: c.status,
    sourcePartnerName: c.sourcePartnerName,
    becamePayingDate: c.becamePayingDate,
    subscriptionPlan: c.subscriptionPlan,
    billingFrequency: c.billingFrequency,
    billingPeriod: c.billingPeriod,
    transactionsCount: c.transactionsCount,
    revenuesBase: c.revenuesBase,
    createdAt: c.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeTransactionForPartner(t: any) {
  return {
    id: t.id,
    name: t.name,
    amount: t.amount,
    currency: t.currency,
    amountBase: t.amountBase,
    partnerName: t.partnerName,
    customerName: t.customerName,
    dealName: t.dealName,
    monthKey: t.monthKey,
    createdAt: t.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeRewardForPartner(r: any) {
  return {
    id: r.id,
    rewardNumber: r.rewardNumber,
    partnerName: r.partnerName,
    recipientName: r.recipientName,
    type: r.type,
    amount: r.amount,
    currency: r.currency,
    amountBase: r.amountBase,
    fromActivity: r.fromActivity,
    fromRewardRule: r.fromRewardRule,
    status: r.status,
    payoutNumber: r.payoutNumber,
    comment: r.comment,
    createdAt: r.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializePayoutForPartner(po: any) {
  return {
    id: po.id,
    payoutNumber: po.payoutNumber,
    name: po.name,
    partnerName: po.partnerName,
    amount: po.amount,
    currency: po.currency,
    amountBase: po.amountBase,
    periodFrom: po.periodFrom,
    periodTo: po.periodTo,
    rewardsCount: po.rewardsCount,
    status: po.status,
    paidDate: po.paidDate,
    createdAt: po.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeManageItemForPartner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any,
  partnerName: string,
  partnerProgramName: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let meta: Record<string, any> = {};
  try {
    meta = JSON.parse(item.metadataJson || "{}");
  } catch {
    meta = {};
  }

  if (item.category === "assets") {
    return {
      id: item.id,
      category: "assets",
      name: item.name,
      subtitle: item.subtitle,
      status: item.status,
      folder: meta.folder || "General Collateral",
      fileType: meta.fileType || "PDF",
      fileUrl: meta.fileUrl || "",
      fileName: meta.fileName || item.name,
      size: meta.size || "",
    };
  }

  if (item.category === "news") {
    const cleanSubtitle = String(item.subtitle || "").replace(
      /Visible to All Strategic & Gold Partners/gi,
      `Visible to ${partnerProgramName}`
    );
    return {
      id: item.id,
      category: "news",
      name: item.name,
      title: item.name,
      subtitle: cleanSubtitle,
      body: meta.body || cleanSubtitle,
      date:
        meta.publishedDate ||
        (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : ""),
      status: item.status,
    };
  }

  if (item.category === "certifications") {
    const awardedList = Array.isArray(meta.awardedPartners)
      ? (meta.awardedPartners as string[])
      : [];
    const heldByThisPartner = awardedList.some((entry) =>
      String(entry).toLowerCase().includes(partnerName.toLowerCase())
    );
    return {
      id: item.id,
      category: "certifications",
      name: item.name,
      subtitle: `Validity period: ${meta.validityMonths || 24} Months`,
      validityMonths: meta.validityMonths || 24,
      heldByCurrentPartner: heldByThisPartner,
      status: item.status,
    };
  }

  return {
    id: item.id,
    category: "help_articles",
    name: item.name,
    subtitle: item.subtitle,
    collection: meta.collection || "Partner Guide",
    status: item.status,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeBusinessPlanForPartner(bp: any) {
  return {
    id: bp.id,
    name: bp.name,
    partnerName: bp.partnerName,
    status: bp.status,
    description: bp.description,
    startDate: bp.startDate,
    endDate: bp.endDate,
    achievedPct: bp.achievedPct,
    targetRevBase: bp.targetRevBase,
    createdAt: bp.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeCollaborationForPartner(col: any) {
  return {
    id: col.id,
    name: col.name,
    status: col.status,
    partnerName: col.partnerName,
    assignedContact: col.assignedContact,
    accountName: col.accountName,
    lastActivityDate: col.lastActivityDate,
    createdAt: col.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeTrackingLinkForPartner(lnk: any) {
  return {
    id: lnk.id,
    name: lnk.name,
    targetUrl: lnk.targetUrl,
    programId: lnk.programId,
    partnerName: lnk.partnerName,
    uniqueVisitors: lnk.uniqueVisitors,
    leadsCount: lnk.leadsCount,
    customersCount: lnk.customersCount,
    transactionsCount: lnk.transactionsCount,
    revenuesBase: lnk.revenuesBase,
    createdAt: lnk.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeTeamMemberForPartner(m: any) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    jobTitle: m.jobTitle,
    phone: m.phone,
    partnerName: m.partnerName,
    role: m.role,
    status: m.status,
    invitedAt: m.invitedAt,
    createdAt: m.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeNoteForPartner(n: any) {
  return {
    id: n.id,
    entityType: n.entityType,
    entityId: n.entityId,
    author: n.author,
    content: n.content,
    isShared: n.isShared,
    createdAt: n.createdAt,
  };
}

export function serializeSettingsForPartner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settingsMap: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partner: any,
  partnerEmail: string
) {
  const acct = settingsMap.account_settings || {};
  return {
    account_settings: {
      accountName: acct.accountName || "Workspace",
      primaryColor: acct.primaryColor || "#2563EB",
      logo: acct.logoText || acct.logo || "R",
      logoText: acct.logoText || acct.logo || "R",
      portalDomain: acct.portalDomain || "",
      mainCurrency: acct.mainCurrency || SUPPORTED_CURRENCIES[0],
      payoutProviders: Array.isArray(acct.payoutProviders)
        ? acct.payoutProviders
        : ["Manual"],
      selfInvoicingEnabled: Boolean(acct.selfInvoicingEnabled ?? true),
    },
    user_preferences: {
      firstName: partner?.contactFirstName || "Partner",
      lastName: partner?.contactLastName || "User",
      email: partnerEmail || partner?.contactEmail || "",
      jobTitle: partner?.contactJobTitle || "Partner Member",
      phone: partner?.contactPhone || "",
      language: partner?.language || "English",
      timezone: acct.timezone || "UTC",
    },
  };
}
