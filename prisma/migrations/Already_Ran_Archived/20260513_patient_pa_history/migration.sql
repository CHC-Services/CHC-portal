CREATE TABLE "PatientPA" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "paNumber" TEXT NOT NULL,
  "paStartDate" TEXT,
  "paEndDate" TEXT,
  "highTech" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientPA_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientPA_patientId_idx" ON "PatientPA"("patientId");

ALTER TABLE "PatientPA"
  ADD CONSTRAINT "PatientPA_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
