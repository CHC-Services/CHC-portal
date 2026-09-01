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

**Time/date-of-day logic** — this agency operates out of Buffalo, NY, but the server (Vercel) runs UTC. Any function computing a calendar-day boundary or a wall-clock time-of-day must go through `lib/easternTime.ts`'s DST-safe helpers (`nyDateKeyOf`, `easternMidnightUtc`, `easternTimeOfDayUtc`, `nextNyDateKey`/`previousNyDateKey`) — never server-local time (`Date.setHours`, `new Date().getDate()`, `.getDay()` on an arbitrary instant) or a naive fixed-UTC-offset assumption. Reference implementations: `lib/pendingHours.ts` (midnight-split) and `lib/shiftTemplates.ts` (shift-change time materialization). Plain calendar-date fields with no wall-clock component (e.g. `activeFrom`/`activeUntil`) follow a separate, simpler convention — stored as UTC-midnight of the intended date (see `dateKeyToUtcMidnight`) — since there's no time-of-day to get wrong.

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

## Progress note document upload (completed 2026-09-01)
Nurse/provider-only (never admin/family as an entry point) upload of a file (e.g. a scanned paper note) as a `ProgressNote` record, offered from the calendar Day view (`app/patient/[id]/calendar/page.tsx` and `app/nurse/calendar/page.tsx`, via the shared `ProgressNoteDocumentUploadModal.tsx`). Signed immediately at creation (no draft/sign step) — `documentStorageKey`/`documentFileName`/`documentMimeType`/`documentFileSize` on `ProgressNote` are what mark a note "document-based"; presence of `documentStorageKey` is the sole discriminator, no separate type field. Because it's signed instantly, the normal "edit only while unsigned" rule doesn't apply — `lib/permissions.ts`'s `canManageProgressNoteDocument` is a narrow carve-out (author-nurse or admin) letting only the attached file be Replaced or Deleted afterward (`app/components/patient/ProgressNoteDocumentActions.tsx`, wired into both note-detail pages via `ProgressNoteView`'s `documentAction` slot), never the note's signed content. Upload plumbing (`lib/progressNoteDocument.ts`) mirrors `lib/patientDocuments.ts`'s presign/confirm S3 pattern exactly. No separate "PA lookback" reporting feature exists in this codebase (confirmed absent) — "included in reporting pulls" just means the note is a normal signed, non-voided `ProgressNote` row like any other, which is all `lib/calendarFeed.ts`'s ✓ checkmark logic and the admin per-patient notes list already query on.

**Bug fix bundled in**: `getPatientCalendarFeed` (`lib/calendarFeed.ts`) never included progress notes as calendar items at all (only `getNurseCalendarFeed` did) — meaning the ✓ checkmark never appeared on the per-patient calendar, admin's Patient View, or family's calendar (which fans out through `getPatientCalendarFeed` per linked patient). Fixed by adding the same `signedAt`/`voidedAt`-filtered query there.

## Medication-name typeahead (completed 2026-08-11)
`app/components/MedicationList.tsx`'s "Medication name" field has a live typeahead, mirroring its existing pharmacy-name typeahead pattern (dropdown, arrow-key/Enter/Escape nav) — but debounced-fetch-backed instead of a client-side filter of a preloaded prop, since the drug universe can't be preloaded. `MedicationList.tsx` stays a portable no-API-calls component per its own header comment — it takes an `onSearchDrugNames` callback prop; the actual fetch lives in `lib/drugSearchClient.ts` (`searchDrugNames`), wired in once inside `app/components/patient/PatientMedications.tsx` and `app/family/medications/page.tsx` (the two places `MedicationList` is rendered) rather than per-caller.

**Architecture — grow-as-you-go local cache, no bulk NIH dataset exists**: `DrugName` model (`prisma/schema.prisma`, migration `20260811_add_drug_name_cache`) is a local cache that starts empty and fills in organically. `GET /api/drugs/search?q=` (same auth as `/api/pharmacies` — any nurse/admin/guardian) checks `lib/drugNameLookup.ts`'s `searchLocalDrugNames` first; if thin, falls back to NIH's live RxTerms API (`searchLiveDrugNames`) and caches new results (`cacheDrugNames`, fire-and-forget); if still empty, tries RxNorm's `approximateTerm` fuzzy-match as a typo fallback (`searchApproximateDrugNames`, surfaced in the UI under "Did you mean…"). All external calls are wrapped in try/catch returning `[]` on failure — NIH being down degrades to a plain free-text field, never an error.

**Casing**: NIH's RxTerms `DISPLAY_NAME` does NOT already follow "generic lowercase, brand capitalized" (verified live — brand names come back ALL CAPS, e.g. `TYLENOL`; generic names come back mixed-case with inline tall-man lettering, e.g. `Acetaminophen/diphenhydrAMINE`). `normalizeDrugName()` in `lib/drugNameLookup.ts` detects brand (source is all-caps) vs. generic (anything else) and title-cases or lowercases accordingly before caching/returning — this transform is necessary, not a passthrough.

## CareCalendar — Phase 1 (completed 2026-08-25)
"myCalendar" — a scheduling/communication hub visible to every nurse/guardian/admin linked to a patient's case. Extends existing `Shift`/`Appointment` models and `lib/calendarFeed.ts` rather than a from-scratch build.

### Architecture
- `lib/calendarFeed.ts` — `CalendarItem` union type (`source`: globalEvent/personalReminder/shift/appointment/medication/priorAuth/claimReminder/document/progressNote) + three feed functions: `getNurseCalendarFeed`, `getFamilyCalendarFeed` (fans out per-patient items over a guardian's links + role-filtered `GlobalEvent`s — the one real gap this phase closed, since family previously never saw broadcasts), `getPatientCalendarFeed` (one patient, reused by admin/family/nurse per-patient views). All three take an optional `{ start, end }` `DateRange`; `parseDateRangeParams(url)` reads `?start=&end=`.
- `lib/calendarViewRange.ts` — `CalendarViewMode` (`day|week|month|lookahead|custom`), `computeViewRange`, `monthGridDays` (padded to whole weeks), `daysBetween`, `dateKey`, `shiftAnchor` (prev/next navigation).
- `app/components/calendar/CalendarGrid.tsx` — shared grid renderer; month view is a real 7-column grid, day/week/look-ahead/custom share one day-section agenda layout. Filtering (see `CalendarFilterBar.tsx` below) excludes non-matching items from the `items` array a page passes in — the grid itself has no filter-awareness — so a filtered-out item simply doesn't render; the day-cell grid structure itself never changes.
- `app/components/calendar/CalendarFilterBar.tsx` — shared filter-bar shell (`CalendarFilterBar` + `CalendarFilterSection`) used by all four myCalendar pages (nurse/family/admin/patient-scoped): each filter section's header sits on its own line, left-aligned above its pills/select, with a vertical divider between sections. Sits above `CalendarViewSwitcher` on every page. Each page still owns its own filter state and `matchesFilters`/`visibleItems` — this component is layout-only.
- `app/components/calendar/CalendarViewSwitcher.tsx` — shared view-mode tabs + prev/today/next nav (or custom date pickers), used by every calendar page.
- **Patient-scoped route family** (`app/patient/[id]/*`) — one role-agnostic URL family for shift/appointment editing and a per-patient calendar, modeled on `app/care/layout.tsx`'s "one URL, role-aware side nav" precedent. `layout.tsx` resolves the session, gates on `canAccessPatient` (`lib/permissions.ts`, alias for `isLinkedToPatient`), 404s otherwise, renders `NurseSideNav`/`FamilySideNav` (admin gets neither — matches existing admin pages). `schedule/page.tsx` and `appointment/page.tsx` are async server components computing `canManage` via `canCreateShift`/`canCreateAppointment` and passing it to `PatientSchedule.tsx` (now takes `section: 'shifts'|'appointments'|'both'` and `canManage` props, default `'both'`/`true` so the existing admin/family embeds are unaffected). `calendar/page.tsx` is a client component driving `CalendarGrid` off `getPatientCalendarFeed`, with type/nurse-name/has-progress-notes filters. A `?from=` param (set by the calendar page, read by schedule/appointment) round-trips back to the exact calendar view/date, mirroring the `fromArchive` pattern in progress-notes.
- **Role-agnostic API layer** (`app/api/patient/[id]/{shifts,appointments,calendar}`) — used by the routes above and by `PatientSchedule.tsx`/`AppointmentForm.tsx`. Originally built because the older per-role shift/appointment endpoints diverged too much to reuse directly (`/api/nurse/shifts` GET was cross-patient/unscoped with no POST at all — shift creation is admin/guardian-only). All authorization here defers to `lib/permissions.ts`'s already-role-generic functions (`canViewSchedule`, `canCreateShift`, `canEditShift`, `canAssignShift`, `canCancelShift`, `canCreateAppointment`, etc.). The older `/api/{admin,family}/shifts`, `/api/{admin,family,nurse}/appointments`, and plain `/api/nurse/shifts` endpoints were confirmed fully superseded (zero remaining callers) and removed 2026-08-28 — only `/api/nurse/shifts/[id]/{claim,release}` survive from the old per-role layer, since claim/release have no role-agnostic equivalent yet.
- **GlobalEvent as an audience-targeted layer** — `lib/eventAudience.ts`'s `EVENT_AUDIENCES` maps 4 friendly labels to `GlobalEvent.targetRoles` (`Personal (admin only)` → `['admin']`, `Providers` → `['nurse','provider']`, `Family/Caregivers` → `['guardian']`, `All Users` → `[]`, the field's existing "empty = everyone" convention — `'biller'` isn't covered by any non-"All Users" option, matching the 4 categories as specified). `app/admin/calendar/page.tsx` ("adCalendar") is a management view: same `CalendarGrid`/`CalendarViewSwitcher` as everyone else, but reads via `/api/admin/calendar` (no `?patientId=`) which returns every `GlobalEvent` unfiltered (author's view, not a recipient's), each item carrying `targetRoles` for display. "+ Add Event" picks an `EVENT_AUDIENCES` option instead of raw role checkboxes; `POST /api/admin/events` already accepted a raw `targetRoles` array, so no API change was needed there.

### Nav wiring
- Nurse: `app/nurse/calendar/page.tsx` (replaced the old unlinked `/calendar`), added to `NurseSideNav.tsx` and `Banner.tsx`'s mobile menu, right after Dashboard.
- Family: `app/family/calendar/page.tsx` replaced the `/family/schedule` `ComingSoonCard` stub; `FamilySideNav.tsx` entry now reads "Calendar" with the `my` prefix (dropped `noPrefix`).
- Admin: no separate nav entry — folded into the existing `adCalendar` (`/admin/calendar`) pill in `AdminNav.tsx`'s Comms group.

### Recurring shift templates (completed 2026-08-31)
`ShiftTemplate` (`prisma/schema.prisma`) expands into real `Shift` rows via `lib/shiftTemplates.ts`'s `materializeShiftTemplate` — called inline on template create/edit and daily by the `materialize-shift-templates` cron, out to a rolling `MATERIALIZATION_HORIZON_DAYS`-day horizon. Duration is computed client-side from a start/end time pair (`durationHours` is a `Float`, not a fixed 4/8/12hr picker — supports fractional/short shifts), and an `activeUntil` left blank at creation defaults to `activeFrom` + 4 months (`defaultActiveUntil`) rather than recurring indefinitely. `label` distinguishes multiple templates on one patient (e.g. one per nurse) in `PatientShiftTemplates.tsx`'s list. All wall-clock time-of-day math (`startTimeOfDay` → an actual materialized instant) goes through `lib/easternTime.ts`, not server-local time — see the Time/date-of-day logic convention above.

**Occurrence-scoped edit/delete** — the standard calendar-app "this occurrence / this-and-future / entire series" pattern. "Entire series" is just the existing template `PATCH`/`DELETE` (`app/api/patient/[id]/shift-templates/[templateId]/route.ts`) — series-edit also has a UI home now: clicking a template row in `PatientShiftTemplates.tsx` (when `canManage`) opens the same create form pre-filled, submitting a `PATCH`. "This occurrence" and "this and future" are new: `app/api/patient/[id]/shift-templates/[templateId]/occurrences/[shiftId]/route.ts`, `PATCH`/`DELETE` with `?scope=this|future`. `scope=this` reuses `lib/shiftTemplates.ts`'s `updateShiftAndSyncPendingHours`/`cancelSingleShift` (shared with the plain single-shift route, so the Pending Hours sync hooks aren't duplicated). `scope=future` is a series split: `capTemplateBeforeOccurrence` ends the old template the Eastern calendar day before this occurrence, `cancelFutureGeneratedShifts` cancels its not-yet-worked future shifts, then a new `ShiftTemplate` is created from the edited fields starting at this occurrence and materialized immediately. A shift with a **confirmed** `PendingHour` (or `status: 'completed'`) is rejected from `future`-scope bulk operations — never touched except individually via `scope=this`. The materializer's own duplicate guard (`lib/shiftTemplates.ts`) matches on same-Eastern-calendar-day, not exact instant, specifically so an individually-edited occurrence (`scope=this`) doesn't get regenerated as a duplicate by the next cron pass.

**Coverage reconciliation** (completed 2026-09-01) — templates materialize independently with zero cross-template awareness, so an open "coverage needed" template and someone's own assigned template covering the same patient/overlapping-time used to each freely create their own `Shift` rows, leaving a stale duplicate "Open" claimable alongside real coverage. `lib/shiftReconciliation.ts`'s `reconcileNewShift` fixes this, called after every place a `Shift` is created or transitions to/from assigned (`materializeShiftTemplate`, ad-hoc shift POST, full/partial claim, reassignment, release): a newly-assigned shift carves into (shrinks, splits, or fully cancels) whatever open shifts on that patient it overlaps; a newly-open shift trims itself against whatever's already assigned — symmetric, so it's correct regardless of which template happens to materialize first. `subtractCoveredRanges` is the general interval-subtraction primitive (handles several separate covering ranges poking multiple holes into one open window, not just one). The materializer's own duplicate guard now also excludes `status: 'cancelled'` rows — a reconciliation-cancelled slot must read as "not materialized" so it regenerates once whatever absorbed it is removed; `cancelSingleShift` (`lib/shiftTemplates.ts`) drives that regeneration directly — if the shift it just cancelled had a `nurseId` (real coverage lost, not just an already-open placeholder), it re-materializes the patient's active open templates immediately rather than waiting for the next day's cron. `PatientCoveragePlan.tsx` is the friendlier input for defining the need itself (same-window-every-day vs. varies-by-day, multiple windows per day via "+ Add Coverage") — sits above `PatientShiftTemplates.tsx` (unchanged) on the schedule page, and just creates one open (`nurseId`-less) `ShiftTemplate` per window through the existing template API — no new routes, no schema change. **Known limitation**: reconciliation only runs at shift-creation time, so overlapping pairs already materialized before this shipped won't self-heal — delete the conflicting template(s)/shifts and let them re-materialize.

## What's Not Built Yet
- Voice dictation feature linked to patients (architecture agreed, not started)
- Parent account level for patient assignment (future role)
- myHours: admin view of patient column shows account number (UI not yet updated on admin side)
- Configurable role-based permissions system (canonical-data doc proposes a `can(user, action, resource)` authorization layer + admin Roles & Permissions settings UI — not started; today's auth is still per-route inline role checks, per the Auth pattern above)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
