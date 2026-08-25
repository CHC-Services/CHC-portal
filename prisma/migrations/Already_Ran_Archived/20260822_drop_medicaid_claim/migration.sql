-- Legacy MedicaidClaim table is fully retired. All new claims (every payer,
-- including Medicaid) have landed in the unified Claim table since the April
-- 2026 "Add Claim" form consolidation. The one remaining row was confirmed to
-- be leftover test data (patientCtrlNum "LLTEST123") and was deleted via the
-- app's Prisma client before this migration was written.
DROP TABLE "MedicaidClaim";
