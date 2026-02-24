-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'nurse',
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NurseProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    CONSTRAINT "NurseProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nurseId" TEXT NOT NULL,
    "workDate" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEntry_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nurseId" TEXT NOT NULL,
    "internalClaimId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'drafted',
    "hoursBilled" REAL,
    "chargeAmount" REAL,
    "allowedAmount" REAL,
    "paidAmount" REAL,
    "carcCodes" TEXT,
    "statusNote" TEXT,
    "submittedAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Claim_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NurseProfile_userId_key" ON "NurseProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_nurseId_workDate_key" ON "TimeEntry"("nurseId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_internalClaimId_key" ON "Claim"("internalClaimId");
