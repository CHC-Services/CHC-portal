CREATE TABLE "LoginLog" (
  "id"            TEXT NOT NULL,
  "timestamp"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accountType"   TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "firstName"     TEXT,
  "lastName"      TEXT,
  "accountNumber" TEXT,
  "result"        TEXT NOT NULL,
  "ip"            TEXT,
  CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginLog_timestamp_idx" ON "LoginLog"("timestamp");
CREATE INDEX "LoginLog_email_idx" ON "LoginLog"("email");
CREATE INDEX "LoginLog_result_idx" ON "LoginLog"("result");
