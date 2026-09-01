-- Partial open-shift claiming: per-patient approval toggle, interim admin
-- notification toggle, an SMS send log (mirrors EmailLog), and the
-- pending-approval request table.

ALTER TABLE "User" ADD COLUMN "notifyPartialShiftClaim" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Patient" ADD COLUMN "partialShiftClaimsRequireApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientName" TEXT,
    "recipientPhone" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SmsLog_sentAt_idx" ON "SmsLog"("sentAt");
CREATE INDEX "SmsLog_recipientPhone_idx" ON "SmsLog"("recipientPhone");
ALTER TABLE "SmsLog" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "ShiftClaimRequest" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "requestedStart" TIMESTAMP(3) NOT NULL,
    "requestedEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftClaimRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShiftClaimRequest_shiftId_idx" ON "ShiftClaimRequest"("shiftId");
CREATE INDEX "ShiftClaimRequest_nurseId_idx" ON "ShiftClaimRequest"("nurseId");
CREATE INDEX "ShiftClaimRequest_status_idx" ON "ShiftClaimRequest"("status");
ALTER TABLE "ShiftClaimRequest" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ShiftClaimRequest" ADD CONSTRAINT "ShiftClaimRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftClaimRequest" ADD CONSTRAINT "ShiftClaimRequest_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftClaimRequest" ADD CONSTRAINT "ShiftClaimRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
