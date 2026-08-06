-- AlterTable: Claim — void tracking
ALTER TABLE "Claim" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "Claim" ADD COLUMN "voidReversalOf" TEXT;

-- AlterTable: MedicaidClaim — void tracking
ALTER TABLE "MedicaidClaim" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "MedicaidClaim" ADD COLUMN "voidReversalOf" TEXT;
