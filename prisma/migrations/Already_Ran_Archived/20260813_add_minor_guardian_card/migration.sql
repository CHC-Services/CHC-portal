-- AlterTable: Patient — minor status + guardian contact card, shown/required
-- on the Demographics tab when isMinor is true.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "isMinor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "guardianFirstName" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "guardianLastName" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "guardianEmail" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "guardianPhone" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "guardianRelationship" TEXT;
