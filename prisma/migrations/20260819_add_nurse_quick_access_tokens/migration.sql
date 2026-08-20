-- Scoped "app password"-style credential for the /quick-notes home-screen
-- shortcut. Entirely separate from the normal auth_token session cookie —
-- see lib/nurseQuickAccess.ts.

CREATE TABLE "NurseQuickAccessToken" (
  "id"          TEXT NOT NULL,
  "nurseId"     TEXT NOT NULL,
  "tokenHash"   TEXT NOT NULL,
  "deviceLabel" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"  TIMESTAMP(3),
  "revokedAt"   TIMESTAMP(3),
  CONSTRAINT "NurseQuickAccessToken_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "NurseQuickAccessToken" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX "NurseQuickAccessToken_tokenHash_key" ON "NurseQuickAccessToken"("tokenHash");
CREATE INDEX "NurseQuickAccessToken_nurseId_idx" ON "NurseQuickAccessToken"("nurseId");

ALTER TABLE "NurseQuickAccessToken" ADD CONSTRAINT "NurseQuickAccessToken_nurseId_fkey"
  FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
