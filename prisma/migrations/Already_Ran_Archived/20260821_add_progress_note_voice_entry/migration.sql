CREATE TABLE "ProgressNoteVoiceEntry" (
    "id" TEXT NOT NULL,
    "progressNoteId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressNoteVoiceEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgressNoteVoiceEntry_progressNoteId_idx" ON "ProgressNoteVoiceEntry"("progressNoteId");

ALTER TABLE "ProgressNoteVoiceEntry" ADD CONSTRAINT "ProgressNoteVoiceEntry_progressNoteId_fkey" FOREIGN KEY ("progressNoteId") REFERENCES "ProgressNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgressNoteVoiceEntry" ENABLE ROW LEVEL SECURITY;
