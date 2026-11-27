-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "levelsJson" TEXT NOT NULL,
    "partnerCount" INTEGER NOT NULL DEFAULT 0,
    "pendingApplications" INTEGER NOT NULL DEFAULT 0,
    "submittedLeads365d" INTEGER NOT NULL DEFAULT 0,
    "registeredDeals365d" INTEGER NOT NULL DEFAULT 0,
    "sourcedRevenue365d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "influencedRev365d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoEmailsJson" TEXT NOT NULL,
    "termsRequired" BOOLEAN NOT NULL DEFAULT true,
    "termsUrl" TEXT NOT NULL DEFAULT 'https://r-prm.example.com/terms',
    "revenueStrategy" TEXT NOT NULL DEFAULT 'Sum of deals closed won',
    "permissionsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "groupName" TEXT NOT NULL DEFAULT 'APAC Cloud Alliances',
    "programId" TEXT,
    "programName" TEXT NOT NULL DEFAULT 'R-Cloud Strategic Partner',
    "qualifyingLevel" TEXT NOT NULL DEFAULT 'Gold Tier',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "onboardingStatus" TEXT NOT NULL DEFAULT 'Completed',
    "onboardingPipeline" TEXT NOT NULL DEFAULT 'Strategic Partner',
    "onboardingStage" TEXT NOT NULL DEFAULT 'Completed',
    "prospectionStage" TEXT NOT NULL DEFAULT 'Active',
    "partnerType" TEXT NOT NULL DEFAULT 'Reseller',
    "country" TEXT NOT NULL DEFAULT 'Singapore',
    "language" TEXT NOT NULL DEFAULT 'English',
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "activeSince" TEXT NOT NULL DEFAULT '2026-01-15',
    "lastSeenDate" TEXT NOT NULL DEFAULT '2026-11-23',
    "lastSubmittedLead" TEXT NOT NULL DEFAULT '2026-11-18',
    "submittedLeads365d" INTEGER NOT NULL DEFAULT 0,
    "registeredDeals365d" INTEGER NOT NULL DEFAULT 0,
    "pendingRewardsAll" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourcedRevenue365d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "influencedRev365d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contactFirstName" TEXT NOT NULL DEFAULT 'Jordan',
    "contactLastName" TEXT NOT NULL DEFAULT 'Lee',
    "contactEmail" TEXT NOT NULL DEFAULT 'jordan@partner.example.com',
    "contactJobTitle" TEXT NOT NULL DEFAULT 'Head of Alliances',
    "contactPhone" TEXT NOT NULL DEFAULT '+65 6789 1234',
    "portalAccess" BOOLEAN NOT NULL DEFAULT true,
    "companyWebsite" TEXT NOT NULL DEFAULT 'https://partner.example.com',
    "companyAddress" TEXT NOT NULL DEFAULT '1 Raffles Place, Singapore',
    "employeeCount" TEXT NOT NULL DEFAULT '50-200',
    "industry" TEXT NOT NULL DEFAULT 'Cloud & SaaS Consulting',
    "bankDetailsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerTeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Manager',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "invitedAt" TEXT NOT NULL DEFAULT '2026-09-10',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL DEFAULT 'VP of Operations',
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '+65 9123 4567',
    "country" TEXT NOT NULL DEFAULT 'Singapore',
    "retailBrand" TEXT NOT NULL DEFAULT '',
    "outletsCount" INTEGER NOT NULL DEFAULT 3,
    "website" TEXT NOT NULL DEFAULT 'https://client.example.com',
    "posSolution" TEXT NOT NULL DEFAULT 'CloudPOS Pro',
    "remarks" TEXT NOT NULL DEFAULT 'Looking for multi-region loyalty & CRM rollout',
    "status" TEXT NOT NULL DEFAULT 'Accepted',
    "owner" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "source" TEXT NOT NULL DEFAULT 'Partner Portal',
    "sourcePartnerId" TEXT,
    "sourcePartnerName" TEXT NOT NULL DEFAULT 'Apex Cloud Solutions',
    "assignedPartner" TEXT NOT NULL DEFAULT 'Apex Cloud Solutions',
    "assignedContact" TEXT NOT NULL DEFAULT 'Jordan Lee',
    "assignedDate" TEXT NOT NULL DEFAULT '2026-10-12',
    "acceptedBy" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "acceptedDate" TEXT NOT NULL DEFAULT '2026-10-13',
    "deadline" TEXT NOT NULL DEFAULT '2026-12-15',
    "convertedDealId" TEXT,
    "hubspotSyncedAt" TEXT NOT NULL DEFAULT '2026-11-23 14:20',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "clientName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "amountSgd" DOUBLE PRECISION NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerId" TEXT,
    "assignedContact" TEXT NOT NULL DEFAULT 'Jordan Lee',
    "status" TEXT NOT NULL DEFAULT 'Accepted',
    "stage" TEXT NOT NULL DEFAULT 'Discovery Stage',
    "stageEnteredAt" TEXT NOT NULL DEFAULT '2026-11-01',
    "source" TEXT NOT NULL DEFAULT 'Partner Registration',
    "sourcePartnerName" TEXT NOT NULL,
    "closeDate" TEXT NOT NULL DEFAULT '2026-12-20',
    "expirationDate" TEXT NOT NULL DEFAULT '2027-02-20',
    "programName" TEXT NOT NULL DEFAULT 'R-Cloud Strategic Partner',
    "dealType" TEXT NOT NULL DEFAULT 'New Business',
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'Enterprise Annual',
    "comment" TEXT NOT NULL DEFAULT 'High-priority enterprise rollout',
    "sourceLeadId" TEXT,
    "hubspotDealId" TEXT NOT NULL DEFAULT 'HS-994821',
    "contractStart" TEXT NOT NULL DEFAULT '2027-01-01',
    "contractEnd" TEXT NOT NULL DEFAULT '2027-12-31',
    "lineItemsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Paying',
    "source" TEXT NOT NULL DEFAULT 'Deal Conversion',
    "sourcePartnerName" TEXT NOT NULL,
    "becamePayingDate" TEXT NOT NULL DEFAULT '2026-06-01',
    "bbid" TEXT NOT NULL DEFAULT 'BB-1042',
    "sourceDealId" TEXT NOT NULL DEFAULT '',
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'Enterprise Annual',
    "billingFrequency" TEXT NOT NULL DEFAULT 'Yearly',
    "billingPeriod" TEXT NOT NULL DEFAULT '12 Months',
    "canceledDate" TEXT NOT NULL DEFAULT '',
    "transactionsCount" INTEGER NOT NULL DEFAULT 4,
    "revenuesSgd" DOUBLE PRECISION NOT NULL DEFAULT 14800,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "amountSgd" DOUBLE PRECISION NOT NULL,
    "partnerName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "dealName" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL DEFAULT '11/2026',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "rewardNumber" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Cash',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "amountSgd" DOUBLE PRECISION NOT NULL,
    "fromActivity" TEXT NOT NULL,
    "fromRewardRule" TEXT NOT NULL DEFAULT '15% Recurring Commission',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "payoutNumber" TEXT NOT NULL DEFAULT '',
    "payoutId" TEXT,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "amountSgd" DOUBLE PRECISION NOT NULL,
    "periodFrom" TEXT NOT NULL DEFAULT '2026-01-01',
    "periodTo" TEXT NOT NULL DEFAULT '2026-11-30',
    "rewardsCount" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'Ready',
    "invoiceRef" TEXT NOT NULL DEFAULT 'INV-2026-089',
    "paidDate" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "type" TEXT NOT NULL DEFAULT 'Follow-up',
    "dueDate" TEXT NOT NULL,
    "dueTime" TEXT NOT NULL DEFAULT '09:00 AM',
    "description" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "associationType" TEXT NOT NULL DEFAULT 'Partner',
    "associationName" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "completedBy" TEXT NOT NULL DEFAULT '',
    "completedDate" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerOwner" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "description" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "achievedPct" INTEGER NOT NULL DEFAULT 65,
    "targetRevSgd" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountRecord" (
    "id" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Prospect',
    "ownerName" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "ownerEmail" TEXT NOT NULL DEFAULT 'alex@r-prm.example.com',
    "source" TEXT NOT NULL DEFAULT 'HubSpot CRM Sync',
    "importedDate" TEXT NOT NULL DEFAULT '2026-11-15',
    "hasOverlap" BOOLEAN NOT NULL DEFAULT true,
    "partnerName" TEXT NOT NULL DEFAULT 'Apex Cloud Solutions',
    "partnerAccountName" TEXT NOT NULL DEFAULT '',
    "partnerAccountType" TEXT NOT NULL DEFAULT 'Customer',
    "partnerOwnerName" TEXT NOT NULL DEFAULT 'Jordan Lee',
    "partnerOwnerEmail" TEXT NOT NULL DEFAULT 'jordan@apexcloud.example.com',
    "overlapDate" TEXT NOT NULL DEFAULT '2026-11-16',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collaboration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Accepted',
    "owner" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "partnerName" TEXT NOT NULL,
    "assignedContact" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "lastActivityDate" TEXT NOT NULL DEFAULT '2026-11-22',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collaboration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "sharedWith" TEXT NOT NULL DEFAULT 'All Strategic Partners',
    "type" TEXT NOT NULL DEFAULT 'CRM Connected',
    "accountType" TEXT NOT NULL DEFAULT 'Customers & Opportunities',
    "lastImportedDate" TEXT NOT NULL DEFAULT '2026-11-23',
    "createdBy" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL DEFAULT 'Apex Cloud Solutions',
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 420,
    "leadsCount" INTEGER NOT NULL DEFAULT 18,
    "customersCount" INTEGER NOT NULL DEFAULT 6,
    "transactionsCount" INTEGER NOT NULL DEFAULT 14,
    "revenuesSgd" DOUBLE PRECISION NOT NULL DEFAULT 28400,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManageItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteItem" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "content" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'Alex Morgan',
    "actorRole" TEXT NOT NULL DEFAULT 'Coworker (Admin)',
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "diffJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identityType" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "partnerId" TEXT,
    "partnerName" TEXT,
    "isMainContact" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "recoveryCodesJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "isTestAccount" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "impersonatingPartnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partnerId" TEXT,
    "partnerName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Manager',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationToken_tokenHash_key" ON "ActivationToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

