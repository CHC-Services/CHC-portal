# Coming Homecare — Care Platform Architecture Audit Report

**Scope:** Audit only, per `.claude/chc_markdown_files/COMING_HOMECARE_CAREBOARD_ARCHITECTURE_AUDIT.md`. No application code, migrations, or config were modified.
**Repository state audited:** `main` branch, working tree as of 2026-08-19 (one untracked file, this audit doc itself, present at audit start).
**Method:** Direct repository inspection — file reads, targeted greps across `app/`, `lib/`, `prisma/`. No live database access (Supabase MCP not authenticated in this session) and no AWS console access — anything that requires those is explicitly labeled `UNVERIFIED`.

---

## A. Executive Summary

**Is the current foundation safe enough to extend? YES, as of 2026-08-19 — both P0 findings are now resolved.** The dominant authorization pattern across ~209 API routes (verify JWT → check role → check a `NursePatient`/`GuardianPatient` relationship row scoped to the specific patient ID in the URL → only then touch data) is sound, consistently applied, and was found correctly implemented in every family/nurse/admin document, medication, and patient-detail route spot-checked. The one endpoint that broke that pattern (Finding P0-1) has been fixed — the nurse patient-linking flow now requires a signed, short-lived, nurse-scoped match token instead of trusting a client-supplied patient ID. Finding P0-2 (RLS coverage) is also **RESOLVED**: Alex manually enabled RLS on every table in the live database except `CarcCode` (non-PHI reference data) and the internal `prisma_migrations` table, closing the gap this audit could only flag as `UNVERIFIED` from migration-file evidence alone. Remaining P1/P2 items (Section N) are recommended but not blocking.

**Largest architectural strengths:**
- Private-by-default S3 model (`lib/s3.ts`): no public bucket ACLs used, all reads/writes go through short-lived presigned URLs, `PatientDocument.storageKey` is explicitly never returned to the client (`lib/patientDocuments.ts` `listPatientDocuments`).
- Consistent, repeatable "role auth → relationship-row check → scoped Prisma query" idiom, independently reimplemented correctly across nurse/family/admin route trees for documents, medications, and patient detail.
- 2FA state is fully server-side: `pending_2fa` cookie (5-minute JWT of `type: 'pending_2fa'`) is structurally distinct from `auth_token`, and `auth_token` is never issued until `/api/auth/2fa/verify` succeeds when 2FA is required.
- Shared, deduplicated patient-detail component layer (`app/components/patient/*`) already gives admin/nurse/family the same field shape from three different source queries — a real head start on Section 6's "same underlying patient record" goal.

**Largest risks:**
1. No real event/scheduling model exists yet — `GlobalEvent` is a compliance-reminder board, `TimeEntry` is an hours ledger. The future timeline needs new schema, not a repurposed one.
2. No audit-log system beyond `Claim`/`MedicaidClaim` edits (`ClaimAuditLog`) and login attempts (`LoginLog`) — nothing for patient record views, document downloads, or medication changes.

*(Both original P0 findings — the patient-linking endpoint trusting a client-supplied ID, and RLS coverage gaps — are now resolved; see P0-1 and P0-2 in Section N.)*

**Are there P0 blockers?** No — both resolved. P0-1 (nurse patient-linking) was fixed by requiring a signed, short-lived match token derived from a real search result. P0-2 (RLS coverage) was confirmed resolved 2026-08-19 after Alex manually enabled RLS on every table except `CarcCode` and `prisma_migrations`.

**Can the existing calendar/scheduling structure be reused?** No — see Section J. It's a compliance-notice board and an hours ledger, not a shift/appointment model. A new generalized event model is required, though the existing `Patient` ⇄ `NursePatient` ⇄ role-scoped-route pattern is reusable as the access-control skeleton around it.

**Can the existing patient model support the timeline?** Yes, as a foundation. `Patient`, `PatientPA`, `PatientMedication`, `PatientDocument` are already patient-centric, FK'd to `Patient.id` with `onDelete: Cascade`, and already follow a consistent per-role access-check idiom. A `TimelineEvent` table referencing `Patient.id` plus polymorphic references into these domain tables (Section K) is a natural extension, not a rebuild.

**Is the authorization model centralized enough?** No. It is consistent by convention (the same four-line `auth()`/`verify*Linked()` pair is hand-copied into every route file) but not centralized into shared `can*(user, resource)` functions. This is exactly the risk Section 17 warns about: the pattern is good today because it was carefully hand-copied; it is not structurally guaranteed to stay good as more routes are added.

**Is CareBoard feasible without major restructuring?** Conditionally yes — but only after the P0 items are closed and a permission-engine layer (Section L) is introduced. CareBoard is a new, semi-persistent, lower-trust client of the same data; today's per-route inline checks have no mechanism to express "household display mode" vs. "authorized clinical mode" distinctions, and the JWT session model (7-day token, no revocation, no device binding) is not yet suited to a wall-mounted device that should be revocable independently of a family member's own login.

---

## B. Current Architecture Map

```text
Authentication   — JWT in httpOnly `auth_token` cookie (lib/auth.ts), issued by
                    /api/auth/login (or /api/auth/2fa/verify when 2FA applies).
                    Session-only cookie (no maxAge) + 1-hour rolling inactivity
                    window enforced in middleware.ts, reissued on every matched
                    page request. 7-day hard JWT expiry as the outer bound.

Authorization    — Per-route inline checks (CLAUDE.md's documented pattern,
                    though two shared helpers — lib/getUserFromCookie.ts,
                    lib/messaging.ts messagingAuth() — also exist and are used
                    in ~15 routes). Pattern: verify JWT → check session.role →
                    look up the relevant NursePatient/GuardianPatient row for
                    the specific patientId in the URL → 403 if absent/inactive.
                    Admin bypasses the relationship check by design (blanket
                    access), which is consistent everywhere checked.

Database         — PostgreSQL via Supabase, accessed exclusively through
                    Prisma's DATABASE_URL (direct Postgres connection, bypasses
                    PostgREST/RLS entirely — confirmed no @supabase/supabase-js
                    or @supabase/ssr import anywhere in app/ or lib/, despite
                    both being package.json dependencies).

Storage          — AWS S3, private bucket, presigned POST for upload /
                    presigned GET (15 min default) for download (lib/s3.ts).
                    No public ACLs used anywhere in the code path.

Patient routes   — /admin/patients/[id], /nurse/patients/[id],
                    /family/patients/[id] — all three are 'use client' pages
                    that fetch from role-scoped API routes; the actual
                    authorization decision happens server-side in the API
                    route, not in the page.

API layer        — app/api/** , 209 route.ts files. Auth pattern is
                    per-CLAUDE.md inline verifyToken(), independently
                    reimplemented per route (see Authorization above).

Role portals     — /admin (role=admin), /nurse (role=nurse, partial access for
                    role=provider), /family (role=guardian). /portal, /care,
                    /resources are shared among nurse/admin/provider/biller/
                    guardian. provider and biller have no fully-built portal
                    of their own (see Finding P2-13).

Notifications    — Resend (email, lib/sendEmail.ts) and TextBelt (SMS,
                    lib/sendSms.ts). Reminder crons (lib/run*Reminders.ts) are
                    scheduled via vercel.json crons, gated by CRON_SECRET.

Calendar         — GlobalEvent (compliance/renewal notice board) +
                    NurseReminder (personal reminders) + TimeEntry (hours
                    ledger). No shift/appointment/status model exists.

Documents        — PatientDocument / NurseDocument rows carry only metadata +
                    an S3 storageKey; all three role trees (admin/nurse/family)
                    share lib/patientDocuments.ts for the actual S3 + Prisma
                    work after each does its own auth check.
```

**Data flow, in one line:** Browser → Next.js middleware (page-route auth + inactivity check only) → page (`'use client'`, no server auth) → `fetch()` to an API route → API route re-verifies JWT + role + patient-relationship independently → Prisma (`DATABASE_URL`, bypasses Supabase RLS) → Postgres. File bytes never transit the Next.js server — the browser talks to S3 directly using presigned URLs the API route hands back after its own authorization check.

---

## C. Authentication & 2FA Report

| Item | Finding | Evidence |
|---|---|---|
| Login flow | Email/password → bcrypt compare → if 2FA needed, issue 5-min `pending_2fa` JWT and stop; else issue full `auth_token` | `app/api/auth/login/route.ts` |
| Session creation | `signToken()` — JWT, 7-day `expiresIn`, `lastActivityAt` claim stamped at sign time | `lib/auth.ts:27-33` |
| Session validation | `verifyToken()` (jwt.verify) called independently in nearly every route + in `middleware.ts` | `lib/auth.ts:35-42` |
| Session expiration | Hard cap 7 days (JWT `exp`); soft cap 1 hour of inactivity, enforced only for page routes matched by middleware | `lib/auth.ts:25`, `middleware.ts:85-93` |
| Refresh-token handling | No separate refresh token. Middleware **reissues** `auth_token` with a fresh `lastActivityAt` on every matched page request (sliding window) | `middleware.ts:95-105` |
| Logout | `app/api/logout/route.ts` clears the cookie | not deep-audited; standard pattern assumed, `UNVERIFIED` for edge cases (e.g., other open tabs) |
| Password reset | `/api/auth/forgot-password`, `/api/auth/reset-password`, token fields `passwordResetToken`/`passwordResetExpiry` on `User` | `prisma/schema.prisma:41-42` |
| Email verification | No dedicated email-verification flow found; accounts are usable immediately after creation/invite | `UNVERIFIED` — not found, treated as absent |
| 2FA enrollment | `/api/auth/2fa/setup`, `/enable`, TOTP via `speakeasy`, or SMS via `smsOtp`/`smsOtpExpiresAt` on `User` | `app/api/auth/2fa/setup/route.ts`, `prisma/schema.prisma:35-38` |
| 2FA challenge | `/api/auth/2fa/send` binds a specific method to the pending session | `app/api/auth/2fa/verify/route.ts:44-46` comment confirms method-binding, no fallback |
| 2FA verification | `/api/auth/2fa/verify` checks TOTP (speakeasy) or SMS OTP match+expiry; only then signs `auth_token` | `app/api/auth/2fa/verify/route.ts` |
| Recovery flow | No dedicated 2FA-lockout/recovery flow found | `UNVERIFIED` |
| Remembered/trusted device | None found | Not implemented |
| Session invalidation after password change | **NO** — JWTs are stateless with no revocation list; an old token remains valid until its own expiry regardless of a later password change | Confirmed by absence of any token-blacklist/version field on `User` |
| Session invalidation after role change | **NO** — same reasoning; a token's `role` claim is baked in at sign time and not re-checked against the DB per request | `lib/auth.ts` — no DB lookup inside `verifyToken()` |
| Session invalidation after suspension | **NO** — no `User.isActive`/`suspended` field exists in the schema at all | `prisma/schema.prisma:25-55` (full `User` model, no such field) |
| Is 2FA state stored server-side | **YES** | `User.mfaEnabled`, `User.mfaSecret`, `User.smsOtp*`, `SystemSetting['twofa_enabled']` |
| Can 2FA be bypassed by direct route visit | **NO** for data — `auth_token` (the only cookie middleware/API routes trust) is never set until 2FA passes when required. `pending_2fa` and `auth_token` are cryptographically and structurally distinct JWTs (`type: 'pending_2fa'` vs. role claims) | `app/api/auth/login/route.ts:77-94`, `app/api/auth/2fa/verify/route.ts:98-119` |
| Is 2FA actually **mandatory** for anyone | **PARTIALLY / runtime-dependent** — 2FA triggers only if the site-wide `SystemSetting['twofa_enabled']` is `'true'` OR the individual `User.mfaEnabled` is `true`. Neither is hardcoded true for any role, including admin. Current live value of the site-wide toggle is `UNVERIFIED` (DB not queried this session) | `app/api/auth/login/route.ts:51-56`, admin control at `app/api/admin/system/security/route.ts` |

**Where authentication is actually enforced:**
- **Middleware:** only for page routes whose path starts with `/admin`, `/nurse`, `/portal`, `/resources`, `/care`, `/family` — see Finding P1-4 for the significant exception this creates.
- **API routes:** independently, per-route, via inline `verifyToken()` (or the two shared helpers). This is correct and is where the real enforcement lives for the entire `/api/**` surface — middleware's inclusion of `/api/nurse/:path*` and `/api/time-entry/:path*` in its `matcher` is **only** used for the narrower demo-account write-block check, not for authentication (see the middleware source discussion in Finding P1-4).
- **Layouts:** `app/nurse/layout.tsx` is a pass-through (`<>{children}</>` per CLAUDE.md) — no auth logic there; relies entirely on middleware for the page shell and the API route for data.
- **Pages:** none — all patient-detail pages are `'use client'` and fetch data; they contain no server-side auth of their own.
- **Server Actions:** none found in the patient/document/medication paths — the app uses API routes exclusively for these flows (`grep` for `'use server'` in patient-adjacent files returned nothing of consequence).
- **Database policies (RLS):** see Section F — largely absent for PHI tables per migration evidence, `UNVERIFIED` for live state.
- **File-access endpoints:** yes, independently — every presign/confirm/download/delete route re-derives the requester's patient relationship before touching S3 (see Section H, I).

---

## D. Authorization Matrix (current, observed code behavior)

Admin = blanket access by design (verified consistently — every admin route checks `role === 'admin'` only, no per-patient scoping, matching CLAUDE.md's documented model). "Assigned Provider" below covers both `nurse` role and the small provider allowance; "Unassigned Provider" = a nurse/provider with no active `NursePatient` link to that patient. "Linked/Unlinked Family" = presence/absence of a `GuardianPatient` row.

| Resource | Action | Admin | Assigned Nurse | Unassigned Nurse | Linked Family | Unlinked Family |
|---|---|---|---|---|---|---|
| Patient Demographics | View | ALLOW | ALLOW (read-only UI) | DENY (404, `NursePatient` lookup fails) | ALLOW (editable) | DENY (403) |
| Patient Demographics | Edit | ALLOW (canonical) | DENY — no nurse edit UI; nurse writes only to `NursePatient.overrides`, not canonical `Patient` | DENY | **ALLOW — direct canonical edit, no `isLocked` check** (see Finding P2 note below) | DENY |
| Insurance | View | ALLOW | ALLOW (read-only) | DENY | ALLOW (editable) | DENY |
| Insurance | Edit | ALLOW | DENY (overrides only, blocked by `isLocked`) | DENY | **ALLOW — direct canonical edit, `isLocked` not checked** | DENY |
| Medications | View | ALLOW | ALLOW | DENY | ALLOW | DENY |
| Medications | Create/Edit | ALLOW | ALLOW unless `isLocked` | DENY | ALLOW | DENY |
| Documents | View | ALLOW | ALLOW (active link only) | DENY | ALLOW (linked only) | DENY |
| Documents | Upload | ALLOW | ALLOW | DENY | ALLOW | DENY |
| Documents | Delete | ALLOW | ALLOW (any doc on a linked patient) | DENY | **ALLOW only for docs the guardian themself uploaded** (explicit ownership check) | DENY |
| PA History | View/Edit | ALLOW | ALLOW unless `isLocked` | DENY | not exposed (no PA tab in family UI) | DENY |
| Care Team tab | View/Manage | ALLOW (manage) | ALLOW (read-only) | DENY | not exposed (no tab) | DENY |
| **Patient linking itself** (create the access relationship) | Create | ALLOW (`/api/admin/patients/[id]/assign`) | ALLOW, now requires a signed match token from a real search result (Finding P0-1, resolved 2026-08-19) | — | ALLOW only via admin/nurse invite or an *already-linked* guardian inviting a co-guardian (verified) | — |

All `ALLOW`/`DENY` values above are server-enforced (API-route level), not client-only — confirmed by reading the route source in each case, not inferring from the UI. The one cell marked **bold** is the P0 finding; the two demographics/insurance "no `isLocked` check" cells are a real but lower-severity (P2) inconsistency versus the nurse path, documented in Finding P2 below.

---

## E. Patient Access Flow (traced from source)

```text
Family user opens /family/patients/[id]
                ↓
Middleware (middleware.ts) — matcher includes /family/:path*
   • No auth_token cookie → redirect to /login
   • Token present but invalid/expired → redirect to /login
   • decoded.role !== 'guardian' → redirect to /login
   • lastActivityAt stale (>1hr) or missing → redirect to /login, cookie cleared
   • Otherwise: reissue auth_token with fresh lastActivityAt, NextResponse.next()
                ↓
Page renders ('use client', app/family/patients/[id]/page.tsx)
   • NO server-side check here — page trusts middleware got this far
                ↓
useEffect fires fetch('/api/family/patients/[id]', { credentials: 'include' })
                ↓
API route (app/api/family/patients/[id]/route.ts)
   • auth(req) — re-verifies auth_token independently, requires role==='guardian'
   • verifyLinked-equivalent: prisma.guardianPatient.findUnique({ userId_patientId })
     — 403 if this specific guardian has no row for this specific patientId
                ↓
Database — Prisma via DATABASE_URL (bypasses Supabase RLS/PostgREST entirely)
                ↓
Page data returned only if every step above passed
```

**2FA validation is not a distinct step in this per-request flow** — it happens once, at login, before `auth_token` is ever issued. There is no re-challenge mid-session (e.g., before viewing especially sensitive data), which is consistent with the "session-level" 2FA model but is worth naming explicitly since Section 7's future "Authorized Clinical Mode" for CareBoard will need a *second*, resource-scoped challenge that this flow doesn't currently have a hook for.

The nurse and admin flows follow the identical shape, substituting `NursePatient`/admin-blanket for the `GuardianPatient` check, and were confirmed by direct source read (`app/api/nurse/patients/[id]/route.ts`, `app/api/admin/patients/[id]/route.ts`).

---

## F. Database / RLS Report

**UPDATE (2026-08-19):** Alex confirmed via the Supabase dashboard that RLS is now enabled manually on every table in the live database, with two intentional exceptions: `CarcCode` (non-PHI reference/lookup data) and `prisma_migrations` (Prisma's own internal bookkeeping table). This closes Finding P0-2 below. The evidence table and migration-history analysis that follows is left intact as the audit trail explaining *why* this was flagged and *what* was actually checked — it reflects migration-file state, not live-database state, which is why this session could only label it `UNVERIFIED` rather than confirm it directly.

**Overall Prisma models:** 49 (`grep -c "^model "` on `prisma/schema.prisma`). Access is exclusively via `DATABASE_URL` (a direct Postgres connection string, not Supabase's client libraries) — confirmed no `@supabase/supabase-js` or `@supabase/ssr` import exists anywhere in `app/` or `lib/`, despite both being `package.json` dependencies. **This means RLS does not protect the application itself** (Prisma's connection bypasses it, exactly as CLAUDE.md states) — RLS's only job in this architecture is to prevent Supabase's auto-exposed PostgREST API from serving PHI to anyone holding the project's anon/publishable key.

**RLS coverage, from migration-file evidence** (`prisma/migrations/Already_Ran_Archived/*/migration.sql` — 40 archived migrations, all presumed applied per this project's own tracking convention):

| Table (PHI-relevant) | Contains PHI | RLS enabled per migration source | Evidence |
|---|---|---|---|
| `User` | Auth/contact | **NOT FOUND** | `20260216023913_init/migration.sql` — `CREATE TABLE "User"`, no `ENABLE ROW LEVEL SECURITY` anywhere for it |
| `NurseProfile` | SSN/EIN (encrypted), address, bank (encrypted) | **NOT FOUND** | same file |
| `Patient` | Full demographics/insurance/clinical | **NOT FOUND** | `20260507_add_patient_models/migration.sql` |
| `PatientDocument` | Documents metadata (S3 keys) | **NOT FOUND** | `20260806_patient_documents/migration.sql` |
| `PatientPA` | Clinical (PA numbers) | **NOT FOUND** | `20260513_patient_pa_history/migration.sql` |
| `PatientMedication` | Clinical | **NOT FOUND** | not in the archive listing under its own name — created alongside patient models; no RLS statement found in any migration file |
| `NursePatient` / `GuardianPatient` | Access-control relationship rows | **NOT FOUND** | same migrations as `Patient` |
| `TimeEntry`, `Claim` | Billing (adjacent PHI — DOS, diagnosis-linked) | **NOT FOUND** | `20260216023913_init/migration.sql` |
| `LoginLog` | Auth metadata | **NOT FOUND** | `20260613_login_log/migration.sql` |
| `Message` / `MessageRecipient` | Free-text messages (may contain PHI) | **FOUND** — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` present | `20260813_add_messaging/migration.sql:56-57` |

**Across all 40 archived migrations, exactly one (`20260813_add_messaging`, the most recent) contains an `ENABLE ROW LEVEL SECURITY` statement.** Every other `CREATE TABLE` — including every PHI table in the entire schema — has no RLS statement in the migration that created it, and no later migration was found retrofitting it. CLAUDE.md's Critical Conventions section states: *"every table in this project has Row Level Security enabled"* — **this is contradicted by the committed migration history.** It's possible RLS was enabled manually against the live database outside of a tracked migration (Supabase's dashboard allows this, and would not appear in `prisma/migrations/`), which is why this finding is `UNVERIFIED` for the actual live state rather than asserted as fact — but the auditable evidence trail says otherwise, and that gap between "documented as true" and "provably true from source control" is itself the finding.

**Policies:** No `CREATE POLICY` statements were found in any migration file (searched all 40). Per CLAUDE.md's own convention ("no policies needed unless a specific one is requested"), enabling RLS with zero policies is intentional and correct **when actually enabled** — it produces default-deny for the `anon`/`authenticated` PostgREST roles. The `Message`/`MessageRecipient` tables follow this correctly. The PHI tables do not appear to follow it at all.

**SECURITY DEFINER functions / RPCs / triggers / views:** None found in any migration file (`grep` for `FUNCTION`, `TRIGGER`, `CREATE VIEW` across the migration archive returned nothing beyond standard DDL).

**Service-role key location:** `SUPABASE_SERVICE_ROLE_KEY` is present as an env var name in `.env` (value not read/printed). No reference to this variable name was found anywhere in `app/` or `lib/` source — it is unused by the current codebase. `.env` is git-ignored (`.gitignore` line `.env*`) and confirmed **not** tracked in git history (`git ls-files` returns nothing for any `.env*` path).

**Direct browser-to-database access:** None found — no client component or client-bundled code references any Supabase client, so there is no code path today for the browser to reach Postgres or PostgREST directly. The `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env vars exist but are not referenced by any `.ts`/`.tsx` file in the repo, so Next.js would not inline them into any client bundle today.

**Recommendation:** ~~Before any CareBoard work begins, Alex should open the Supabase dashboard's Table Editor... and confirm live RLS status for every PHI table.~~ **Done — confirmed resolved 2026-08-19.** For future migrations: CLAUDE.md already requires new `CREATE TABLE` statements to include a matching `ENABLE ROW LEVEL SECURITY` line; this audit found that convention wasn't followed for any table before the `Message`/`MessageRecipient` migration, so it's worth treating as a real checklist item (not just documented intent) going forward, since Alex is now doing this enforcement manually outside of tracked migrations.

---

## G. Route/API Security Report

Representative sample across all three role trees + shared infra (full 209-route enumeration was not individually re-derived in this summary; the pattern below was confirmed consistent in every file actually opened during this audit — see file list in each workstream above).

| Route | Auth check | Patient-level check | Notes |
|---|---|---|---|
| `app/api/family/patients/[id]/route.ts` | inline `verifyToken`, role `guardian` | `guardianPatient.findUnique` | GET properly scoped; **PATCH edits canonical fields with no `isLocked` check** (P2) |
| `app/api/nurse/patients/[id]/route.ts` | inline, role `nurse` | `nursePatient.findUnique` + `isActive` | PATCH correctly blocks on `isLocked` for override writes |
| `app/api/admin/patients/[id]/route.ts` | inline, role `admin` | none needed (blanket access, by design) | Consistent with documented architecture |
| `app/api/nurse/patients/route.ts` (POST, `matchToken` branch) | inline, role `nurse` | Signed match token verified server-side, `patientId` derived from token only | P0-1, resolved 2026-08-19, see Finding below |
| `app/api/family/patients/[id]/guardians/route.ts` | inline, role `guardian` | `verifyGuardianLinked` before allowing an invite | Correct — contrast with the nurse-linking gap above |
| `app/api/{admin,nurse,family}/patients/[id]/documents/[docId]/route.ts` | inline, per-role | `doc.patientId !== patientId` check inside `lib/patientDocuments.ts` | Correct in all three trees |
| `app/api/nurse/patients/search/route.ts` | inline, role `nurse` | N/A (pre-link identity search) | Returns full `Patient` record on 3-factor match, no rate limit (P2) |
| `app/api/nurse/document-inquiry/route.ts` | **NONE** | N/A | **P1-4, unauthenticated, see below** |
| `app/api/cron/*` | `CRON_SECRET` bearer-token check | N/A | 3 of 6 fail-closed unconditionally, 3 fail-open if the env var is unset (P3) |

**Are unauthorized requests rejected or merely redirected?** API routes: rejected with 401/403 JSON. Page routes: redirected to `/login` by middleware (a redirect, not a hard reject, but the underlying data is never served since the API layer independently rejects — so this is not exploitable, just a UX-level distinction worth naming per the audit doc's own phrasing of the question).

**Do pages fetch more data than the user needs?** Generally no — role-scoped API routes return role-appropriate shapes (e.g., family's `GET /api/family/patients/[id]` does not include `nurseLinks`/`guardianLinks`/other patients' data). Admin's patient GET does return more (nurse links, guardian links, last 50 time entries) which is appropriate given admin's blanket-access role.

---

## H. File Security Report

**Upload flow:** Browser requests a presigned POST from an API route (which does its own auth + patient-relationship check first) → browser POSTs the file bytes directly to S3, bypassing the Next.js server entirely → browser calls a `confirm` endpoint with the resulting `storageKey` to create the `PatientDocument` row.

**Download flow:** Browser requests a presigned GET URL from an API route (same auth + relationship check) → 15-minute expiry (`getPresignedDownloadUrl` default `900` seconds, `lib/s3.ts:88`) → browser fetches the file directly from S3.

**Delete flow:** API route re-verifies the relationship, then `deleteFromS3` + `prisma.patientDocument.delete`.

| Check | Status | Evidence |
|---|---|---|
| Buckets private | **UNVERIFIED live**, but no code path grants public ACLs — all writes use `ServerSideEncryption: 'AES256'` and no `ACL: 'public-read'` anywhere | `lib/s3.ts:26-34` |
| Object URLs public | NO — only presigned, time-limited URLs are ever generated | `lib/s3.ts:86-112` |
| Signed URL duration | 15 min (download), 15 min (presigned POST) — both defaults, not overridden anywhere found | `lib/s3.ts:67,88` |
| Upload path structure | `patient-documents/{patientId}/{category}/{timestamp}-{sanitizedFileName}` | `lib/patientDocuments.ts:18` |
| Filename sanitization | Yes — `fileName.replace(/[^a-zA-Z0-9._-]/g, '_')` | `lib/patientDocuments.ts:17` |
| MIME/type validation | Content-Type is pinned in the presigned POST policy (`['eq', '$Content-Type', contentType]`) but the `contentType` itself is **client-supplied and not validated against an allowlist** server-side | `lib/s3.ts:64-79`, `lib/patientDocuments.ts:8-22` |
| File-size limits | Yes — hardcoded 50MB cap in the presigned POST policy | `lib/s3.ts:73` |
| Object-key predictability | Key includes the true `patientId` UUID + a millisecond timestamp — not sequentially guessable, but predictable in *structure* if a `patientId` is otherwise known | `lib/patientDocuments.ts:18` |
| Cross-patient access via known key | **Confirmed via `[docId]` route**: safe, because `doc.patientId !== patientId` is checked before ever using `doc.storageKey` (Section D). **Confirmed via `confirm` route**: **not safe** — see Finding P1-3 | `lib/patientDocuments.ts:116-125` vs. `24-61` |
| Delete authorization | Nurse: any doc on a linked patient. Admin: any doc. Family: **only docs they themselves uploaded** (explicit `uploadedByUserId` check) | `app/api/family/patients/[id]/documents/[docId]/route.ts:49-51` |
| Uploads executing active content | Files are never served through the app server (S3 direct), and downloads default to `Content-Disposition: inline` with the original filename — **UNVERIFIED** whether S3's served `Content-Type` (client-supplied at upload) could allow an uploaded HTML/SVG file to render inline in a browser tab under the S3 bucket's own origin, which would not affect the app's own origin/cookies but is worth a defensive check | `lib/s3.ts:90-100` — `inline: true` passed from `getPatientDocumentDownloadUrl` |

**Critical Test result:** "If a user obtains or guesses another patient's S3 object key, can they retrieve the file?" — **Not directly** through the read/delete paths (both independently re-check `doc.patientId`). **Yes, indirectly**, through the confirm path: an authorized user for Patient A can register a *new* `PatientDocument` row under Patient A pointing at a storageKey they don't own, then read it back through Patient A's own authorized download path. See Finding P1-3.

---

## I. PHI Exposure Report

| Exposure point | Finding |
|---|---|
| URLs | Patient UUIDs appear in route paths (`/family/patients/[id]`) — standard, low-risk pattern since the ID alone grants nothing without the corresponding relationship row. No PHI *field values* (names, DOB, insurance IDs) found appearing in URLs/query strings. |
| Browser logs | Not directly inspectable from source; `'use client'` pages do not appear to log full patient objects to `console` in the files reviewed. `UNVERIFIED` at full-repo scale. |
| Server logs | **Confirmed issue** — `middleware.ts` logs the raw `auth_token` JWT and its fully decoded payload (id, role, name, `lastActivityAt`) to server console on every single request to a matched page route. This lands in Vercel's log aggregation. See Finding P1-5. |
| SMS notifications | **Confirmed PHI in content** — medication name + patient name (`lib/runMedicationReminders.ts:21`), patient name + PA number (`lib/runPAReminders.ts:28`), both sent via `sendSms`. Directly contradicts the audit's own Section 14 Principle 7. See Finding P1-9. |
| Email notifications | Not deep-audited line-by-line; `lib/logEmail.ts` stores the full HTML body in the private S3 bucket (reasonable) with only metadata in Postgres — access to stored bodies is admin-gated (`app/api/admin/email/log/[id]/route.ts`, confirmed `role==='admin'` check). |
| LocalStorage/SessionStorage | Not found storing PHI in the client components reviewed — state is held in React state (`useState`), not persisted client-side. `UNVERIFIED` at full-repo scale. |
| Cookies | Only `auth_token` (httpOnly, session-only) and `pending_2fa` (httpOnly, 5-min) were found — no PHI in cookie values themselves (JWT payload carries identity/role only, not clinical data). |
| Static generation / caching | All patient-data routes are Next.js Route Handlers reading `req.headers`/cookies per request, which opts them out of Next's static/ISR caching by default. However, **no route sets an explicit `Cache-Control: no-store` header or `export const dynamic = 'force-dynamic'`** — the safety currently rests on Next.js's implicit dynamic-detection rather than an explicit, audited guarantee. `UNVERIFIED` whether any CDN-level caching is configured in Vercel project settings outside the repo. |
| Search-engine indexing | Patient routes sit behind middleware auth (redirect to `/login` without a session), so a crawler would see only the login page — low risk. |

---

## J. Current Calendar Model

**What exists:**
- `GlobalEvent` — admin-authored compliance/renewal notices (tax deadlines, license renewals), with `targetRoles` filtering. Not patient-specific. (`prisma/schema.prisma:231-243`)
- `NurseReminder` — a nurse's own personal to-do items (license, Medicaid, NPI renewals). Not patient-specific, not shared. (`prisma/schema.prisma:246-259`)
- `TimeEntry` — an hours-worked ledger for billing, optionally linked to a `Patient` via `patientId`. Has `workDate` + `hours` but no start/end time, no status enum, no recurrence, no timezone field. (`prisma/schema.prisma:274-296`)
- `HomeCase` / `CaseAssignment` — **dead schema**. References a plain-text `patientFirstName` string rather than the real `Patient` table, and a repo-wide grep found **zero** references to either model anywhere in `app/` or `lib/`. This appears to predate the current `Patient`/`NursePatient` model and was never removed. (`prisma/schema.prisma:794-819`)
- `app/admin/calendar` and `app/calendar` render `GlobalEvent` data — a compliance notice board, not a scheduler.

**Is this reusable as the foundation for a patient timeline / shift scheduler?** No. There is no shift, appointment, or event-status concept tied to `Patient` at all today. **Recommendation: build a new, generalized event model** (Section K) rather than extending `GlobalEvent` or `TimeEntry` — both exist for different, narrower purposes and repurposing either would conflate unrelated concerns (compliance reminders vs. billing hours vs. patient care timeline). The one thing worth carrying forward is the **access-control skeleton**: `NursePatient`/`GuardianPatient` already answer "is this user allowed to see/act on this patient," which is exactly the gate a new `TimelineEvent` table would need to sit behind.

**Recommendation for `HomeCase`/`CaseAssignment`:** confirm with Alex whether these are truly unused (they appear to be) and, if so, plan their removal in a future migration rather than building anything new on top of them — leaving them in the schema risks a future Claude session mistaking them for the real case-assignment model.

---

## K. Recommended Patient Timeline Architecture (conceptual — not to be implemented yet)

Given the existing schema's shape (small, purpose-specific domain tables — `PatientPA`, `PatientMedication`, `PatientDocument` — each FK'd to `Patient.id` with `onDelete: Cascade`, each with its own `@@index([patientId])`), the lowest-risk extension is a **shared index table with polymorphic references**, not one giant table:

```text
TimelineEvent
  id
  patientId        → Patient.id
  eventType        // 'shift' | 'appointment' | 'medication_reminder' | 'pa_deadline'
                    // | 'order_renewal' | 'progress_note' | 'document' | 'task' | 'family_reminder'
  eventDate         // date this event surfaces on the timeline
  sourceTable        // e.g. 'PatientPA', 'PatientMedication', 'ProgressNote'
  sourceId          // the FK into that domain table
  visibility        // role-scoped visibility tag(s), not a single boolean —
                    // this is where "household display mode" vs "clinical mode"
                    // (Section M) would key off of
  createdAt / updatedAt
```

Each domain table (`PatientPA`, `PatientMedication`, future `ProgressNote`, future `Appointment`) continues to own its real data and its own authorization rules (per Section L). `TimelineEvent` rows are denormalized *pointers* generated/updated alongside the domain writes (e.g., creating a `PatientPA` also upserts a `TimelineEvent` row) — this satisfies Section 29's "enter once, appear everywhere authorized" principle without ever duplicating the underlying clinical data itself, and without ever granting timeline-read access as a shortcut to the underlying record's real authorization check (Section 9 is explicit that a calendar entry and the clinical document behind it require separate authorization decisions — a `TimelineEvent` row should carry enough to render a *title/date*, not clinical content).

This is a recommendation only — no migration was written or proposed for execution during this audit.

---

## L. Recommended Permission Architecture

Today's pattern (repeated per-route: `auth()` + `verify*Linked()`) works because it has been carefully and consistently hand-copied — but Section 17's own critique fits precisely: it is `if (role === "family") ...`-shaped logic, just consistently applied rather than scattered. Concretely, the same two functions (`nursePatient.findUnique` relationship check, `guardianPatient.findUnique` relationship check) appear near-verbatim in at least 15+ files reviewed during this audit.

**Recommendation:** extract this into `lib/permissions.ts` with functions shaped like Section 17's example, e.g.:

```ts
canViewPatient(user, patientId)
canEditPatientDemographics(user, patientId)
canViewDocument(user, documentId)
canUploadDocument(user, patientId)
canDeleteDocument(user, documentId)
```

Each would internally do exactly what the current inline checks do today (role branch → relationship lookup) — this is a **refactor of duplication, not a change in actual behavior** — and would be the natural place to add the `isLocked` check consistently (closing the Finding-P2 gap where family PATCH doesn't check it but nurse PATCH does) and, later, the CareBoard-specific "household vs. clinical mode" distinction from Section M. This should happen as its own dedicated phase (Section O, Phase 2) rather than opportunistically during CareBoard feature work, precisely because Section 28 prohibits refactor-while-building.

---

## M. CareBoard Security Architecture (recommendation only)

The current session model (7-day JWT, no revocation, no device concept, cookie-based) is **not** what should back a wall-mounted, semi-persistent household display. Recommended shape, none of which should be built yet:

- **A distinct `Device` concept**, not a normal `User` session — a CareBoard is bound to a `patientId` (or small set of patients in a shared household), not to an individual login. This does not exist today; there is no device-registration table in the schema.
- **Two-tier trust**, matching Section 7 exactly:
  - *Household Display Mode*: non-PHI surface (today, shift, nurse name, appointment titles) rendered from `TimelineEvent`-shaped data with `visibility: 'household'`, requiring only that the device itself is registered/bound — no PHI-grade auth needed for this tier.
  - *Authorized Clinical Mode*: unlocked per-session (PIN/passkey/phone-approval, none implemented today) and **must auto-expire independently of the device's own long-lived registration** — this is a second, shorter session layered on top of the device's persistent one, not a re-use of the existing 1-hour/7-day `auth_token` model, which was designed for a personal login, not a shared kiosk.
- **Revocation** must be possible per-device without touching any user's own session — today's stateless JWT model has no mechanism for this at all (Finding P1-8 above is the same underlying gap). A device-bound session record (checked server-side, not just a JWT claim) is required before CareBoard should go further than a prototype.
- **Idle/offline handling** (screen refresh, power loss, network reconnection) all need explicit design — today's middleware reissue-on-every-request pattern assumes a browser tab is being actively used by a logged-in person, not a kiosk that may sit idle for hours between glances.

None of this should block *starting* CareBoard design work, but it should block shipping "log the CareBoard in with a normal family account and leave the tab open" as the actual implementation — that would inherit every session weakness named in Section C (no revocation, no suspension check, full personal-account privileges) onto a device sitting in a patient's living room.

---

## N. Prioritized Remediation List

### P0 — Critical Security

**P0-1 — STATUS: RESOLVED 2026-08-19.** Nurse patient-linking endpoint trusted a client-supplied patient ID with no independent verification.
- **File:** `app/api/nurse/patients/route.ts`, `POST` handler, formerly the `existingPatientId` branch (lines 62–84 at time of audit).
- **Why it mattered:** This was precisely Workstream C's "Critical Test" and Section 27's "User-editable patient assignment escalation" stop condition. The 3-factor search endpoint (`/api/nurse/patients/search`, requiring `lastName`+`dob`+`insuranceId` match) existed as a UI convenience only — nothing server-side tied a successful search result to this endpoint's acceptance of `existingPatientId`. Any authenticated nurse who obtained a patient's UUID by any means (not through the intended search flow) could call this endpoint directly and immediately create a `NursePatient` link, granting themselves ongoing access with no admin approval step.
- **Mitigating factor, stated plainly (for the record):** `Patient.id` is a non-sequential UUID, so blind enumeration was impractical — exploitation required the attacker-nurse to already have obtained another patient's UUID through some other channel. This lowered *likelihood* but didn't change that the *control itself was absent*.
- **Resolution implemented:** `/api/nurse/patients/search` now issues a short-lived (5-minute), nurse-scoped signed token (`signPatientMatchToken`/`verifyPatientMatchToken` in `lib/auth.ts`, same pattern as the existing 2FA pending-token flow) for each returned match. `app/api/nurse/patients/route.ts`'s link branch now requires that `matchToken`, verifies it server-side, and derives the `patientId` to link *exclusively* from the token's payload — the client-supplied `existingPatientId` field is gone entirely, closing the trust gap rather than just adding a second check alongside it. Both frontend callers (`app/nurse/patients/page.tsx`, `app/components/AddPatientModal.tsx`) updated to pass the token through. No workflow change — search-then-click-to-link still works identically for nurses.
- **Required before CareBoard:** Was **Yes**; now satisfied.

**P0-2 — STATUS: RESOLVED 2026-08-19.** RLS appeared absent from every PHI table except the two most recently added, per migration-file evidence.
- **File/table:** All `CREATE TABLE` migrations under `prisma/migrations/Already_Ran_Archived/` except `20260813_add_messaging`. See Section F for the full evidence table.
- **Why it mattered:** CLAUDE.md states RLS is enabled on every table; the committed migration history showed only `Message`/`MessageRecipient` were ever given an `ENABLE ROW LEVEL SECURITY` statement. Since this app's migration files don't reflect manual dashboard changes, this session could not confirm live database state, so it was flagged `UNVERIFIED`/candidate rather than asserted as fact.
- **Resolution:** Alex checked the live Supabase database directly and confirmed RLS is enabled on every table except `CarcCode` (non-PHI reference data) and `prisma_migrations` (Prisma internal bookkeeping) — both reasonable, intentional exceptions. No further action required for this finding.
- **Required before CareBoard:** Was **Yes**; now satisfied.

### P1 — Structural Blocker

**P1-3 — Document-confirm endpoint trusts a client-supplied `storageKey` with no ownership/prefix validation.**
`lib/patientDocuments.ts` `confirmPatientDocument()`, called from all three role trees' `documents/confirm/route.ts`. No check that `storageKey` matches the expected `patient-documents/${patientId}/` prefix, and no `objectExists()` verification that the key was actually produced by this session's own presign call. Enables a user authorized for Patient A to register a document row under A pointing at a storageKey belonging to Patient B, then retrieve B's file through A's own authorized download path. **Required before CareBoard: recommended**, since it undermines the same document-authorization guarantee CareBoard's clinical-mode document access would depend on.

**P1-4 — Unauthenticated API endpoint.**
`app/api/nurse/document-inquiry/route.ts` has no auth check of any kind. It sits outside middleware's actual authentication enforcement, because middleware's full auth block only triggers for `pathname.startsWith("/admin"|"/nurse"|"/portal"|"/resources"|"/care"|"/family")` — page routes — while `/api/nurse/document-inquiry` starts with `/api/nurse`, which is only matched by middleware's much narrower demo-write-block check, not its authentication block. **Required before CareBoard: not directly**, but should be fixed regardless since it's a live abuse vector (arbitrary-content email relay from `support@cominghomecare.com`) and a violation of the project's own stated auth pattern.

**P1-5 — Session tokens logged to server console on every request.**
`middleware.ts:15,48` — `console.log('middleware hit', pathname, 'token', token)` and `console.log('decoded token', decoded)` print the raw JWT and its fully decoded payload on every matched-page request, landing in Vercel's log aggregation. **Required before CareBoard: recommended**, low effort, should be removed or gated behind an explicit debug flag.

**P1-9 — PHI in SMS notification content.**
`lib/runMedicationReminders.ts:21` (medication name + patient name), `lib/runPAReminders.ts:28` (patient name + PA number) — both violate Section 14 Principle 7 verbatim. **Required before CareBoard: recommended** if CareBoard/daily-briefing notifications are meant to follow the same principle (Section 11).

**P1-8 — No server-side session revocation.**
No `User.isActive`/`suspended` field exists at all; role/password changes don't invalidate previously-issued tokens. **Required before CareBoard: yes**, per Section M — a device-bound CareBoard session needs to be revocable independently, and today's architecture has no revocation mechanism to build that on top of.

**P1-11 — No real scheduling/event model exists.**
See Section J. **Required before CareBoard: yes** (CareBoard's core content — shifts, appointments — has nowhere to live yet); this is expected, not a defect, and is exactly why Section K's recommendation exists.

**P1-12 — No audit-log system beyond Claims.**
`ClaimAuditLog` (snapshot-on-save, `Claim`/`MedicaidClaim` only) and `LoginLog` (login attempts only) are the entire audit trail today. No logging exists for patient record views/edits, document downloads, medication changes. **Required before CareBoard: recommended**, since Section 8/9's shift-coordination and Progress Note features explicitly call for an audit trail, and it's cheaper to add the logging hook once, early, than to retrofit it across every future route.

### P2 — Important Cleanup

- **P2 — Family/guardian canonical edits skip the `isLocked` check** that nurse overrides respect (`app/api/family/patients/[id]/route.ts` PATCH has no `isLocked` gate; `app/api/nurse/patients/[id]/route.ts` PATCH does). Worth reconciling once the permission-engine refactor (Section L) happens, since `isLocked`'s purpose ("locks a record against edits") is currently only half-enforced.
- **P2 — 3-factor nurse search returns the full `Patient` record with no rate limiting** (`app/api/nurse/patients/search/route.ts`). Now that P0-1 requires a real search match before linking, this is a full-record-leak-via-guessing risk on its own rather than also a standing-access-grant risk — still worth rate-limiting, but lower severity than before the P0-1 fix.
- **P2 — `GuardianPatient` has no status/expiration fields**, unlike `NursePatient.isActive`. Not exploitable today (admin can still delete the row) but a gap versus Section 19's future relationship model.
- **P2 — `HomeCase`/`CaseAssignment` are dead schema**, unreferenced anywhere in app code, using a plain-text patient name instead of the real `Patient` FK. Recommend confirming with Alex and removing in a future migration before any new event model is built, to avoid confusion with the real case-assignment mechanism (`NursePatient`).
- **P2 — `provider`/`biller` roles have no functional dedicated portal**, and `/portal`'s redirect logic creates a client-side redirect loop for `provider` accounts (`app/portal/page.tsx` → `/nurse` → middleware bounces back to `/portal` since only `/nurse/profile` and `/nurse/onboarding` are provider-allowed). `biller` falls through to `/`. Confirms the audit doc's own suspicion in Section 3.
- **P2 — CLAUDE.md's "no shared auth helper exists" is inaccurate.** `lib/getUserFromCookie.ts` and `lib/messaging.ts`'s `messagingAuth()` are both real, in-use shared helpers (messaging routes, `/api/me`). Not a security issue, but worth correcting so a future session doesn't over-trust the "always inline" claim.
- **P2 — Two cron routes' `CRON_SECRET` check is conditional** (`if (process.env.CRON_SECRET)`) rather than unconditional, so 3 of 6 cron routes fail *open* if the env var were ever unset, while the other 3 fail *closed*. Low likelihood, easy fix for consistency.

### P3 — Cosmetic / Low Risk

- Documentation/behavior mismatch: `middleware.ts` and the login route both comment "10-minute idle timeout," but `lib/auth.ts`'s `INACTIVITY_MS` is actually 60 minutes.
- Guardian-invite temp password uses `Math.random()` rather than a CSPRNG (`app/api/family/patients/[id]/guardians/route.ts`) — low severity since it's a one-time emailed credential expected to be replaced.
- General `console.log` debug statements scattered through `middleware.ts` beyond the token-logging already called out at P1.

---

## O. Proposed Implementation Sequence

```text
Phase 0 — Security/architecture remediation
   • P0-1 (nurse patient-linking) and P0-2 (live RLS state) both confirmed resolved 2026-08-19
   • Fix P1-3 (storageKey trust), P1-4 (unauthenticated endpoint), P1-5 (token logging)
   • Decide & implement session-invalidation strategy for role/password/suspension (P1-8),
     since CareBoard's device model depends on revocation existing at all

Phase 1 — Shared patient detail structure
   • Already substantially done (app/components/patient/* — confirmed during this audit)
   • Close the remaining isLocked inconsistency (family PATCH) while this code is
     already the active area of work

Phase 2 — Permission engine
   • Extract lib/permissions.ts (Section L) from the currently-duplicated inline pattern
   • This is a refactor of duplication into shared functions with IDENTICAL behavior —
     not a redesign — and is the right moment to close P2's isLocked gap for real

Phase 3 — Patient timeline foundation
   • New TimelineEvent table (Section K), FK'd to Patient, populated by domain writes
   • Retire/remove HomeCase + CaseAssignment (P2) before or during this phase

Phase 4 — Nursing schedule + open shifts
   • New Shift/Appointment domain tables, feeding TimelineEvent
   • Reuse the NursePatient-relationship access-control pattern, now via the Phase 2
     permission functions rather than re-copied inline checks

Phase 5 — Appointments/reminders
   • Extend Phase 4's model; route SMS reminders through a PHI-minimal template
     (close P1-9 as part of this phase, not before, since the reminder infrastructure
     is being touched anyway)

Phase 6 — Progress Notes
   • New ProgressNote table with author/signed-status/version fields per Section 9
   • Separate authorization decision from the TimelineEvent entry per Section 9's
     explicit requirement

Phase 7 — PA/document packet workflows
   • Section 10's assembly/export workflow, built on the now-centralized permission layer

Phase 8 — Daily briefings + handoff
   • Derived views over the by-then-populated TimelineEvent data (Section 11/12)

Phase 9 — CareBoard display
   • Only after Phase 0's session/revocation work exists — device registration model,
     two-tier trust (Section M), before any wall-display code is written

Phase 10 — Advanced automation
   • Section 13's external-provider intake, further notification rules
```

This sequence follows the audit doc's own suggested shape (Section O template) with one adjustment: **Phase 0 is expanded and made a hard prerequisite**, because P0-1 specifically (self-service patient linking with no verification, now resolved) was a structural flaw that CareBoard — a feature explicitly designed to widen access to patient data into new physical/device contexts — would have made materially worse if left unresolved. With both P0 findings closed, Phase 0's remaining scope is the P1 items (Section N).

---

## Answers to Section 26 Questions

1. **Is every private route authenticated?** PARTIALLY. Every page route matched by `middleware.ts` (`/admin`, `/nurse`, `/portal`, `/resources`, `/care`, `/family`) is authenticated. Every API route reviewed except `app/api/nurse/document-inquiry/route.ts` independently authenticates. That one route is a confirmed gap (P1-4).

2. **Is 2FA enforced server-side?** YES, in the sense that 2FA state and the two-cookie (`pending_2fa`/`auth_token`) separation are entirely server-controlled and cannot be bypassed by direct route navigation. PARTIALLY in the sense that 2FA itself is not mandatory for every role — it activates only via a site-wide toggle or a per-user opt-in flag, neither hardcoded true for any role including admin (current live value of the toggle is `UNVERIFIED`).

3. **Is every patient request patient-authorized?** YES. Every document/medication/demographics/insurance route reviewed correctly re-derives the specific patient relationship server-side. The one previously-confirmed exception — the *creation* of that relationship itself via `app/api/nurse/patients/route.ts` (P0-1) — is resolved as of 2026-08-19: linking now requires a signed match token proving a real search match, not a bare client-supplied ID.

4. **Are API routes independently authorized?** YES, as a general pattern (confirmed in ~20+ routes read directly across all three role trees), with the one confirmed missing-auth exception, P1-4, still open.

5. **Are Server Actions independently authorized?** UNVERIFIED/not applicable — no Server Actions were found in the patient/document/medication code paths; the app uses API routes exclusively for these flows as far as this audit's file reads could confirm.

6. **Is Supabase RLS enabled on every relevant table?** YES — confirmed 2026-08-19 by Alex directly against the live database. Enabled on every table except `CarcCode` (non-PHI) and `prisma_migrations` (Prisma internal). Migration-file evidence alone (Section F) could not show this; it undercounted because most of this was applied manually outside tracked migrations. See Finding P0-2 (resolved).

7. **Are RLS policies sufficient?** NOT APPLICABLE — no `CREATE POLICY` statements exist anywhere in the migration history; zero-policy default-deny is sufficient *because* the app never needs the PostgREST API to serve any table (it uses Prisma exclusively via `DATABASE_URL`, which bypasses RLS entirely).

8. **Can a user alter their role?** NO — no route was found that allows a user to write to their own `User.role`. `register-public` hardcodes `role: 'nurse'`. Admin-only routes create other roles.

9. **Can a user alter their patient relationships?** NO for nurses as of 2026-08-19 — the P0-1 gap (a nurse could create their own `NursePatient` link to an arbitrary patient ID) is closed; linking now requires a signed match token from a real search result. NO for guardians (invite flow correctly checks the inviter's own existing link first). NO for direct role-escalation of an existing relationship (e.g., a guardian cannot make themselves an admin-equivalent).

10. **Can a provider access an unassigned patient by ID?** NO for nurses through the normal patient-detail/document/medication routes (`NursePatient` + `isActive` check enforced everywhere reviewed), and the P0-1 self-assignment path is now closed as well.

11. **Can a family user access another family's patient by ID?** NO — every family-scoped route reviewed independently checks `guardianPatient.findUnique({ userId_patientId })` for the specific requesting user and specific patient ID; no bypass was found.

12. **Are S3 objects private?** YES per code evidence (no public ACLs anywhere, presigned-URL-only access pattern) — live bucket configuration itself is `UNVERIFIED` (no AWS console access this session).

13. **Are file downloads authorization-checked?** YES for the read/delete paths (patient-relationship re-verified before the storageKey is ever touched). The *write*/confirm path has a gap (P1-3) that can be used to attach an unauthorized storageKey to an otherwise-authorized document row.

14. **Are privileged keys absent from client bundles?** YES per this session's evidence — no `NEXT_PUBLIC_SUPABASE_*`, `AWS_*`, `SUPABASE_SERVICE_ROLE_KEY`, or other privileged env var is referenced anywhere in `app/`/`lib/` source, so Next.js would not inline any of them into a client bundle. Actual built `.next/` output was not decompiled/searched in this session to double-confirm — `UNVERIFIED` at that level of certainty, though the source-level evidence is strong.

15. **Is PHI protected from accidental caching?** PARTIALLY — Next.js's implicit dynamic-detection (routes reading cookies/headers are excluded from static generation by default) provides real protection, but no route sets an explicit `Cache-Control: no-store` or `export const dynamic = 'force-dynamic'`, so the guarantee rests on framework defaults rather than an audited, explicit control.

16. **Is PHI absent from URLs where practical?** YES — only opaque UUIDs appear in patient-related URL paths; no PHI field values were found in URLs or query strings.

17. **Is the current patient model reusable?** YES — `Patient`/`PatientPA`/`PatientMedication`/`PatientDocument`, each FK'd to `Patient.id` with cascade delete and consistent per-role access-check idiom, is a solid foundation for the timeline extension in Section K.

18. **Is the current calendar model reusable?** NO — see Section J. `GlobalEvent`/`TimeEntry`/`NurseReminder` serve different, narrower purposes; a new generalized event model is required, though the patient-relationship access-control pattern around it is reusable.

19. **Is there a centralized permission layer?** NO — the pattern is consistent by careful hand-copying, not centralized into shared functions. See Section L's recommendation.

20. **Is there a usable audit-log system?** PARTIALLY — `ClaimAuditLog` (billing edits only) and `LoginLog` (login attempts only) exist; no audit trail exists for patient record views/edits, document access, or medication changes.

21. **Can Progress Notes be added safely to the current architecture?** YES, conditionally — following the same `Patient`-FK'd domain-table + relationship-check pattern already proven correct for `PatientPA`/`PatientMedication`, once Phase 0's P0 items are closed and (ideally) Phase 2's permission layer exists so the note's view/edit/sign checks aren't hand-copied a fourth time.

22. **Can PA-document exports be added safely?** YES, conditionally on the same basis — Section 10's provenance requirement ("avoid silently altering signed clinical records") has no existing violation to point to since no signed-record concept exists yet; this is a forward-looking design requirement to build correctly from the start, not a gap in current code.

23. **Can a CareBoard device be supported safely?** NOT YET, on the current session/authorization model. See Section M — no device concept, no revocation mechanism, no two-tier trust model exist today; all three need to be designed before a wall-mounted display should hold any session longer-lived than an ordinary login.

24. **What must be fixed before any of these features are built?** Both non-negotiable P0 items — P0-1 (nurse patient-linking verification gap) and P0-2 (live RLS state) — are resolved as of 2026-08-19. P1-3 (storageKey trust), P1-5 (token logging), and P1-8 (no session revocation) are the next items to close, since CareBoard specifically depends on P1-8 existing in some form, and Progress Notes/PA exports depend on the document-authorization guarantee that P1-3 currently weakens.
