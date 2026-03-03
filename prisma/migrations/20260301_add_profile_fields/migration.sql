-- Add name to User and extra fields to NurseProfile
ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';

ALTER TABLE "NurseProfile" ADD COLUMN "address" TEXT;
ALTER TABLE "NurseProfile" ADD COLUMN "city" TEXT;
ALTER TABLE "NurseProfile" ADD COLUMN "state" TEXT;
ALTER TABLE "NurseProfile" ADD COLUMN "zip" TEXT;
ALTER TABLE "NurseProfile" ADD COLUMN "npiNumber" TEXT;
ALTER TABLE "NurseProfile" ADD COLUMN "medicaidNumber" TEXT;
ALTER TABLE "NurseProfile" ADD COLUMN "billingInfo" TEXT;
