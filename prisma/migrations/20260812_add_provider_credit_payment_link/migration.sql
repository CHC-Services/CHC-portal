-- AlterTable: ProviderCredit gets an optional link back to the Payment that
-- created it — needed for the new "account_balance" credit type (overpayment
-- credits and paid-via-balance debits) so deleting a payment can reverse the
-- ledger entry it produced instead of leaving a stale balance.
-- Safe to re-run: every statement below silently no-ops if already applied.
ALTER TABLE "ProviderCredit" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

DO $$ BEGIN
    ALTER TABLE "ProviderCredit" ADD CONSTRAINT "ProviderCredit_paymentId_fkey"
        FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ProviderCredit_paymentId_idx" ON "ProviderCredit"("paymentId");
