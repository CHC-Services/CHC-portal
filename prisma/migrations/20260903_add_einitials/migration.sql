-- Reusable drawn e-initial, same pattern as the existing e-signature — for
-- MAR/TAR grid cells and anywhere else a quick initial mark is wanted
-- instead of a full signature.
ALTER TABLE "User" ADD COLUMN "initialsImageKey" TEXT;
ALTER TABLE "User" ADD COLUMN "initialsSavedAt" TIMESTAMP(3);
ALTER TABLE "NurseProfile" ADD COLUMN "initialsImageKey" TEXT;
ALTER TABLE "NurseProfile" ADD COLUMN "initialsSavedAt" TIMESTAMP(3);
