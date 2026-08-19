-- Progress Notes: nurse-authored, signed clinical flowsheet documentation
-- (header + vitals rows + intake/output rows), plus a snapshot-on-save
-- version history mirroring ClaimAuditLog's existing pattern.

CREATE TABLE "ProgressNote" (
  "id"                TEXT NOT NULL,
  "patientId"         TEXT NOT NULL,
  "authorNurseId"     TEXT NOT NULL,
  "shiftId"           TEXT,
  "serviceDate"       TIMESTAMP(3) NOT NULL,
  "shiftStartTime"    TEXT,
  "shiftEndTime"      TEXT,
  "totalHours"        DOUBLE PRECISION,
  "arrivalFindings"   TEXT,
  "shiftNotes"        TEXT,
  "signedAt"          TIMESTAMP(3),
  "signatureImageKey" TEXT,
  "voidedAt"          TIMESTAMP(3),
  "voidedByUserId"    TEXT,
  "voidReason"        TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgressNote_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ProgressNote" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "ProgressNote_patientId_idx" ON "ProgressNote"("patientId");
CREATE INDEX "ProgressNote_authorNurseId_idx" ON "ProgressNote"("authorNurseId");
CREATE INDEX "ProgressNote_shiftId_idx" ON "ProgressNote"("shiftId");
CREATE INDEX "ProgressNote_serviceDate_idx" ON "ProgressNote"("serviceDate");

ALTER TABLE "ProgressNote" ADD CONSTRAINT "ProgressNote_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressNote" ADD CONSTRAINT "ProgressNote_authorNurseId_fkey"
  FOREIGN KEY ("authorNurseId") REFERENCES "NurseProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressNote" ADD CONSTRAINT "ProgressNote_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProgressNoteVital" (
  "id"             TEXT NOT NULL,
  "progressNoteId" TEXT NOT NULL,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "time"           TEXT,
  "temp"           TEXT,
  "hr"             TEXT,
  "rr"             TEXT,
  "skin"           TEXT,
  "o2Flow"         TEXT,
  "o2Route"        TEXT,
  "o2Percent"      TEXT,
  "lungSounds"     TEXT,
  "txNeeded"       TEXT,
  "suction"        TEXT,
  CONSTRAINT "ProgressNoteVital_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ProgressNoteVital" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "ProgressNoteVital_progressNoteId_idx" ON "ProgressNoteVital"("progressNoteId");

ALTER TABLE "ProgressNoteVital" ADD CONSTRAINT "ProgressNoteVital_progressNoteId_fkey"
  FOREIGN KEY ("progressNoteId") REFERENCES "ProgressNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProgressNoteIntakeOutput" (
  "id"             TEXT NOT NULL,
  "progressNoteId" TEXT NOT NULL,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "time"           TEXT,
  "intakeType"     TEXT,
  "intakeAmt"      TEXT,
  "intakeRoute"    TEXT,
  "outputUrine"    TEXT,
  "outputBM"       TEXT,
  "outputEmesis"   TEXT,
  CONSTRAINT "ProgressNoteIntakeOutput_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ProgressNoteIntakeOutput" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "ProgressNoteIntakeOutput_progressNoteId_idx" ON "ProgressNoteIntakeOutput"("progressNoteId");

ALTER TABLE "ProgressNoteIntakeOutput" ADD CONSTRAINT "ProgressNoteIntakeOutput_progressNoteId_fkey"
  FOREIGN KEY ("progressNoteId") REFERENCES "ProgressNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProgressNoteRevision" (
  "id"             TEXT NOT NULL,
  "progressNoteId" TEXT NOT NULL,
  "snapshot"       JSONB NOT NULL,
  "savedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "savedBy"        TEXT NOT NULL,
  CONSTRAINT "ProgressNoteRevision_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ProgressNoteRevision" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "ProgressNoteRevision_progressNoteId_idx" ON "ProgressNoteRevision"("progressNoteId");
CREATE INDEX "ProgressNoteRevision_savedAt_idx" ON "ProgressNoteRevision"("savedAt");
