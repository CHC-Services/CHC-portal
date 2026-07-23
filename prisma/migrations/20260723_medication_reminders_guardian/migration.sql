-- AlterTable: opt-in flag for existing nurse-patient links
ALTER TABLE "NursePatient" ADD COLUMN "medicationRemindersOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: PatientMedication
CREATE TABLE "PatientMedication" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "daySupply" INTEGER NOT NULL DEFAULT 30,
    "lastFillDate" TIMESTAMP(3) NOT NULL,
    "rxNumber" TEXT,
    "refillsRemaining" INTEGER,
    "pharmacyName" TEXT,
    "pharmacyPhone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientMedication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientMedication_patientId_idx" ON "PatientMedication"("patientId");

ALTER TABLE "PatientMedication" ADD CONSTRAINT "PatientMedication_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: GuardianPatient
CREATE TABLE "GuardianPatient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationRemindersOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianPatient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianPatient_userId_patientId_key" ON "GuardianPatient"("userId", "patientId");
CREATE INDEX "GuardianPatient_userId_idx" ON "GuardianPatient"("userId");
CREATE INDEX "GuardianPatient_patientId_idx" ON "GuardianPatient"("patientId");

ALTER TABLE "GuardianPatient" ADD CONSTRAINT "GuardianPatient_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianPatient" ADD CONSTRAINT "GuardianPatient_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
