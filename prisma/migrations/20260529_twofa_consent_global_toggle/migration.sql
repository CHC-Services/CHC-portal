ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFaConsentAt" TIMESTAMP;
INSERT INTO "SystemSetting" (key, value, "updatedAt") VALUES ('twofa_enabled', 'false', NOW()) ON CONFLICT (key) DO NOTHING;
