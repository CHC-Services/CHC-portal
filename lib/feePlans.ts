// Invoice fee-plan codes — mirrors the FEE_PLANS/FEE_AMOUNTS tables in
// app/admin/nurse/[id]/page.tsx and app/api/admin/time-entry/[id]/route.ts
// (kept separate there since this file didn't exist yet when those were
// written). This is the shared source for anything that needs to offer or
// label the current set of codes without duplicating the list again —
// currently the campaign fee-plan-scope picker (app/admin/campaigns/page.tsx,
// app/admin/billing/page.tsx's CampaignsTab). Excludes the legacy A1/A2/B/C
// codes those other two files still recognize for backward compat on
// already-stored entries — new selection surfaces shouldn't offer them.
export const FEE_PLAN_CODES: { value: string; label: string }[] = [
  { value: 'ST-MED',  label: 'Short-Term Medicaid' },
  { value: 'ST-COM',  label: 'Short-Term Commercial' },
  { value: 'ST-DUAL', label: 'Short-Term Dual' },
  { value: 'LT-MED',  label: 'Long-Term Medicaid' },
  { value: 'LT-COM',  label: 'Long-Term Commercial' },
  { value: 'LT-DUAL', label: 'Long-Term Dual' },
  { value: 'VR-MED',  label: 'Void & Resubmit — Medicaid' },
  { value: 'VR-COM',  label: 'Void & Resubmit — Commercial' },
  { value: 'CORR',    label: 'Correction — Provider Error' },
  { value: 'SAMEDAY', label: 'Same-Day Service Fee' },
]

export const FEE_PLAN_LABEL: Record<string, string> = Object.fromEntries(FEE_PLAN_CODES.map(p => [p.value, p.label]))
