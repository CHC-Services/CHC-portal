-- Caches the rendered PDF packet for a signed Progress Note (lib/progressNotePdf.ts),
-- mirroring Invoice.s3Key's regenerate-on-demand / invalidate-on-change pattern.
ALTER TABLE "ProgressNote" ADD COLUMN "pdfS3Key" TEXT;
