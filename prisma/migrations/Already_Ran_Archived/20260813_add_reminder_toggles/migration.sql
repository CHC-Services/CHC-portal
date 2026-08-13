-- AlterTable: Patient — patient-wide, admin-controlled reminder toggles for the
-- new "Notifications & Reminders" tab.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "documentRemindersEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "paRemindersEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: PatientDocument / PatientPA — marks when the expiration reminder
-- for that record has already fired, so the cron doesn't resend it.
ALTER TABLE "PatientDocument" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "PatientPA" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
