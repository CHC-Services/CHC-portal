-- CreateTable: PatientDocument
CREATE TABLE "PatientDocument" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedByRole" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientDocument_patientId_idx" ON "PatientDocument"("patientId");
CREATE INDEX "PatientDocument_expiresAt_idx" ON "PatientDocument"("expiresAt");

ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
