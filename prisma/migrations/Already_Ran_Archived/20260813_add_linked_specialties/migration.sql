-- AlterTable: Patient — provider specialties linked to this patient's care,
-- picked from a checklist on the Demographics tab.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "linkedSpecialties" TEXT[] NOT NULL DEFAULT '{}';
