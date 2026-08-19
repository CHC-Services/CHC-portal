-- Reusable drawn e-signature per nurse, captured once and reused by future
-- signing flows (Progress Notes, etc.) instead of redrawing every time.
ALTER TABLE "NurseProfile" ADD COLUMN "signatureImageKey" TEXT;
ALTER TABLE "NurseProfile" ADD COLUMN "signatureSavedAt" TIMESTAMP(3);
