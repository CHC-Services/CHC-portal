-- Treatment Administration Record (TAR): non-medication clinical tasks
-- (wound care, ROM exercises, etc.) and the per-day initialed log.

CREATE TABLE "PatientTreatment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "treatmentName" TEXT NOT NULL,
    "instructions" TEXT,
    "frequency" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientTreatment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PatientTreatment_patientId_idx" ON "PatientTreatment"("patientId");
ALTER TABLE "PatientTreatment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientTreatment" ADD CONSTRAINT "PatientTreatment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TreatmentAdministration" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'done',
    "omissionReason" TEXT,
    "initialedByUserId" TEXT NOT NULL,
    "initialedByRole" TEXT NOT NULL,
    "initialedByDisplayNameSnapshot" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentAdministration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TreatmentAdministration_treatmentId_scheduledDate_key" ON "TreatmentAdministration"("treatmentId", "scheduledDate");
CREATE INDEX "TreatmentAdministration_patientId_idx" ON "TreatmentAdministration"("patientId");
CREATE INDEX "TreatmentAdministration_treatmentId_scheduledDate_idx" ON "TreatmentAdministration"("treatmentId", "scheduledDate");
ALTER TABLE "TreatmentAdministration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreatmentAdministration" ADD CONSTRAINT "TreatmentAdministration_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "PatientTreatment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreatmentAdministration" ADD CONSTRAINT "TreatmentAdministration_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
