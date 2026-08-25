-- CareCalendar Phase 2: recurring shift-generation rules. ShiftTemplate holds
-- the recurrence rule only; lib/shiftTemplates.ts materializes it forward into
-- real Shift rows (Shift.templateId links back), both inline on create/edit
-- and via the daily materialize-shift-templates cron.

CREATE TABLE "ShiftTemplate" (
  "id"              TEXT NOT NULL,
  "patientId"       TEXT NOT NULL,
  "nurseId"         TEXT,
  "startTimeOfDay"  TEXT NOT NULL,
  "durationHours"   INTEGER NOT NULL,
  "recurrence"      TEXT NOT NULL,
  "daysOfWeek"      INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "activeFrom"      TIMESTAMP(3) NOT NULL,
  "activeUntil"     TIMESTAMP(3),
  "notes"           TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "createdByRole"   TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ShiftTemplate" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "ShiftTemplate_patientId_idx" ON "ShiftTemplate"("patientId");
CREATE INDEX "ShiftTemplate_isActive_idx" ON "ShiftTemplate"("isActive");

ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_nurseId_fkey"
  FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Shift" ADD COLUMN "templateId" TEXT;
CREATE INDEX "Shift_templateId_idx" ON "Shift"("templateId");
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
