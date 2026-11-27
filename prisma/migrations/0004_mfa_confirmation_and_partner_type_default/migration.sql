-- Two-step login: a TOTP secret stays "pending" until the user proves it works with a valid code.
-- Existing rows keep their values; secrets in the old non-standard format are treated as not enrolled
-- by the application and replaced on the user's next enrolment (no data is deleted here).
ALTER TABLE "User" ADD COLUMN "mfaConfirmedAt" TIMESTAMP(3);

-- New partners no longer get a made-up partner type ("Reseller"); existing rows keep their value.
ALTER TABLE "Partner" ALTER COLUMN "partnerType" SET DEFAULT '';
