-- AlterTable: strength of the tablet/unit on hand, so it can be compared against
-- the patient's prescribed dose to derive units-per-dose (e.g. 15mg dose / 10mg
-- tablet = 1.5 tablets).
ALTER TABLE "PatientMedication" ADD COLUMN "unitStrength" TEXT;
