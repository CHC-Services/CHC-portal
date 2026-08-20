-- Stops account deletion from destroying signed clinical records. Previously
-- ProgressNote.authorUser / ProgressNoteAddendum.authorUser were ON DELETE
-- CASCADE, so deleting a nurse's account permanently destroyed every note
-- she ever signed, for every patient. Now the FK is SET NULL, and a frozen
-- authorDisplayNameSnapshot (captured at sign time, same idea as the existing
-- signatureImageKey snapshot) keeps the record fully attributable even after
-- the User row is gone.

ALTER TABLE "ProgressNote" DROP CONSTRAINT "ProgressNote_authorUserId_fkey";
ALTER TABLE "ProgressNote" ALTER COLUMN "authorUserId" DROP NOT NULL;
ALTER TABLE "ProgressNote" ADD COLUMN "authorDisplayNameSnapshot" TEXT;
ALTER TABLE "ProgressNote" ADD CONSTRAINT "ProgressNote_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProgressNoteAddendum" DROP CONSTRAINT "ProgressNoteAddendum_authorUserId_fkey";
ALTER TABLE "ProgressNoteAddendum" ALTER COLUMN "authorUserId" DROP NOT NULL;
ALTER TABLE "ProgressNoteAddendum" ADD COLUMN "authorDisplayNameSnapshot" TEXT;
ALTER TABLE "ProgressNoteAddendum" ADD CONSTRAINT "ProgressNoteAddendum_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: freeze the current live name onto every already-signed note /
-- existing addendum, so nothing sits unattributed between this migration and
-- the next time each record happens to be touched. Mirrors
-- lib/progressNoteAuthor.ts's authorDisplayName() exactly: nurse-authored
-- prefers NurseProfile.displayName, everything else uses User.name only —
-- an admin may incidentally have a NurseProfile row (profile cards lazily
-- create one for any role), so this must not fall through to it for admins.
UPDATE "ProgressNote" pn
SET "authorDisplayNameSnapshot" = CASE
  WHEN pn."authorRole" = 'nurse' THEN COALESCE(np."displayName", u."name")
  ELSE u."name"
END
FROM "User" u
LEFT JOIN "NurseProfile" np ON np."userId" = u."id"
WHERE pn."authorUserId" = u."id"
  AND pn."signedAt" IS NOT NULL
  AND pn."authorDisplayNameSnapshot" IS NULL;

UPDATE "ProgressNoteAddendum" pna
SET "authorDisplayNameSnapshot" = CASE
  WHEN pna."authorRole" = 'nurse' THEN COALESCE(np."displayName", u."name")
  ELSE u."name"
END
FROM "User" u
LEFT JOIN "NurseProfile" np ON np."userId" = u."id"
WHERE pna."authorUserId" = u."id"
  AND pna."authorDisplayNameSnapshot" IS NULL;
