-- AlterTable: tracks an in-flight refill order ("RX Ordered" but not yet picked
-- up). Due/Overdue/Filled are computed on read from existing date fields — only
-- this sticky "an order is in flight" fact needs to persist.
-- Safe to re-run: IF NOT EXISTS makes each ADD COLUMN a silent no-op if already applied.
ALTER TABLE "PatientMedication" ADD COLUMN IF NOT EXISTS "refillOrderedAt" TIMESTAMP(3);
ALTER TABLE "PatientMedication" ADD COLUMN IF NOT EXISTS "refillOrderedByUserId" TEXT;
ALTER TABLE "PatientMedication" ADD COLUMN IF NOT EXISTS "refillOrderedByRole" TEXT;
