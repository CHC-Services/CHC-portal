-- Adds Active?/Outcome to the existing MedicaidStatusCode table so the
-- payer-status-code lookup (F1, 3, F2, 483, A7, P0, 0, A3, 400, P4, ...)
-- can drive both a management UI and the claim card's Remark Codes display.
ALTER TABLE "MedicaidStatusCode" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MedicaidStatusCode" ADD COLUMN "outcome" TEXT;
