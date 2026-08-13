-- CreateTable: Pharmacy
CREATE TABLE "Pharmacy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Pharmacy_name_idx" ON "Pharmacy"("name");

-- AlterTable: PatientMedication — replace free-text pharmacy fields with a shared FK
ALTER TABLE "PatientMedication" DROP COLUMN "pharmacyName";
ALTER TABLE "PatientMedication" DROP COLUMN "pharmacyPhone";
ALTER TABLE "PatientMedication" ADD COLUMN "pharmacyId" TEXT;

CREATE INDEX "PatientMedication_pharmacyId_idx" ON "PatientMedication"("pharmacyId");

ALTER TABLE "PatientMedication" ADD CONSTRAINT "PatientMedication_pharmacyId_fkey"
    FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
