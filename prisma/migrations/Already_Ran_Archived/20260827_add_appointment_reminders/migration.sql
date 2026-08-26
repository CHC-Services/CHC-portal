-- CareCalendar: multi-day all-day appointments + reminder offsets.
-- allDay marks startTime/endTime as date boundaries rather than a same-day
-- time range; reminderChannel + AppointmentReminder back the reminder cron
-- (app/api/cron/appointment-reminders — day-level offsets only, since this
-- app's Vercel plan only allows daily crons).

ALTER TABLE "Appointment" ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN "reminderChannel" TEXT NOT NULL DEFAULT 'both';

CREATE TABLE "AppointmentReminder" (
  "id"            TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "offsetDays"    INTEGER NOT NULL,
  "sentAt"        TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AppointmentReminder" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "AppointmentReminder_appointmentId_idx" ON "AppointmentReminder"("appointmentId");
CREATE INDEX "AppointmentReminder_sentAt_idx" ON "AppointmentReminder"("sentAt");

ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
