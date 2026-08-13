-- NurseProfile.credentials: e.g. "RN", "LPN" — surfaced on the "Recorded by"
-- note under an order's title when that nurse uploaded it.
ALTER TABLE "NurseProfile" ADD COLUMN IF NOT EXISTS "credentials" TEXT;

-- PatientDocument: structured fields used only when category = 'Orders'.
ALTER TABLE "PatientDocument" ADD COLUMN IF NOT EXISTS "orderDate" TEXT;
ALTER TABLE "PatientDocument" ADD COLUMN IF NOT EXISTS "orderEndDate" TEXT;
ALTER TABLE "PatientDocument" ADD COLUMN IF NOT EXISTS "providerName" TEXT;
ALTER TABLE "PatientDocument" ADD COLUMN IF NOT EXISTS "specialty" TEXT;
ALTER TABLE "PatientDocument" ADD COLUMN IF NOT EXISTS "orderNotes" TEXT;
