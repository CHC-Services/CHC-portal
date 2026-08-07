-- AlterTable: NurseProfile — track last date the "new hours added" admin text fired per nurse
ALTER TABLE "NurseProfile" ADD COLUMN "hoursAlertSentDate" TEXT;
