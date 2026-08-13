-- AlterTable: GuardianPatient — relationship title + HIPAA acknowledgment audit trail
ALTER TABLE "GuardianPatient" ADD COLUMN "relationship" TEXT;
ALTER TABLE "GuardianPatient" ADD COLUMN "invitedByUserId" TEXT;
ALTER TABLE "GuardianPatient" ADD COLUMN "hipaaAcknowledgedAt" TIMESTAMP(3);
