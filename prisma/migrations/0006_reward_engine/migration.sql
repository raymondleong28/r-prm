-- Reward engine: link transactions to customers, stop double-paying, unique reward numbers.

-- 1. Transactions point at their customer record (backfilled by exact customer name, case-insensitive).
ALTER TABLE "Transaction" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Transaction_customerId_idx" ON "Transaction"("customerId");
UPDATE "Transaction" t SET "customerId" = c."id"
  FROM "Customer" c
  WHERE t."customerId" IS NULL AND lower(trim(t."customerName")) = lower(trim(c."name")) AND trim(t."customerName") <> '';

-- 2. One reward per rule per source event.
ALTER TABLE "Reward" ADD COLUMN "sourceKey" TEXT;
CREATE UNIQUE INDEX "Reward_sourceKey_key" ON "Reward"("sourceKey");

-- 3. Reward numbers come from a sequence (RW-<n>), starting after the highest existing number.
CREATE SEQUENCE IF NOT EXISTS "reward_number_seq" START 1000;
SELECT setval('"reward_number_seq"', GREATEST(
  1000,
  COALESCE((SELECT MAX(NULLIF(regexp_replace("rewardNumber", '[^0-9]', '', 'g'), '')::BIGINT) FROM "Reward"), 0)
));
