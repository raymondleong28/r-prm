-- F8: Explicit program -> onboarding pipeline assignment
ALTER TABLE "Program" ADD COLUMN "onboardingPipelineId" TEXT NOT NULL DEFAULT 'Strategic Partner';
UPDATE "Program" SET "onboardingPipelineId" = 'Fast-Track Referral' WHERE "id" = 'prog-referral';

-- F2: Random hashed & encrypted lead-form token per partner
ALTER TABLE "Partner" ADD COLUMN "leadFormTokenHash" TEXT;
ALTER TABLE "Partner" ADD COLUMN "leadFormTokenCipher" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "Partner_leadFormTokenHash_key" ON "Partner"("leadFormTokenHash");

-- F7: Database-backed login lockout counters
CREATE TABLE "LoginLockout" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLockout_pkey" PRIMARY KEY ("key")
);

-- F6: Migrate all money columns from Float to Integer minor units (cents)
ALTER TABLE "Program"
    ALTER COLUMN "sourcedRevenue365d" SET DEFAULT 0,
    ALTER COLUMN "sourcedRevenue365d" TYPE INTEGER USING ROUND("sourcedRevenue365d" * 100)::INTEGER,
    ALTER COLUMN "influencedRev365d" SET DEFAULT 0,
    ALTER COLUMN "influencedRev365d" TYPE INTEGER USING ROUND("influencedRev365d" * 100)::INTEGER;

ALTER TABLE "Partner"
    ALTER COLUMN "pendingRewardsAll" SET DEFAULT 0,
    ALTER COLUMN "pendingRewardsAll" TYPE INTEGER USING ROUND("pendingRewardsAll" * 100)::INTEGER,
    ALTER COLUMN "sourcedRevenue365d" SET DEFAULT 0,
    ALTER COLUMN "sourcedRevenue365d" TYPE INTEGER USING ROUND("sourcedRevenue365d" * 100)::INTEGER,
    ALTER COLUMN "influencedRev365d" SET DEFAULT 0,
    ALTER COLUMN "influencedRev365d" TYPE INTEGER USING ROUND("influencedRev365d" * 100)::INTEGER;

ALTER TABLE "Deal"
    ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER,
    ALTER COLUMN "amountSgd" TYPE INTEGER USING ROUND("amountSgd" * 100)::INTEGER;

ALTER TABLE "Customer"
    ALTER COLUMN "revenuesSgd" DROP DEFAULT,
    ALTER COLUMN "revenuesSgd" TYPE INTEGER USING ROUND("revenuesSgd" * 100)::INTEGER,
    ALTER COLUMN "revenuesSgd" SET DEFAULT 1480000;

ALTER TABLE "Transaction"
    ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER,
    ALTER COLUMN "amountSgd" TYPE INTEGER USING ROUND("amountSgd" * 100)::INTEGER;

ALTER TABLE "Reward"
    ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER,
    ALTER COLUMN "amountSgd" TYPE INTEGER USING ROUND("amountSgd" * 100)::INTEGER;

ALTER TABLE "Payout"
    ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER,
    ALTER COLUMN "amountSgd" TYPE INTEGER USING ROUND("amountSgd" * 100)::INTEGER;

ALTER TABLE "BusinessPlan"
    ALTER COLUMN "targetRevSgd" DROP DEFAULT,
    ALTER COLUMN "targetRevSgd" TYPE INTEGER USING ROUND("targetRevSgd" * 100)::INTEGER,
    ALTER COLUMN "targetRevSgd" SET DEFAULT 10000000;

ALTER TABLE "TrackingLink"
    ALTER COLUMN "revenuesSgd" DROP DEFAULT,
    ALTER COLUMN "revenuesSgd" TYPE INTEGER USING ROUND("revenuesSgd" * 100)::INTEGER,
    ALTER COLUMN "revenuesSgd" SET DEFAULT 2840000;
