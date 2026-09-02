-- Over-the-counter medication flag — exempts a PatientMedication from
-- refill-reminder date math and the reminder cron's SMS notifications.

ALTER TABLE "PatientMedication" ADD COLUMN "isOtc" BOOLEAN NOT NULL DEFAULT false;
