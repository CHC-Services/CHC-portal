-- AlterTable: PatientMedication — order duration ("30 days", "Ongoing", etc.),
-- picked from a dropdown at the end of the SIG sentence in the UI.
-- Safe to re-run: IF NOT EXISTS makes this idempotent.
ALTER TABLE "PatientMedication" ADD COLUMN IF NOT EXISTS "duration" TEXT;
