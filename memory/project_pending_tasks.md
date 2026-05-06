---
name: Pending Tasks & Session Checkpoint
description: Active tasks, completed work, and pickup notes for the next session
type: project
---

# Session Checkpoint — 2026-05-06

## Completed This Session

### myCare Tab Restructure (`app/care/page.tsx`)
- Split into 3 tabs: **myEscape**, **mySupport**, **myRefresh**
- myEscape: 3 YouTube embeds (Lo-Fi Chill, Healing Frequencies, Nature & Rain), tagline "let the music set you free"
- mySupport: all existing Self-Care apps + Seek Assistance resources moved here
- myRefresh: BFLO Hydration promo card (spa teal palette, white logo right-aligned, shimmer nurse perk banner showing 10% off, "IV Benefits?" button → https://bfloiv.com/the-benefits/)
- URL constant at top of file: `BFLO_HYDRATION_URL = 'https://bfloiv.com'`

### Billing Service Agreement Signing Flow
- `lib/agreementDocument.ts` — added `buildBillingAgreementHtml()` (full agreement from PDF)
- `app/api/nurse/billing-agreement/route.ts` — POST endpoint: validates initials, generates branded HTML, uploads to S3 at `nurses/{id}/agreements/billing-agreement-*.html`, creates NurseDocument (category: Agreement, visibleToNurse: true), updates NurseProfile
- `prisma/schema.prisma` — added `billingAgreementSignedAt DateTime?` and `billingAgreementInitials String?`
- Supabase migration applied: `add_billing_agreement_fields`
- `app/nurse/onboarding/page.tsx` — step 4 replaced with full-screen modal overlay showing complete agreement terms (plans table, late fees, deadlines, corrections, provider responsibility, rate changes), initials input pinned at bottom, "Sign & Enroll" calls billing-agreement API then onboarding API

### Tiered Subscription System (completed prior session)
- FREE / BASIC / PRO tiers on NurseProfile (`planTier`, `trialExpiresAt`)
- `lib/planPermissions.ts` — getEffectiveTier(), canAccessBasic(), canAccessPro()
- Admin tier selector + trial window on nurse detail page
- Dashboard locked cards, year filter hidden, 14-day lookback for FREE tier
- Claims and invoices pages show full-page lock screen for FREE tier

### Portal User Agreement (completed prior session)
- `app/nurse/agreement/page.tsx` — 11-item checkbox form with initials, progress bar
- `app/api/nurse/agreement/route.ts` — signs, uploads to S3, creates NurseDocument, reissues JWT
- `lib/agreementDocument.ts` — `buildAgreementHtml()`, `buildDocumentHeader()`, reusable branded header
- Enforced on first login: login page redirects, dashboard useEffect redirects

---

## Upcoming Tasks (Pick Up Here)

### 1. Billing Intake Form — NEW PRIORITY
Nurses who enroll in billing services need to fill out a detailed intake form capturing:

**Provider demographics:**
- Full legal name, NPI, address, phone, email
- Tax ID / EIN
- License number and state
- Specialty / taxonomy code
- Preferred billing contact

**Per patient (for patients NOT already in Medicaid):**
- Patient full name, DOB, address
- Member ID / policy number
- Insurance carrier name + plan name
- Group number
- Primary insured name (if different from patient)
- Authorization number (if applicable)
- Start/end date of coverage

**Design approach:**
- Likely a multi-step form similar to onboarding (StepCard pattern)
- Could be a separate page `/nurse/intake` or a continuation of onboarding after the agreement is signed
- Data should be saved to the DB (may need new Prisma models: `BillingIntake`, `PatientRecord`, `InsuranceRecord`)
- Admin should be able to view submitted intake forms per nurse

### 2. Admin "Create Provider Account" Overhaul
Current flow creates a nurse account with hardcoded defaults. Replace with:
- A clean modal or page that creates a new User + NurseProfile
- Role selector from the start (nurse / admin / biller / provider / guardian)
- First name + last name fields (not displayName)
- Email field
- Optionally assign a plan tier and trial window at creation time
- No longer should it be labeled "Create Provider" — just "Create Account" or "New User"

### 3. Name Field Standardization — IMPORTANT
**Problem:** `displayName` (admin-visible internal name) is causing confusion about which name to pull throughout the site. Multiple places use `displayName` when they should use `firstName + lastName`.

**Plan:**
- Remove the `displayName` / "internal name (admin-visible)" field from NurseProfile entirely (or repurpose it as a truly optional portal nickname only used in greetings)
- Standardize ALL name references site-wide to pull from `firstName + lastName`
- Audit every place that reads `displayName`, `name`, or any name field and consolidate
- Files most likely affected:
  - `app/nurse/profile/page.tsx`
  - `app/admin/nurse/[id]/page.tsx`
  - `app/api/admin/nurses/[id]/route.ts`
  - `app/components/Banner.tsx` (welcome greeting)
  - `lib/agreementDocument.ts` (already fixed to use firstName + lastName)
  - `app/api/nurse/agreement/route.ts` (already fixed)
  - Any email send functions that take `displayName` or `nurseName`

**Why:** agreement documents already needed a fix because only first name showed up — same issue will affect invoices, emails, and any other generated docs.

---

## Known Issues Still Open
- Re-upload EOBs that were lost when IAM user was recreated (S3 keys exist in DB but objects may be missing)
- IAM policy needs `s3:DeleteObject` permission added for document deletion to work in prod
- Orphaned NurseDocument records (DB record exists but S3 object missing) — need admin cleanup tool
- Claims page rewrite (`app/admin/claims/page.tsx`) — see `project_claims_rewrite_checkpoint.md`
