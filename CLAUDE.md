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
- **NurseSideNav** (`app/components/NurseSideNav.tsx`) — fixed floating panel, `lg:` only, mounted via `app/nurse/layout.tsx` (and `app/care/layout.tsx`). Links: myDashboard, myCalendar, myHours, myClaims, myPatients, myPayments (`/nurse/claims?tab=paylog`), myInvoices, myDocuments, myProfile, myWellness (`/care`), Settings.
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

## CareCalendar — Phase 1 (completed 2026-08-25)
"myCalendar" — a scheduling/communication hub visible to every nurse/guardian/admin linked to a patient's case. Extends existing `Shift`/`Appointment` models and `lib/calendarFeed.ts` rather than a from-scratch build.

### Architecture
- `lib/calendarFeed.ts` — `CalendarItem` union type (`source`: globalEvent/personalReminder/shift/appointment/medication/priorAuth/claimReminder/document/progressNote) + three feed functions: `getNurseCalendarFeed`, `getFamilyCalendarFeed` (fans out per-patient items over a guardian's links + role-filtered `GlobalEvent`s — the one real gap this phase closed, since family previously never saw broadcasts), `getPatientCalendarFeed` (one patient, reused by admin/family/nurse per-patient views). All three take an optional `{ start, end }` `DateRange`; `parseDateRangeParams(url)` reads `?start=&end=`.
- `lib/calendarViewRange.ts` — `CalendarViewMode` (`day|week|month|lookahead|custom`), `computeViewRange`, `monthGridDays` (padded to whole weeks), `daysBetween`, `dateKey`, `shiftAnchor` (prev/next navigation).
- `app/components/calendar/CalendarGrid.tsx` — shared grid renderer; month view is a real 7-column grid, day/week/look-ahead/custom share one day-section agenda layout. `isGreyedOut(key)` prop greys non-matching days rather than hiding them (filtering never changes the active view mode).
- `app/components/calendar/CalendarViewSwitcher.tsx` — shared view-mode tabs + prev/today/next nav (or custom date pickers), used by every calendar page.
- **Patient-scoped route family** (`app/patient/[id]/*`) — one role-agnostic URL family for shift/appointment editing and a per-patient calendar, modeled on `app/care/layout.tsx`'s "one URL, role-aware side nav" precedent. `layout.tsx` resolves the session, gates on `canAccessPatient` (`lib/permissions.ts`, alias for `isLinkedToPatient`), 404s otherwise, renders `NurseSideNav`/`FamilySideNav` (admin gets neither — matches existing admin pages). `schedule/page.tsx` and `appointment/page.tsx` are async server components computing `canManage` via `canCreateShift`/`canCreateAppointment` and passing it to `PatientSchedule.tsx` (now takes `section: 'shifts'|'appointments'|'both'` and `canManage` props, default `'both'`/`true` so the existing admin/family embeds are unaffected). `calendar/page.tsx` is a client component driving `CalendarGrid` off `getPatientCalendarFeed`, with type/nurse-name/has-progress-notes filters. A `?from=` param (set by the calendar page, read by schedule/appointment) round-trips back to the exact calendar view/date, mirroring the `fromArchive` pattern in progress-notes.
- **Role-agnostic API layer** (`app/api/patient/[id]/{shifts,appointments,calendar}`) — used by the routes above and by `PatientSchedule.tsx`/`AppointmentForm.tsx`. Originally built because the older per-role shift/appointment endpoints diverged too much to reuse directly (`/api/nurse/shifts` GET was cross-patient/unscoped with no POST at all — shift creation is admin/guardian-only). All authorization here defers to `lib/permissions.ts`'s already-role-generic functions (`canViewSchedule`, `canCreateShift`, `canEditShift`, `canAssignShift`, `canCancelShift`, `canCreateAppointment`, etc.). The older `/api/{admin,family}/shifts`, `/api/{admin,family,nurse}/appointments`, and plain `/api/nurse/shifts` endpoints were confirmed fully superseded (zero remaining callers) and removed 2026-08-28 — only `/api/nurse/shifts/[id]/{claim,release}` survive from the old per-role layer, since claim/release have no role-agnostic equivalent yet.
- **GlobalEvent as an audience-targeted layer** — `lib/eventAudience.ts`'s `EVENT_AUDIENCES` maps 4 friendly labels to `GlobalEvent.targetRoles` (`Personal (admin only)` → `['admin']`, `Providers` → `['nurse','provider']`, `Family/Caregivers` → `['guardian']`, `All Users` → `[]`, the field's existing "empty = everyone" convention — `'biller'` isn't covered by any non-"All Users" option, matching the 4 categories as specified). `app/admin/calendar/page.tsx` ("adCalendar") is a management view: same `CalendarGrid`/`CalendarViewSwitcher` as everyone else, but reads via `/api/admin/calendar` (no `?patientId=`) which returns every `GlobalEvent` unfiltered (author's view, not a recipient's), each item carrying `targetRoles` for display. "+ Add Event" picks an `EVENT_AUDIENCES` option instead of raw role checkboxes; `POST /api/admin/events` already accepted a raw `targetRoles` array, so no API change was needed there.

### Nav wiring
- Nurse: `app/nurse/calendar/page.tsx` (replaced the old unlinked `/calendar`), added to `NurseSideNav.tsx` and `Banner.tsx`'s mobile menu, right after Dashboard.
- Family: `app/family/calendar/page.tsx` replaced the `/family/schedule` `ComingSoonCard` stub; `FamilySideNav.tsx` entry now reads "Calendar" with the `my` prefix (dropped `noPrefix`).
- Admin: no separate nav entry — folded into the existing `adCalendar` (`/admin/calendar`) pill in `AdminNav.tsx`'s Comms group.

### Deferred to Phase 2
Recurring shift-schedule templates (4/8/12hr slots, daily/weekly/monthly recurrence, configurable shift-change times) — nothing in this codebase expands a template into repeating instances today; needs its own design pass (likely a `ShiftTemplate` model + materialization mechanism).

## What's Not Built Yet
- Voice dictation feature linked to patients (architecture agreed, not started)
- Parent account level for patient assignment (future role)
- myHours: admin view of patient column shows account number (UI not yet updated on admin side)
- Configurable role-based permissions system (canonical-data doc proposes a `can(user, action, resource)` authorization layer + admin Roles & Permissions settings UI — not started; today's auth is still per-route inline role checks, per the Auth pattern above)
- CareCalendar Phase 2: recurring shift-schedule templates (see above)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
