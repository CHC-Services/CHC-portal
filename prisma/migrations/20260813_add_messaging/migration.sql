-- Peer-to-peer messaging: Message + MessageRecipient, plus a role-agnostic
-- per-user "email me on new message" preference on User.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyNewMessage" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "Message" (
  "id"                TEXT NOT NULL,
  "senderId"          TEXT,
  "senderName"        TEXT NOT NULL,
  "subject"           TEXT,
  "body"              TEXT NOT NULL DEFAULT '',
  "isDraft"           BOOLEAN NOT NULL DEFAULT true,
  "draftRecipientIds" TEXT[] NOT NULL DEFAULT '{}',
  "patientId"         TEXT,
  "inReplyToId"       TEXT,
  "sentAt"            TIMESTAMP(3),
  "senderSavedAt"     TIMESTAMP(3),
  "senderTrashedAt"   TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageRecipient" (
  "id"        TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "readAt"    TIMESTAMP(3),
  "savedAt"   TIMESTAMP(3),
  "trashedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX IF NOT EXISTS "Message_sentAt_idx" ON "Message"("sentAt");
CREATE INDEX IF NOT EXISTS "MessageRecipient_userId_readAt_idx" ON "MessageRecipient"("userId", "readAt");
CREATE UNIQUE INDEX IF NOT EXISTS "MessageRecipient_messageId_userId_key" ON "MessageRecipient"("messageId", "userId");

DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
