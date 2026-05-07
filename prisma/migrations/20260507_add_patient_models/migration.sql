-- Patient canonical record table
CREATE TABLE IF NOT EXISTS "Patient" (
  "id"            TEXT         NOT NULL,
  "accountNumber" TEXT         NOT NULL,
  "lastName"      TEXT         NOT NULL,
  "firstName"     TEXT         NOT NULL,
  "dob"           TEXT         NOT NULL,
  "gender"        TEXT,
  "insuranceType" TEXT         NOT NULL DEFAULT 'Medicaid',
  "insuranceId"   TEXT         NOT NULL,
  "insuranceName"  TEXT,
  "insuranceGroup" TEXT,
  "insurancePlan"  TEXT,
  "address"       TEXT,
  "city"          TEXT,
  "state"         TEXT,
  "zip"           TEXT,
  "phone"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Patient_accountNumber_key" ON "Patient"("accountNumber");

-- Per-nurse link + override layer
CREATE TABLE IF NOT EXISTS "NursePatient" (
  "id"        TEXT         NOT NULL,
  "nurseId"   TEXT         NOT NULL,
  "patientId" TEXT         NOT NULL,
  "overrides" JSONB,
  "isActive"  BOOLEAN      NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NursePatient_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NursePatient"
  ADD CONSTRAINT "NursePatient_nurseId_fkey"
  FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NursePatient"
  ADD CONSTRAINT "NursePatient_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "NursePatient_nurseId_patientId_key"
  ON "NursePatient"("nurseId", "patientId");

CREATE INDEX IF NOT EXISTS "NursePatient_nurseId_idx"   ON "NursePatient"("nurseId");
CREATE INDEX IF NOT EXISTS "NursePatient_patientId_idx" ON "NursePatient"("patientId");

-- Add optional patient reference to time entries
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "patientId" TEXT;

ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "TimeEntry_patientId_idx" ON "TimeEntry"("patientId");
