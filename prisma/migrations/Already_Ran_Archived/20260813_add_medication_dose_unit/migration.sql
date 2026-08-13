-- AlterTable: PatientMedication — split the prescribed dose into a numeric
-- "dose" plus a standardized "doseUnit" picked from a dropdown in the UI
-- (mg, mL, tablet, etc.), instead of one free-text field like "15mg".
-- Safe to re-run: IF NOT EXISTS makes this idempotent.
ALTER TABLE "PatientMedication" ADD COLUMN IF NOT EXISTS "doseUnit" TEXT;
