-- Guardian/admin-facing demographic fields on User, collected in the shared
-- post-signup "Your Information" step. Nurses keep using NurseProfile's own
-- copies of these fields as authoritative (same asymmetry as signatureImageKey).
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "dob" TEXT;
ALTER TABLE "User" ADD COLUMN "address" TEXT;
ALTER TABLE "User" ADD COLUMN "city" TEXT;
ALTER TABLE "User" ADD COLUMN "state" TEXT;
ALTER TABLE "User" ADD COLUMN "zip" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Guardian approval trail: null approvedAt = pending, cannot view the patient's
-- data until an existing approved guardian on that patient approves them.
ALTER TABLE "GuardianPatient" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "GuardianPatient" ADD COLUMN "approvedByUserId" TEXT;

-- Every existing link was created via invite (implicitly trusted) — backfill
-- as already-approved so nothing already-linked becomes newly restricted.
UPDATE "GuardianPatient" SET "approvedAt" = "createdAt" WHERE "approvedAt" IS NULL;
