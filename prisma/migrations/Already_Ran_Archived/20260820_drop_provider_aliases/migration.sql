-- Claim-to-nurse matching moved from free-text provider name/alias matching
-- to exact NurseProfile.accountNumber matching (CSV import) and a real
-- nurseId selection (manual claim creation) — providerAliases is no longer
-- read anywhere.
ALTER TABLE "NurseProfile" DROP COLUMN "providerAliases";
