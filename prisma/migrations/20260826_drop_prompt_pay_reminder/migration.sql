-- Removes the automated Prompt Pay reminder (28-day-unsubmitted-claim
-- email) — Alex is no longer using it. Does NOT touch the separate,
-- unrelated ClaimReminder model (nurse-facing manual reminders, surfaced on
-- myCalendar) or Invoice.promptPayCredit/promptPayDays (an invoice
-- line-item discount, not a notification) — both share the "Prompt Pay"
-- name but are different features and stay as-is. Also does NOT touch
-- PromptPayDocument — that table is the version history for the manual
-- "Prompt Pay Violation & Interest Request" NY §3224-a letter generator
-- (app/api/admin/prompt-pay-letter), a kept, separate feature; the
-- automated reminder's uploaded form lived in SystemSetting keys instead,
-- which is what's actually cleaned up below.

ALTER TABLE "Claim" DROP COLUMN "submitDateReminderSentAt";

DELETE FROM "SystemSetting" WHERE "key" LIKE 'promptPay.%';
