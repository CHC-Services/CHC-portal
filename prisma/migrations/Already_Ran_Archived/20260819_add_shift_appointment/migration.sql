-- HomeCalendar foundation: nursing shift scheduling (with open-shift claiming)
-- and patient appointments. Both are new sources of truth (not sync tables) --
-- calendar aggregation happens at read time in lib/calendarFeed.ts.

CREATE TABLE "Shift" (
  "id"              TEXT NOT NULL,
  "patientId"       TEXT NOT NULL,
  "nurseId"         TEXT,
  "startTime"       TIMESTAMP(3) NOT NULL,
  "endTime"         TIMESTAMP(3) NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'open',
  "notes"           TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdByRole"   TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Shift" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "Shift_patientId_idx" ON "Shift"("patientId");
CREATE INDEX "Shift_nurseId_idx" ON "Shift"("nurseId");
CREATE INDEX "Shift_startTime_idx" ON "Shift"("startTime");
CREATE INDEX "Shift_status_idx" ON "Shift"("status");

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_nurseId_fkey"
  FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Appointment" (
  "id"              TEXT NOT NULL,
  "patientId"       TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "location"        TEXT,
  "provider"        TEXT,
  "startTime"       TIMESTAMP(3) NOT NULL,
  "endTime"         TIMESTAMP(3),
  "notes"           TEXT,
  "status"          TEXT NOT NULL DEFAULT 'scheduled',
  "createdByUserId" TEXT NOT NULL,
  "createdByRole"   TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX "Appointment_startTime_idx" ON "Appointment"("startTime");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
