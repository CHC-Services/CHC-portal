-- AlterTable: PatientMedication — split on-hand strength/form into two fields
-- (unitStrength stays the amount, e.g. "10mg"; unitType is new, e.g. "tablet")
-- and add "route" for the prescribed administration route (e.g. "G-Tube").
-- Safe to re-run: IF NOT EXISTS makes every statement idempotent.
ALTER TABLE "PatientMedication" ADD COLUMN IF NOT EXISTS "unitType" TEXT;
ALTER TABLE "PatientMedication" ADD COLUMN IF NOT EXISTS "route" TEXT;
