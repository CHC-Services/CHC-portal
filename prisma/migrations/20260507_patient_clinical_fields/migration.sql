-- Add clinical / billing fields to Patient table
ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "highTech"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dxCode1"             TEXT,
  ADD COLUMN IF NOT EXISTS "dxCode2"             TEXT,
  ADD COLUMN IF NOT EXISTS "dxCode3"             TEXT,
  ADD COLUMN IF NOT EXISTS "dxCode4"             TEXT,
  ADD COLUMN IF NOT EXISTS "paNumber"            TEXT,
  ADD COLUMN IF NOT EXISTS "paStartDate"         TEXT,
  ADD COLUMN IF NOT EXISTS "paEndDate"           TEXT,
  ADD COLUMN IF NOT EXISTS "subscriberName"      TEXT,
  ADD COLUMN IF NOT EXISTS "subscriberRelation"  TEXT,
  ADD COLUMN IF NOT EXISTS "networkStatus"       TEXT,
  ADD COLUMN IF NOT EXISTS "hasCaseRate"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "caseRateAmount"      TEXT,
  ADD COLUMN IF NOT EXISTS "policyNotes"         TEXT;
