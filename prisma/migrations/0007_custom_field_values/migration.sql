-- Custom field values (R2b). Definitions stay in ManageItem (category "custom_properties").
-- Adds an empty JSON object to every record; nothing is changed or deleted.
ALTER TABLE "Partner" ADD COLUMN "customFieldsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "PartnerTeamMember" ADD COLUMN "customFieldsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Lead" ADD COLUMN "customFieldsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Deal" ADD COLUMN "customFieldsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Customer" ADD COLUMN "customFieldsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Transaction" ADD COLUMN "customFieldsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Reward" ADD COLUMN "customFieldsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Payout" ADD COLUMN "customFieldsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Task" ADD COLUMN "customFieldsJson" TEXT NOT NULL DEFAULT '{}';
