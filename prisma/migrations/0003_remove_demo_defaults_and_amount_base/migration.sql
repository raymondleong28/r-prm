-- §3.5.3: Rename base-currency money columns from *Sgd to *Base (preserving all existing data)
ALTER TABLE "Deal" RENAME COLUMN "amountSgd" TO "amountBase";
ALTER TABLE "Transaction" RENAME COLUMN "amountSgd" TO "amountBase";
ALTER TABLE "Reward" RENAME COLUMN "amountSgd" TO "amountBase";
ALTER TABLE "Payout" RENAME COLUMN "amountSgd" TO "amountBase";
ALTER TABLE "Customer" RENAME COLUMN "revenuesSgd" TO "revenuesBase";
ALTER TABLE "BusinessPlan" RENAME COLUMN "targetRevSgd" TO "targetRevBase";
ALTER TABLE "TrackingLink" RENAME COLUMN "revenuesSgd" TO "revenuesBase";

-- §3.5.1: Add ownerId / assignedToId columns for user-id ownership filtering and backfill existing rows
ALTER TABLE "Program" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Partner" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Deal" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Collaboration" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Task" ADD COLUMN "assignedToId" TEXT;

UPDATE "Program" p SET "ownerId" = u."id" FROM "User" u WHERE p."ownerId" IS NULL AND p."owner" = u."name";
UPDATE "Partner" p SET "ownerId" = u."id" FROM "User" u WHERE p."ownerId" IS NULL AND p."owner" = u."name";
UPDATE "Lead" l SET "ownerId" = u."id" FROM "User" u WHERE l."ownerId" IS NULL AND l."owner" = u."name";
UPDATE "Deal" d SET "ownerId" = u."id" FROM "User" u WHERE d."ownerId" IS NULL AND d."owner" = u."name";
UPDATE "Collaboration" c SET "ownerId" = u."id" FROM "User" u WHERE c."ownerId" IS NULL AND c."owner" = u."name";
UPDATE "Task" t SET "assignedToId" = u."id" FROM "User" u WHERE t."assignedToId" IS NULL AND t."assignedTo" = u."name";

-- §3.5.3 & §3.5.4: Remove demo and "SGD" column defaults across all tables
ALTER TABLE "Program"
    ALTER COLUMN "owner" SET DEFAULT '',
    ALTER COLUMN "onboardingPipelineId" SET DEFAULT '',
    ALTER COLUMN "termsUrl" SET DEFAULT '',
    ALTER COLUMN "revenueStrategy" DROP NOT NULL,
    ALTER COLUMN "revenueStrategy" DROP DEFAULT;

ALTER TABLE "Partner"
    ALTER COLUMN "owner" SET DEFAULT '',
    ALTER COLUMN "groupName" SET DEFAULT '',
    ALTER COLUMN "programName" SET DEFAULT '',
    ALTER COLUMN "qualifyingLevel" SET DEFAULT '',
    ALTER COLUMN "onboardingStatus" SET DEFAULT 'Not started',
    ALTER COLUMN "onboardingPipeline" SET DEFAULT '',
    ALTER COLUMN "onboardingStage" SET DEFAULT '',
    ALTER COLUMN "prospectionStage" SET DEFAULT 'New',
    ALTER COLUMN "country" SET DEFAULT '',
    ALTER COLUMN "currency" DROP DEFAULT,
    ALTER COLUMN "activeSince" SET DEFAULT '',
    ALTER COLUMN "lastSeenDate" SET DEFAULT '',
    ALTER COLUMN "lastSubmittedLead" SET DEFAULT '',
    ALTER COLUMN "contactFirstName" SET DEFAULT '',
    ALTER COLUMN "contactLastName" SET DEFAULT '',
    ALTER COLUMN "contactEmail" SET DEFAULT '',
    ALTER COLUMN "contactJobTitle" SET DEFAULT '',
    ALTER COLUMN "contactPhone" SET DEFAULT '',
    ALTER COLUMN "companyWebsite" SET DEFAULT '',
    ALTER COLUMN "companyAddress" SET DEFAULT '',
    ALTER COLUMN "employeeCount" SET DEFAULT '',
    ALTER COLUMN "industry" SET DEFAULT '';

ALTER TABLE "PartnerTeamMember"
    ALTER COLUMN "invitedAt" SET DEFAULT '';

ALTER TABLE "Lead"
    ALTER COLUMN "jobTitle" SET DEFAULT '',
    ALTER COLUMN "phone" SET DEFAULT '',
    ALTER COLUMN "country" SET DEFAULT '',
    ALTER COLUMN "outletsCount" SET DEFAULT 0,
    ALTER COLUMN "website" SET DEFAULT '',
    ALTER COLUMN "posSolution" SET DEFAULT '',
    ALTER COLUMN "remarks" SET DEFAULT '',
    ALTER COLUMN "status" SET DEFAULT 'Pending',
    ALTER COLUMN "owner" SET DEFAULT '',
    ALTER COLUMN "sourcePartnerName" SET DEFAULT '',
    ALTER COLUMN "assignedPartner" SET DEFAULT '',
    ALTER COLUMN "assignedContact" SET DEFAULT '',
    ALTER COLUMN "assignedDate" SET DEFAULT '',
    ALTER COLUMN "acceptedBy" SET DEFAULT '',
    ALTER COLUMN "acceptedDate" SET DEFAULT '',
    ALTER COLUMN "deadline" SET DEFAULT '',
    ALTER COLUMN "hubspotSyncedAt" SET DEFAULT '';

ALTER TABLE "Deal"
    ALTER COLUMN "owner" SET DEFAULT '',
    ALTER COLUMN "currency" DROP DEFAULT,
    ALTER COLUMN "assignedContact" SET DEFAULT '',
    ALTER COLUMN "status" SET DEFAULT 'Pending',
    ALTER COLUMN "stageEnteredAt" SET DEFAULT '',
    ALTER COLUMN "closeDate" SET DEFAULT '',
    ALTER COLUMN "expirationDate" SET DEFAULT '',
    ALTER COLUMN "programName" SET DEFAULT '',
    ALTER COLUMN "subscriptionPlan" SET DEFAULT '',
    ALTER COLUMN "comment" SET DEFAULT '',
    ALTER COLUMN "hubspotDealId" SET DEFAULT '',
    ALTER COLUMN "contractStart" SET DEFAULT '',
    ALTER COLUMN "contractEnd" SET DEFAULT '';

ALTER TABLE "Customer"
    ALTER COLUMN "becamePayingDate" SET DEFAULT '',
    ALTER COLUMN "bbid" SET DEFAULT '',
    ALTER COLUMN "subscriptionPlan" SET DEFAULT '',
    ALTER COLUMN "billingFrequency" SET DEFAULT '',
    ALTER COLUMN "billingPeriod" SET DEFAULT '',
    ALTER COLUMN "transactionsCount" SET DEFAULT 0,
    ALTER COLUMN "revenuesBase" SET DEFAULT 0;

ALTER TABLE "Transaction"
    ALTER COLUMN "currency" DROP DEFAULT,
    ALTER COLUMN "monthKey" SET DEFAULT '';

ALTER TABLE "Reward"
    ALTER COLUMN "currency" DROP DEFAULT,
    ALTER COLUMN "fromRewardRule" SET DEFAULT '';

ALTER TABLE "Payout"
    ALTER COLUMN "currency" DROP DEFAULT,
    ALTER COLUMN "periodFrom" SET DEFAULT '',
    ALTER COLUMN "periodTo" SET DEFAULT '',
    ALTER COLUMN "rewardsCount" SET DEFAULT 0,
    ALTER COLUMN "invoiceRef" SET DEFAULT '';

ALTER TABLE "Task"
    ALTER COLUMN "assignedTo" SET DEFAULT '',
    ALTER COLUMN "createdBy" SET DEFAULT '';

ALTER TABLE "BusinessPlan"
    ALTER COLUMN "partnerOwner" SET DEFAULT '',
    ALTER COLUMN "achievedPct" SET DEFAULT 0,
    ALTER COLUMN "targetRevBase" SET DEFAULT 0;

ALTER TABLE "AccountRecord"
    ALTER COLUMN "ownerName" SET DEFAULT '',
    ALTER COLUMN "ownerEmail" SET DEFAULT '',
    ALTER COLUMN "source" SET DEFAULT '',
    ALTER COLUMN "importedDate" SET DEFAULT '',
    ALTER COLUMN "hasOverlap" SET DEFAULT false,
    ALTER COLUMN "partnerName" SET DEFAULT '',
    ALTER COLUMN "partnerOwnerName" SET DEFAULT '',
    ALTER COLUMN "partnerOwnerEmail" SET DEFAULT '',
    ALTER COLUMN "overlapDate" SET DEFAULT '';

ALTER TABLE "Collaboration"
    ALTER COLUMN "status" SET DEFAULT 'New',
    ALTER COLUMN "owner" SET DEFAULT '',
    ALTER COLUMN "lastActivityDate" SET DEFAULT '';

ALTER TABLE "DataSource"
    ALTER COLUMN "sharedWith" SET DEFAULT '',
    ALTER COLUMN "type" SET DEFAULT 'CSV Upload',
    ALTER COLUMN "accountType" SET DEFAULT '',
    ALTER COLUMN "lastImportedDate" SET DEFAULT '',
    ALTER COLUMN "createdBy" SET DEFAULT '';

ALTER TABLE "TrackingLink"
    ALTER COLUMN "partnerName" SET DEFAULT '',
    ALTER COLUMN "uniqueVisitors" SET DEFAULT 0,
    ALTER COLUMN "leadsCount" SET DEFAULT 0,
    ALTER COLUMN "customersCount" SET DEFAULT 0,
    ALTER COLUMN "transactionsCount" SET DEFAULT 0,
    ALTER COLUMN "revenuesBase" SET DEFAULT 0;

ALTER TABLE "NoteItem"
    ALTER COLUMN "author" SET DEFAULT '';

ALTER TABLE "AuditLog"
    ALTER COLUMN "actor" SET DEFAULT '',
    ALTER COLUMN "actorRole" SET DEFAULT '';
