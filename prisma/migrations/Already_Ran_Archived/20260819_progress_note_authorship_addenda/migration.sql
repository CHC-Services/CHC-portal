-- Generalizes Progress Note authorship from nurse-only (authorNurseId ->
-- NurseProfile) to any User (authorUserId -> User, + authorRole 'nurse'|
-- 'admin'), since admin accounts have no NurseProfile row. Also adds a
-- stored-signature slot on User for non-nurse authors, and a new
-- ProgressNoteAddendum table for appended, separately-signed corrections
-- that never alter an already-signed note's original content.

ALTER TABLE "User" ADD COLUMN "signatureImageKey" TEXT;
ALTER TABLE "User" ADD COLUMN "signatureSavedAt" TIMESTAMP(3);

-- Backfill authorUserId/authorRole from the existing nurse-only FK before
-- dropping it. Safe no-op if ProgressNote is empty.
ALTER TABLE "ProgressNote" ADD COLUMN "authorUserId" TEXT;
ALTER TABLE "ProgressNote" ADD COLUMN "authorRole" TEXT;

UPDATE "ProgressNote" pn
SET "authorUserId" = np."userId", "authorRole" = 'nurse'
FROM "NurseProfile" np
WHERE pn."authorNurseId" = np.id;

ALTER TABLE "ProgressNote" ALTER COLUMN "authorUserId" SET NOT NULL;
ALTER TABLE "ProgressNote" ALTER COLUMN "authorRole" SET NOT NULL;

ALTER TABLE "ProgressNote" DROP CONSTRAINT "ProgressNote_authorNurseId_fkey";
DROP INDEX "ProgressNote_authorNurseId_idx";
ALTER TABLE "ProgressNote" DROP COLUMN "authorNurseId";

ALTER TABLE "ProgressNote" ADD CONSTRAINT "ProgressNote_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ProgressNote_authorUserId_idx" ON "ProgressNote"("authorUserId");

CREATE TABLE "ProgressNoteAddendum" (
  "id"                TEXT NOT NULL,
  "progressNoteId"    TEXT NOT NULL,
  "authorUserId"      TEXT NOT NULL,
  "authorRole"        TEXT NOT NULL,
  "text"              TEXT NOT NULL,
  "signatureImageKey" TEXT NOT NULL,
  "signedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressNoteAddendum_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ProgressNoteAddendum" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "ProgressNoteAddendum_progressNoteId_idx" ON "ProgressNoteAddendum"("progressNoteId");

ALTER TABLE "ProgressNoteAddendum" ADD CONSTRAINT "ProgressNoteAddendum_progressNoteId_fkey"
  FOREIGN KEY ("progressNoteId") REFERENCES "ProgressNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressNoteAddendum" ADD CONSTRAINT "ProgressNoteAddendum_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
