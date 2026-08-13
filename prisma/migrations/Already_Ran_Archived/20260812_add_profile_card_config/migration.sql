-- CreateTable: ProfileCardConfig — admin-configurable matrix of which profile
-- "cards" (Demographics, Billing Info, Banking) render per role, without a
-- code deploy. NurseProfile itself is untouched by this migration; it remains
-- the storage table for every role's profile data.
-- Safe to re-run: every statement below silently no-ops if already applied.
CREATE TABLE IF NOT EXISTS "ProfileCardConfig" (
    "id" TEXT NOT NULL,
    "cardKey" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProfileCardConfig_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "ProfileCardConfig" ADD CONSTRAINT "ProfileCardConfig_cardKey_role_key" UNIQUE ("cardKey", "role");
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Seed defaults: Demographics on for every role; Billing Info + Banking on
-- for nurse only. ON CONFLICT DO NOTHING makes the seed itself idempotent too.
INSERT INTO "ProfileCardConfig" ("id", "cardKey", "role", "enabled") VALUES
    (gen_random_uuid()::text, 'demographics', 'nurse', true),
    (gen_random_uuid()::text, 'demographics', 'admin', true),
    (gen_random_uuid()::text, 'demographics', 'biller', true),
    (gen_random_uuid()::text, 'demographics', 'provider', true),
    (gen_random_uuid()::text, 'demographics', 'guardian', true),
    (gen_random_uuid()::text, 'billing_info', 'nurse', true),
    (gen_random_uuid()::text, 'billing_info', 'admin', false),
    (gen_random_uuid()::text, 'billing_info', 'biller', false),
    (gen_random_uuid()::text, 'billing_info', 'provider', false),
    (gen_random_uuid()::text, 'billing_info', 'guardian', false),
    (gen_random_uuid()::text, 'banking', 'nurse', true),
    (gen_random_uuid()::text, 'banking', 'admin', false),
    (gen_random_uuid()::text, 'banking', 'biller', false),
    (gen_random_uuid()::text, 'banking', 'provider', false),
    (gen_random_uuid()::text, 'banking', 'guardian', false)
ON CONFLICT ("cardKey", "role") DO NOTHING;
