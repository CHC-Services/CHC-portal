# CHC Portal — Claude Context

## Project
Coming Home Care nurse/admin portal. Alex (alex@cominghomecare.com) is the sole operator; Claude is the sole developer. Alex runs a home health billing service in Buffalo, NY — manages a small nurse network, handles Medicaid + commercial insurance billing.

## Stack
- Next.js 16 App Router, TypeScript, Tailwind CSS
- Prisma ORM + PostgreSQL via Supabase, deployed on Vercel
- Repo: github.com/CHC-Services/CHC-portal, branch: main

## Critical Conventions

**Prisma calls** — always cast to avoid cross-schema TS errors:
```ts
await (prisma.model.method as any)({ ... })
```

**Next.js 16 dynamic routes** — params are a Promise, must be awaited:
```ts
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
```

**Auth pattern** — always inline, no shared helper exists:
```ts
const cookie = req.headers.get('cookie') || ''
const token = cookie.split('auth_token=').pop()?.split(';')[0]
const session = token ? verifyToken(token) : null
if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

**Filled-out data renders read-only, with an Edit button** — any field/section that already has a value (profile pages, patient records, medication details, etc.) must render as read-only display, not an open input, until the user clicks "Edit." Only fields with no existing value (e.g. "add a phone number" when none is on file) or brand-new-entry forms (e.g. "Add PA," "Add Medication") show inputs by default. Reuse `app/components/ReadOnlyField.tsx` (`Row` for a label/value line, `SectionHeader` for a card header with the Edit button baked in) — see `app/nurse/profile/page.tsx` and `app/components/patient/PatientDemographics.tsx`/`PatientInsurance.tsx` for reference implementations. `app/components/MedicationList.tsx` already follows this natively (card view + "Edit" swaps to the form).

**Migrations** — applied manually:
1. `execute_sql` via Supabase MCP (project: `rfhewykretdmldfwpnbw`, region: us-east-1)
2. `npx prisma migrate resolve --applied <migration_name>`
3. `npx prisma generate`

New migration files always go directly under `prisma/migrations/<name>/migration.sql` — never move or create anything under `prisma/migrations/Already_Ran_Archived/`; Alex moves a migration there himself once he's run it, as his own applied-vs-pending tracker.

**RLS** — every table in this project has Row Level Security enabled (Supabase auto-exposes every table via its public PostgREST API regardless of whether the app's own code calls it, and RLS is what blocks anon-key access to that API; Prisma's `DATABASE_URL` connection bypasses RLS, so this doesn't affect the app itself). Any `CREATE TABLE` in a new migration must include a matching `ALTER TABLE "TableName" ENABLE ROW LEVEL SECURITY;` right after it — no policies needed unless a specific one is requested.

## Design System
- Navy: `#2F3E4E`, Sage: `#7A8F79`, Blue-grey bg: `#D9E1E8`, Off-white: `#F4F6F5`
- Brand name: **myProvider** (not myPortal) — italic sage "my" prefix on all portal labels
- Inputs: `border border-[#D9E1E8] p-2 rounded-lg focus:ring-2 focus:ring-[#7A8F79]`
- Primary button: `bg-[#2F3E4E] text-white rounded-xl hover:bg-[#7A8F79]`

## Layout Architecture
- **NurseSideNav** (`app/components/NurseSideNav.tsx`) — fixed floating panel, `lg:` only, mounted via `app/nurse/layout.tsx` (and `app/care/layout.tsx`). Links: myDashboard, myHours, myClaims, myPatients, myPayments (`/nurse/claims?tab=paylog`), myInvoices, myDocuments, myProfile, myWellness (`/care`), Settings.
- Root layout adds `lg:pl-[calc(10vw+1.5rem)]` to page-wrap when role === nurse.
- Nurse layout (`app/nurse/layout.tsx`) is a pass-through — just `<>{children}</>`.
- Login redirects: nurse → `/nurse`, admin → `/admin`. `/portal` redirects all authenticated users.
- All nurse banner links are `md:hidden` (they live in the side nav on desktop).

## Patient Module (completed 2026-05-07; detail-page consolidation 2026-08-10)

### Architecture
Canonical `Patient` record + per-nurse `NursePatient` JSON override layer.
Read merge: `{ ...canonical, ...(overrides || {}) }`. Nurses write only to overrides; canonical unchanged unless admin edits.

### Patient Schema Fields
Demographics: `lastName`, `firstName`, `dob`, `gender`, `phone`, `address`, `city`, `state`, `zip`
Insurance: `insuranceType` (Medicaid/Commercial), `insuranceId`, `insuranceName`, `insuranceGroup`, `insurancePlan`
Secondary insurance: full `ins2*` mirror of the primary insurance block (`ins2Type`, `ins2Id`, `ins2Name`, `ins2Group`, `ins2Plan`, `ins2SubscriberName`, `ins2SubscriberRelation`, `ins2NetworkStatus`, `ins2HasCaseRate`, `ins2CaseRateAmount`, `ins2PolicyNotes`)
Clinical: `highTech` (bool), `dxCode1-4`, `paNumber`, `paStartDate`, `paEndDate` (current PA; full history lives on `PatientPA`)
Commercial-only: `subscriberName`, `subscriberRelation`, `networkStatus` (IN/OON), `hasCaseRate` (bool), `caseRateAmount`, `policyNotes`
Admin lock: `isLocked`, `lockedAt`, `lockedBy` — locks a record against nurse edits.
Account number: `PT-001` format, sequential on creation.
`TimeEntry.patientId` — optional FK linking hours to a patient for billing.

### Shared patient-detail components (`app/components/patient/`)
All three roles' patient-detail pages are thin route wrappers around one shared component set — no more per-role duplicated Demographics/Insurance/Care-Team/PA-History JSX:
- `PatientDetailShell.tsx` — layout: back-link, header (name + account #), `banners` slot (role-specific lock/status copy), tab bar + active tab content. Owns tab state internally. The tab bar reflects whatever `tabs` array a page actually passes in (not a hardcoded global) — this is how admin/nurse get a 5th "Care Team" tab that family doesn't.
- `PatientTabs.tsx` — `DetailTab` type + `PATIENT_DETAIL_TABS` (the standard 4: Demographics/Insurance/Medications/Documents), wraps the generic `app/components/Tabs.tsx`. Roles needing more tabs (admin/nurse add `careTeam`) build their own tabs array rather than using the constant directly.
- `PatientDemographics.tsx`, `PatientInsurance.tsx` — view (via `ReadOnlyField.tsx`'s `Row`/`SectionHeader`) + edit form, `readOnly` prop (true for nurse — no edit UI, preserved from before consolidation).
- `PatientMedications.tsx`, `PatientDocuments.tsx` — thin wrappers around `MedicationList.tsx` / `PatientDocumentsPanel.tsx`.
- `PatientCareTeam.tsx` — rendered on its own **Care Team** tab (admin/nurse only, not family). `GuardianInviteModal` trigger + everyone with access to the record, split into **Family** (`guardianLinks`) and **Provider** (`nurseLinks` — nurse and provider roles both roll up here) lists. Site admins are intentionally excluded from this list (blanket access regardless). `canManageAssignment` prop gates the assign/unlink dropdown (admin only); nurse sees the same lists read-only.
- `PatientPriorAuthHistory.tsx` — renders inside the **Insurance** tab (not its own tab) since it's insurance-related. PA list + add/remove form; `canEdit` prop (admin: always; nurse: false when `isLocked`).
- `types.ts` — shared `PatientFields` type + `US_STATES`/`SUBSCRIBER_RELATIONS`/input class constants.

Nurse's `merged` object (canonical + overrides) and admin's/family's canonical `Patient` object share the same field shape, so all three roles hand the identical shape to these components regardless of source.

### APIs
| Route | Methods | Notes |
|---|---|---|
| `/api/nurse/patients` | GET, POST | List merged patients; create new or link existing |
| `/api/nurse/patients/search` | POST | Search by lastName + dob + insuranceId |
| `/api/nurse/patients/[id]` | GET, PATCH, DELETE | GET single merged patient (for the detail page); PATCH overrides; DELETE soft-unlinks |
| `/api/admin/patients` | GET | All patients with nurseLinks + _count.timeEntries |
| `/api/admin/patients/[id]` | GET, PATCH | Single patient detail + canonical edit |
| `/api/admin/patients/[id]/assign` | POST, DELETE | Link/unlink a nurse to a patient |
| `/api/time-entry` | GET, POST | GET includes patient info; POST accepts patientId |

### Pages
- `app/nurse/patients/page.tsx` — myPatients: search bar + Add Patient button; modal: search → found (link existing) / not found → new patient form. Row click navigates to `/nurse/patients/[patientId]`.
- `app/nurse/patients/[id]/page.tsx` — nurse's patient detail page (routed, not a drawer). Demographics/Insurance render read-only (nurses have no edit UI for canonical fields). PA add/remove and medications are editable unless the record is admin-locked.
- `app/admin/patients/page.tsx` — adPatients: searchable table. Row click navigates to `/admin/patients/[id]`.
- `app/admin/patients/[id]/page.tsx` — admin's patient detail page (routed). Full canonical edit, nurse assign/unlink, lock/unlock.
- `app/family/patients/[id]/page.tsx` — guardian's patient detail page (routed; this was the original reference pattern the admin/nurse pages were converted to match). No Care Team or PA History section for guardians.
- `app/nurse/hours/page.tsx` — patient dropdown in Submit Hours (nurse sees `J. Smith` format); Patient column in history table.

### Nurse hours patient label
Dropdown: `${firstName[0]}. ${lastName.slice(0,5)}` — admin sees account number (PT-001).

## Medication-name typeahead (completed 2026-08-11)
`app/components/MedicationList.tsx`'s "Medication name" field has a live typeahead, mirroring its existing pharmacy-name typeahead pattern (dropdown, arrow-key/Enter/Escape nav) — but debounced-fetch-backed instead of a client-side filter of a preloaded prop, since the drug universe can't be preloaded. `MedicationList.tsx` stays a portable no-API-calls component per its own header comment — it takes an `onSearchDrugNames` callback prop; the actual fetch lives in `lib/drugSearchClient.ts` (`searchDrugNames`), wired in once inside `app/components/patient/PatientMedications.tsx` and `app/family/medications/page.tsx` (the two places `MedicationList` is rendered) rather than per-caller.

**Architecture — grow-as-you-go local cache, no bulk NIH dataset exists**: `DrugName` model (`prisma/schema.prisma`, migration `20260811_add_drug_name_cache`) is a local cache that starts empty and fills in organically. `GET /api/drugs/search?q=` (same auth as `/api/pharmacies` — any nurse/admin/guardian) checks `lib/drugNameLookup.ts`'s `searchLocalDrugNames` first; if thin, falls back to NIH's live RxTerms API (`searchLiveDrugNames`) and caches new results (`cacheDrugNames`, fire-and-forget); if still empty, tries RxNorm's `approximateTerm` fuzzy-match as a typo fallback (`searchApproximateDrugNames`, surfaced in the UI under "Did you mean…"). All external calls are wrapped in try/catch returning `[]` on failure — NIH being down degrades to a plain free-text field, never an error.

**Casing**: NIH's RxTerms `DISPLAY_NAME` does NOT already follow "generic lowercase, brand capitalized" (verified live — brand names come back ALL CAPS, e.g. `TYLENOL`; generic names come back mixed-case with inline tall-man lettering, e.g. `Acetaminophen/diphenhydrAMINE`). `normalizeDrugName()` in `lib/drugNameLookup.ts` detects brand (source is all-caps) vs. generic (anything else) and title-cases or lowercases accordingly before caching/returning — this transform is necessary, not a passthrough.

## What's Not Built Yet
- Voice dictation feature linked to patients (architecture agreed, not started)
- Parent account level for patient assignment (future role)
- myHours: admin view of patient column shows account number (UI not yet updated on admin side)
- Configurable role-based permissions system (canonical-data doc proposes a `can(user, action, resource)` authorization layer + admin Roles & Permissions settings UI — not started; today's auth is still per-route inline role checks, per the Auth pattern above)
