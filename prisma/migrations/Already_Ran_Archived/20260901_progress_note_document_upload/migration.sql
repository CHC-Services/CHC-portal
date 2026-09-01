-- Progress note document upload — a nurse can attach an uploaded file (e.g.
-- a scanned paper note) as the record itself instead of typing shiftNotes.
ALTER TABLE "ProgressNote" ADD COLUMN "documentStorageKey" TEXT;
ALTER TABLE "ProgressNote" ADD COLUMN "documentFileName" TEXT;
ALTER TABLE "ProgressNote" ADD COLUMN "documentMimeType" TEXT;
ALTER TABLE "ProgressNote" ADD COLUMN "documentFileSize" INTEGER;
