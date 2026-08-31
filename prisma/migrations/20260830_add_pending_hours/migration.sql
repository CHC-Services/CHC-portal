-- Scheduling → Pending Hours: a scheduled Shift automatically generates one
-- PendingHour row per date-of-service segment (two for an overnight shift,
-- split at midnight). Nurse confirmation materializes a TimeEntry — the
-- existing invoice/campaign-discount pipeline never needs to know this
-- table exists.
CREATE TABLE "PendingHour" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dateOfService" TIMESTAMP(3) NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "scheduledHours" DOUBLE PRECISION NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "actualHours" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "timeEntryId" TEXT,
    "reassignedFromNurseId" TEXT,
    "reassignedAt" TIMESTAMP(3),
    "reassignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingHour_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PendingHour" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX "PendingHour_timeEntryId_key" ON "PendingHour"("timeEntryId");
CREATE UNIQUE INDEX "PendingHour_shiftId_nurseId_dateOfService_key" ON "PendingHour"("shiftId", "nurseId", "dateOfService");
CREATE INDEX "PendingHour_nurseId_status_idx" ON "PendingHour"("nurseId", "status");
CREATE INDEX "PendingHour_shiftId_idx" ON "PendingHour"("shiftId");

ALTER TABLE "PendingHour" ADD CONSTRAINT "PendingHour_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingHour" ADD CONSTRAINT "PendingHour_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PendingHour" ADD CONSTRAINT "PendingHour_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PendingHour" ADD CONSTRAINT "PendingHour_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
