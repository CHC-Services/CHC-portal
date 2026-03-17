# CHC Portal — Project Memory

## Stack
- Next.js (App Router), TypeScript, Tailwind CSS
- Prisma ORM → Supabase (PostgreSQL)
- Deployed on Vercel (project: chc-portal, team: alexmcganns-projects)
- Email: Resend (domain: cominghomecare.com, verified, TLS enabled, click tracking off)

## Key Files
- `lib/sendEmail.ts` — sendWelcomeEmail, sendEnrollmentAlert
- `app/api/auth/register/route.ts` — calls sendWelcomeEmail on nurse creation
- `app/api/auth/forgot-password/route.ts` — password reset email (inline template)
- `app/api/nurse/onboarding/route.ts` — enrollment alert on billing signup
- `app/api/admin/claims/import/route.ts` — CSV claim import (dual-payer schema)
- `app/api/admin/claims/[id]/route.ts` — PATCH to set resubmissionOf on a claim
- `app/api/admin/time-entry/route.ts` — admin POST/DELETE time entries on behalf of nurses
- `app/api/admin/nurses/[id]/route.ts` — PATCH strips id/userId/user/createdAt/updatedAt before Prisma update
- `app/components/Banner.tsx` — nav (desktop + mobile hamburger + bottom nav)
- `app/nurse/profile/page.tsx` — 2-col layout: Personal Info (left) | myBilling (right)
- `app/nurse/onboarding/page.tsx` — 4-step billing enrollment questionnaire
- `app/nurse/page.tsx` — dashboard with time entry form + submission history
- `app/nurse/claims/page.tsx` — nurse claims view (dual-payer cards, grouped resubmissions)
- `app/admin/page.tsx` — admin dashboard with nurse roster + log hours on behalf of nurse
- `app/admin/claims/page.tsx` — admin claims table (dual-payer, resubmission linking, import)
- `app/admin/nurse/[id]/page.tsx` — nurse detail: profile fields + provider aliases + role management
- `app/layout.tsx` — pb-16 md:pb-0 for mobile bottom nav spacing

## Environment Variables
- `RESEND_API_KEY` — set in both .env and Vercel
- `BASE_URL=https://cominghomecare.com` — set in Vercel (server-only, no NEXT_PUBLIC_ prefix)
- `NEXT_PUBLIC_BASE_URL=http://localhost:3000` — local only, unused in production
- `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `DIRECT_URL` — set in .env

## What's Working
- Welcome email sends when admin creates a nurse account
- Password reset email sends with correct URL (uses BASE_URL env var)
- Enrollment alert emails send to enroll@cominghomecare.com
- Resend domain verified (cominghomecare.com), TLS enabled
- Admin can log hours on behalf of a nurse
- Time entry history sorts chronologically, auto-focuses date field after submit
- Claims import via CSV (dual-payer schema, columns A–S)
- Provider aliases control which claims each nurse can see
- Claim resubmission linking (admin links via 🔗 button, grouped display on both views)

## Mobile Nav (Banner.tsx)
- Row 1: Logo (left) | ☰ Hamburger + Logout (right)
- Row 2: Welcome home, [name] (right-aligned)
- Hamburger dropdown: all nav links stacked
- Fixed bottom nav bar: Home, Resources, Dashboard, Claims, Profile

## Claims Schema (Claim model)
Columns A–S imported from CSV:
- Claim ID, Provider Name, DOS Start, DOS Stop, Total Billed, Claim Stage
- Primary Payer, Primary Allowed Amt, Primary Paid Amt, Primary Paid Date, Primary Paid To
- Secondary Payer, Secondary Allowed Amt, Secondary Paid Amt, Secondary Paid Date, Secondary Paid To
- Total Reimbursed, Remaining Balance, Date Fully Finalized, Processing Notes
- resubmissionOf (set via admin UI, not imported) — links resubmitted claim to original

## Claim Stage Values
Draft, INS-1 Submitted, Resubmitted, Pending, Info Requested, Info Sent, INS-2 Submitted, Appealed, Paid, Denied, Rejected

## Claim Stage Badge Colors
- Paid/Finalized → green | Denied/Rejected → red | Pending → yellow
- INS-1/INS-2 Submitted/Resubmitted → blue | Info Requested → orange
- Info Sent → light orange | Appealed → purple | Draft → black bg / light gray text

## Provider Aliases
- Each NurseProfile has `providerAliases String[]`
- Import matches CSV "Provider Name" against aliases to assign nurseId
- Admin sets aliases in nurse profile page (Claims Access section)
- Janine Barone → ["Janine", "JCST"]
- Alex McGann → ["Alex", "CHCS"]

## CSV Import Notes
- Column headers must match exactly (case-sensitive) — import trims leading/trailing spaces automatically
- Excel cell indent formatting causes spaces in CSV exports → fix: Format Cells → Alignment → Indent 0, Horizontal = General
- Secondary Payer and Secondary Allowed Amt columns were missing from original spreadsheet — need to be added
- Only columns A–S are imported; additional columns are ignored

## Known Issues / Watch Out
- Dates store as UTC midnight — always use `timeZone: 'UTC'` in toLocaleDateString() calls
- Admin PATCH for nurse profile must strip id/userId/user/createdAt/updatedAt before Prisma update (fixed)
- NEXT_PUBLIC_ env vars bake in at build time — use plain env vars for server-only values
- Duplicate DKIM TXT records will break Resend verification — only one resend._domainkey record allowed

## Role System
- nurse, admin, biller, provider, guardian
- Role managed per-user via admin nurse detail page (Portal Access section)
- Role update hits /api/admin/users/[userId]/role

## In Progress / Next Steps
- Mobile nav layout refinements (hamburger + bottom nav both present)
- Onboarding step 1 "No" copy update (contacting us hyperlink to enrollment email)
- myBilling column position on profile page
- Dual-payer claims spreadsheet: Secondary Payer + Secondary Allowed Amt columns still need to be added to user's Excel file
