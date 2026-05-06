# CHC Portal — Project Memory

## Stack
- Next.js (App Router), TypeScript, Tailwind CSS
- Prisma ORM → Supabase (PostgreSQL)
- Deployed on Vercel (project: chc-portal, team: alexmcganns-projects)
- Email: Resend (domain: cominghomecare.com, verified, TLS enabled, click tracking off)

## Key Files
- `lib/sendEmail.ts` — sendWelcomeEmail, sendEnrollmentAlert, sendBillingInquiry, sendInvoiceEmail; uses `await logEmail()` (must be awaited or Vercel drops it)
- `lib/s3.ts` — uploadToS3, deleteFromS3, objectExists, getPresignedPost, getPresignedDownloadUrl
- `lib/agreementDocument.ts` — buildAgreementHtml(), buildBillingAgreementHtml(), buildDocumentHeader(), loadLogoBase64()
- `lib/planPermissions.ts` — getEffectiveTier(), canAccessBasic(), canAccessPro()
- `app/api/auth/register/route.ts` — calls sendWelcomeEmail on nurse creation
- `app/api/auth/forgot-password/route.ts` — password reset email (uses BASE_URL env var)
- `app/api/nurse/onboarding/route.ts` — enrollment alert on billing signup
- `app/api/nurse/agreement/route.ts` — POST: sign portal user agreement, upload to S3, reissue JWT
- `app/api/nurse/billing-agreement/route.ts` — POST: sign billing service agreement, upload to S3, create NurseDocument
- `app/api/nurse/plan/route.ts` — GET: returns effectiveTier, isTrialing, trialExpiresAt
- `app/api/admin/claims/import/route.ts` — CSV claim import (dual-payer schema, trims header spaces)
- `app/api/admin/claims/[id]/route.ts` — PATCH to set resubmissionOf on a claim
- `app/api/admin/time-entry/route.ts` — GET (by nurseId), POST, DELETE time entries
- `app/api/admin/time-entry/[id]/route.ts` — PATCH to toggle readyToInvoice + fee plan
- `app/api/admin/invoices/route.ts` — POST create invoice, GET all invoices
- `app/api/admin/invoices/[id]/route.ts` — PATCH invoice status (Paid, etc.)
- `app/api/admin/nurses/[id]/route.ts` — PATCH strips id/userId/user/createdAt/updatedAt before Prisma update
- `app/api/admin/documents/presign/route.ts` — generates presigned POST URL for S3 upload
- `app/api/admin/documents/confirm/route.ts` — creates NurseDocument DB record; includes objectExists check
- `app/api/admin/documents/[id]/route.ts` — GET presigned download URL; DELETE from S3 + DB
- `app/api/admin/email/preview/route.ts` — POST: send template preview emails; GET ?template=user_agreement returns sample HTML
- `app/components/Banner.tsx` — nav (desktop + mobile hamburger + bottom nav)
- `app/components/AdminNav.tsx` — admin nav links
- `app/nurse/profile/page.tsx` — 2-col layout: Personal Info (left) | myBilling (right)
- `app/nurse/onboarding/page.tsx` — 4-step billing enrollment; step 4 is full-screen agreement modal with initials
- `app/nurse/agreement/page.tsx` — first-login portal user agreement (11 checkboxes + initials)
- `app/nurse/page.tsx` — dashboard with time entry form + plan-gated summary cards
- `app/nurse/claims/page.tsx` — nurse claims: Commercial tab + Medicaid tab; FREE tier lock screen
- `app/nurse/invoices/page.tsx` — nurse invoice view; FREE tier lock screen
- `app/care/page.tsx` — myCare: 3 tabs (myEscape/mySupport/myRefresh); BFLO Hydration card in myRefresh
- `app/admin/page.tsx` — admin dashboard with nurse roster + log hours on behalf of nurse
- `app/admin/claims/page.tsx` — admin claims table; Add Claim modal with Commercial/Medicaid toggle
- `app/admin/nurse/[id]/page.tsx` — nurse detail: profile + aliases + time entries + plan/trial tier selector
- `app/billing/page.tsx` — PUBLIC billing services page with inquiry form + PDF fee schedule link
- `app/layout.tsx` — pb-16 md:pb-0 for mobile bottom nav spacing

## Environment Variables
- `RESEND_API_KEY` — set in both .env and Vercel
- `BASE_URL=https://cominghomecare.com` — set in Vercel (server-only, no NEXT_PUBLIC_ prefix)
- `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `DIRECT_URL` — set in .env
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` — set in .env and Vercel

## NurseProfile Key Fields
- `firstName`, `lastName`, `displayName` (portal greeting nickname — PLANNED: remove/deprecate, use firstName+lastName everywhere)
- `planTier` String @default("FREE") — FREE | BASIC | PRO
- `trialExpiresAt DateTime?` — BASIC access until this date, then reverts to FREE
- `portalAgreementSignedAt DateTime?`, `portalAgreementInitials String?`
- `billingAgreementSignedAt DateTime?`, `billingAgreementInitials String?`
- `enrolledInBilling Boolean`, `billingPlan String?`, `billingDurationType String?`

## Portal Tier System
- FREE: 2-week time entry lookback only; summary cards locked; claims/invoices show lock screen
- BASIC ($5/mo equivalent): full claims, invoices, EOB access
- PRO ($10/mo): coming soon
- `getEffectiveTier()` in lib/planPermissions.ts handles trial expiry transparently
- Admin sets tier + trial window on nurse detail page (/admin/nurse/[id])

## Agreement Documents
- Portal User Agreement: signed on first login → `nurses/{id}/agreements/user-agreement-*.html`
- Billing Service Agreement: signed at end of billing onboarding → `nurses/{id}/agreements/billing-agreement-*.html`
- Both: uploaded to S3, NurseDocument created (visibleToNurse: true, category: Agreement), branded HTML via lib/agreementDocument.ts
- Branded header: dark #1c2433 bg, logo left (base64 embedded), title right-aligned

## Invoice System
- Fee plans: A1=$2 (Medicaid single), A2=$3 (Commercial single), B=$4 (Dual payer), C=$6 (3+ payer)
- Invoice number format: CHC-YYYY-NNNN
- Payment methods: Venmo @AlexMcGann | Zelle support@ | CashApp $myInvoiceCHC | Apple Pay support@

## Email Addresses
- support@cominghomecare.com — FROM address for all outgoing emails
- enroll@cominghomecare.com — enrollment alerts + billing inquiry submissions
- billing@cominghomecare.com — plan change requests (referenced in billing agreement)

## Known Issues / Watch Out
- Dates store as UTC midnight — always use timeZone: 'UTC' in toLocaleDateString() calls
- Admin PATCH for nurse profile must strip id/userId/user/createdAt/updatedAt before Prisma update
- NEXT_PUBLIC_ env vars bake in at build time — use plain env vars for server-only values
- `window.open` after `await` is blocked as popup — pre-open: `const win = window.open('', '_blank')` then set `win.location.href`
- logEmail must be awaited in sendEmail.ts — Vercel drops unawaited promises after response
- Supabase shadow DB errors with `prisma migrate dev` — always use mcp__claude_ai_Supabase__apply_migration for schema changes

## Role System
- nurse, admin, biller, provider, guardian
- Role managed per-user via admin nurse detail page (Portal Access section)

## Detailed Memory Files
- [Pending Tasks & Session Checkpoint](project_pending_tasks.md) — ⭐ READ THIS FIRST each session — current state, upcoming tasks, pickup notes
- [S3 Document System](project_s3_documents.md) — bucket, CORS, IAM policy, upload/download flow
- [Medicaid Claims System](project_medicaid_claims.md) — models, admin page, nurse tab
- [Campaigns & Discount System](project_campaigns_discount.md) — Campaign/CampaignEnrollment models, discount calc, invoice integration
- [Claims Page Rewrite Checkpoint](project_claims_rewrite_checkpoint.md) — IN PROGRESS spec for admin/claims/page.tsx rewrite
