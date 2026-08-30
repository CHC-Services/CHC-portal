-- Scopes a Campaign's discount to specific invoice fee-plan codes (e.g. only
-- CORR/VR-MED adjustment lines, not every routine ST-MED/LT-MED visit fee).
-- Empty array (the default) preserves existing behavior: applies to everything.
ALTER TABLE "Campaign" ADD COLUMN "appliesFeePlans" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Exact day-precision stop date, preferred over the legacy weekCount bound
-- when set. Existing campaigns keep working off weekCount unchanged.
ALTER TABLE "Campaign" ADD COLUMN "endDate" TIMESTAMP(3);

-- Site-wide campaigns auto-apply to every invoice while active/in-window,
-- with no CampaignEnrollment row needed (checked only when the invoiced
-- nurse has no active personal enrollment).
ALTER TABLE "Campaign" ADD COLUMN "siteWide" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Campaign_siteWide_idx" ON "Campaign"("siteWide");
