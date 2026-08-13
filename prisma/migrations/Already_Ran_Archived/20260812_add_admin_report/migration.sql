-- CreateTable: AdminReport — re-download index for admin's generated income/tax
-- report PDFs (the file itself lives in S3). Safe to re-run: every statement
-- below silently no-ops if it was already applied.
CREATE TABLE IF NOT EXISTS "AdminReport" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "filterKey" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminReport_reportType_idx" ON "AdminReport"("reportType");
