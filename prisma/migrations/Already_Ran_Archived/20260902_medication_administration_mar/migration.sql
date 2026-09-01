-- Digital Medication Administration Record (MAR): fixed daily schedule times
-- per medication, and the actual per-dose administration log.

CREATE TABLE "MedicationScheduleTime" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationScheduleTime_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MedicationScheduleTime_medicationId_idx" ON "MedicationScheduleTime"("medicationId");
ALTER TABLE "MedicationScheduleTime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicationScheduleTime" ADD CONSTRAINT "MedicationScheduleTime_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "PatientMedication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MedicationAdministration" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledTimeOfDay" TEXT,
    "scheduleTimeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'given',
    "omissionReason" TEXT,
    "administeredByUserId" TEXT,
    "administeredByRole" TEXT,
    "administeredByDisplayNameSnapshot" TEXT,
    "administeredAt" TIMESTAMP(3),
    "documentedByUserId" TEXT NOT NULL,
    "documentedByRole" TEXT NOT NULL,
    "documentedByDisplayNameSnapshot" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationAdministration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MedicationAdministration_medicationId_scheduledDate_schedu_key" ON "MedicationAdministration"("medicationId", "scheduledDate", "scheduledTimeOfDay");
CREATE INDEX "MedicationAdministration_patientId_idx" ON "MedicationAdministration"("patientId");
CREATE INDEX "MedicationAdministration_medicationId_scheduledDate_idx" ON "MedicationAdministration"("medicationId", "scheduledDate");
ALTER TABLE "MedicationAdministration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "PatientMedication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_scheduleTimeId_fkey" FOREIGN KEY ("scheduleTimeId") REFERENCES "MedicationScheduleTime"("id") ON DELETE SET NULL ON UPDATE CASCADE;
