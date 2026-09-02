-- As-needed (PRN) flag on PatientMedication — same refill-reminder/cron
-- exemption as the existing isOtc column, plus its own summary-chart badge.
ALTER TABLE "PatientMedication" ADD COLUMN "isPrn" BOOLEAN NOT NULL DEFAULT false;
