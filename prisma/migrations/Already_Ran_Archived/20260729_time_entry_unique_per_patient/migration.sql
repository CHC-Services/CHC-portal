-- Replace the (nurseId, workDate) unique index with one that also includes
-- patientId, so a nurse can have separate entries for the same date as long
-- as they're for different patients.
DROP INDEX "TimeEntry_nurseId_workDate_key";

CREATE UNIQUE INDEX "TimeEntry_nurseId_workDate_patientId_key"
  ON "TimeEntry"("nurseId", "workDate", "patientId");
