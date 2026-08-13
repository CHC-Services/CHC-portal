-- AlterTable: add provider obligation (write-off) columns to Claim
ALTER TABLE "Claim" ADD COLUMN "primaryCO" DOUBLE PRECISION;
ALTER TABLE "Claim" ADD COLUMN "secondaryCO" DOUBLE PRECISION;
