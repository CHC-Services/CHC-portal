-- Tags each Micro-Charting voice entry as 'shift' or 'arrival', set by which
-- record button the nurse pressed. Existing rows backfill to 'shift' (the
-- prior behavior — everything went into Shift Notes).
ALTER TABLE "ProgressNoteVoiceEntry" ADD COLUMN "entryType" TEXT NOT NULL DEFAULT 'shift';
