-- AlterTable: Claim — add Medicaid pay-cycle fields (mirrors MedicaidClaim.estPayCycle/depositDate)
ALTER TABLE "Claim" ADD COLUMN "estPayCycle" INTEGER;
ALTER TABLE "Claim" ADD COLUMN "depositDate" TIMESTAMP(3);
