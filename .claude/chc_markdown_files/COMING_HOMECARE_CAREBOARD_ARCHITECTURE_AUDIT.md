# Coming Homecare — Care Platform Architecture Audit & CareBoard Readiness Specification

**Purpose:**  
This document is the working instruction set for Claude Code to evaluate the existing Coming Homecare repository **before any new CareBoard, patient timeline, scheduling, clinical documentation, authorization-tracking, or home-display features are built.**

The immediate objective is **not to begin coding the new feature set.**  
The immediate objective is to determine whether the current application structure, authentication model, authorization boundaries, database design, file-storage model, routing, and user-role restrictions are strong enough to support the next phase safely and cleanly.

The future direction of Coming Homecare is shifting away from billing as the primary product value.

The platform should increasingly become a **digital home-care operating system** that reduces or removes the need for families, nurses, and caregivers to manually fill out, file, sort, store, retrieve, and exchange paper records.

Billing functionality should remain available because it may be needed again, but it should no longer dictate the architecture of the platform.

---

# 1. Core Product Direction

Coming Homecare should evolve around a shared patient-care data layer that can support:

- Patient schedules
- Nursing schedules
- Open shifts
- Shift coverage
- Shift substitutions
- Medical appointments
- Medication reminders
- Medication refill reminders
- Prior authorization tracking
- Prior authorization renewal reminders
- Physician-order tracking
- Care-plan renewal tracking
- Progress Notes
- Shift handoff information
- Daily care briefings
- Supporting-document lookback periods
- PDF/export/print workflows
- Fax-ready document packets
- Family notes
- Provider notes
- Patient-specific tasks
- Recurring care tasks
- Document storage
- Home Care Display / CareBoard
- Mobile and desktop portal views
- Future automation and notification rules

The architecture should support these features from the **same underlying patient record and event system**, rather than creating independent feature-specific silos.

---

# 2. Critical Rule: Audit Before Modification

## DO NOT begin implementing the CareBoard or timeline features yet.

The first task is to inspect the existing repository and document what currently exists.

Do not:

- Assume a route exists.
- Assume authentication is enforced because a page is hidden in navigation.
- Assume authorization is enforced because a user role exists.
- Assume Supabase RLS is enabled.
- Assume middleware protects all private routes.
- Assume API routes repeat authorization checks.
- Assume client-side filtering is sufficient.
- Assume patient IDs cannot be manipulated.
- Assume file URLs are private.
- Assume AWS S3 objects are safely isolated.
- Assume admin privileges cannot leak into provider/family contexts.
- Assume 2FA applies uniformly to every relevant login/session path.
- Assume a UI permission represents a server-side permission.
- Refactor working code simply because a different pattern would be cleaner.

**Report what exists first.**

If something cannot be verified from the repository, explicitly label it:

> `UNVERIFIED`

Do not infer that it is secure or implemented.

---

# 3. Known Current Platform Context

Use these facts only as orientation. Verify each implementation in the repository.

## Technology

Coming Homecare currently uses or has used:

- Next.js
- Vercel
- Supabase
- AWS S3 for HIPAA-sensitive document storage
- Role-based portals
- 2FA
- TextBelt for SMS-related functionality
- Resend for email
- GitHub for source control

## Known User Roles

The database `Role` enum currently defines five values: `nurse`, `admin`, `biller`, `provider`, `guardian`.

`family` and `guardian` refer to the same account level — the portal/route naming uses `family` (`/family/...`) while the underlying role value and schema fields use `guardian` (e.g. `guardianLinks`). Treat the two terms as interchangeable throughout this audit; do not treat a reference to one as excluding the other.

`nurse` and `provider` are distinct role values, not synonyms — `nurse` is the primary caregiver role with its own portal (`/nurse/...`); `provider` represents another category of authorized care provider and does not currently have a confirmed dedicated portal. `biller` is a third-party billing role, also without a confirmed dedicated portal.

Do not assume these are the only role values in the database. Verify. Specifically verify what routes/pages, if any, a `provider`- or `biller`-role account can reach, since neither maps cleanly to the three known portals (`/admin`, `/nurse`, `/family`).

## Known Patient Detail Direction

Patient information includes or is intended to include sections such as:

- Demographics
- Insurance
- Medications
- Documents

The family portal has previously used a routed patient-detail page.

Admin/provider implementations may differ.

Inspect current code rather than relying on this description.

---

# 4. Primary Audit Goal

Determine whether Coming Homecare currently has a safe and scalable foundation for the following model:

```text
                         PATIENT
                            │
                            ▼
                  PATIENT CARE DATA LAYER
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
      Timeline Events   Clinical Data     Documents
           │                │                │
           └────────────────┼────────────────┘
                            │
                            ▼
                    PERMISSION ENGINE
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
       Admin             Provider            Family
          │                 │                  │
          └─────────────────┼──────────────────┘
                            ▼
                         VIEWS
                            │
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                    ▼
   Web Portal           Mobile View        CareBoard
```

The CareBoard should eventually be another authorized view of the same patient data, not a separate application with a duplicate database.

---

# 5. Audit Workstreams

Complete the audit in the following order.

---

# Workstream A — Repository Structure

Document the current repository structure.

Identify:

- Next.js version
- App Router vs Pages Router
- Route groups
- Layouts
- Middleware
- Server Components
- Client Components
- API routes
- Server Actions
- Shared libraries
- Authentication helpers
- Authorization helpers
- Supabase clients
- Database access helpers
- AWS/S3 helpers
- Notification helpers
- SMS helpers
- Email helpers
- Patient-related components
- Schedule/calendar components
- Document components
- Medication components
- Insurance components
- Admin components
- Provider components
- Family components
- Shared UI components

Produce a concise directory map showing only architecture-relevant files.

Example:

```text
app/
├── admin/
├── provider/
├── family/
├── api/
├── components/
└── ...

lib/
├── auth/
├── supabase/
├── permissions/
└── ...
```

Do not dump every file in the repository.

---

# Workstream B — Authentication

Determine exactly how authentication works.

Document:

1. Login flow
2. Session creation
3. Session validation
4. Session expiration
5. Refresh-token handling
6. Logout
7. Password reset
8. Email verification
9. 2FA enrollment
10. 2FA challenge
11. 2FA verification
12. Recovery flow
13. Remembered/trusted-device behavior, if any
14. Session invalidation after password change
15. Session invalidation after role change
16. Session invalidation after account suspension
17. Whether 2FA state is stored server-side
18. Whether 2FA can be bypassed by directly visiting a protected route

Identify every location where authenticated state is trusted.

Specifically determine whether authentication is enforced:

- In middleware
- In layouts
- In pages
- In API routes
- In Server Actions
- In database policies
- In file-access endpoints

A UI redirect alone is not sufficient protection.

---

# Workstream C — Authorization

Authentication answers:

> Who is this user?

Authorization must answer:

> Is this specific user allowed to perform this specific action on this specific patient/resource?

Document how authorization currently works.

Look for:

- Role checks
- Patient assignments
- Family-to-patient relationships
- Provider-to-patient relationships
- Admin privileges
- Resource ownership
- Organization/account boundaries
- Per-field permissions
- Read permissions
- Create permissions
- Edit permissions
- Delete permissions
- Download permissions
- Upload permissions

Determine whether authorization is:

- Client-side only
- Server-side
- Database-enforced
- Repeated at multiple layers

## Critical Test

For every patient-facing resource, answer:

> If User A knows Patient B's UUID or URL, can User A access Patient B's information by manually changing the route, query parameter, request body, or API request?

This includes:

- Demographics
- Insurance
- Medications
- Documents
- Notes
- Schedules
- Appointments
- Future Progress Notes
- Future PA records
- Future CareBoard feeds

Look specifically for **IDOR / Broken Object Level Authorization** vulnerabilities.

---

# Workstream D — Current Permission Matrix

Create a matrix of current behavior.

Use actual code behavior, not intended behavior.

Example format:

| Resource | Action | Admin | Assigned Provider | Unassigned Provider | Linked Family | Unlinked Family |
|---|---|---:|---:|---:|---:|---:|
| Patient Demographics | View | ? | ? | ? | ? | ? |
| Patient Demographics | Edit | ? | ? | ? | ? | ? |
| Insurance | View | ? | ? | ? | ? | ? |
| Medication | View | ? | ? | ? | ? | ? |
| Documents | View | ? | ? | ? | ? | ? |
| Documents | Upload | ? | ? | ? | ? | ? |
| Documents | Delete | ? | ? | ? | ? | ? |

Expand this table for all currently implemented patient resources.

Use:

- `ALLOW`
- `DENY`
- `CLIENT-ONLY`
- `UNVERIFIED`

Where possible.

---

# Workstream E — Supabase / Database Security

Inspect all Supabase usage.

Document:

- Tables
- Important relationships
- Patient ownership/assignment tables
- User profile tables
- Role fields
- Foreign keys
- RLS status
- RLS policies
- SECURITY DEFINER functions
- RPC functions
- Triggers
- Views
- Public schema exposure
- Service-role usage
- Service-role key location
- Any direct browser-to-database access

## Verify RLS

For every table containing or linking to patient information, determine:

- Is RLS enabled?
- What policies exist?
- What operations do policies cover?
- Do policies use `auth.uid()` correctly?
- Can users modify assignment/ownership fields?
- Can a provider assign themselves to another patient?
- Can a family user alter a patient link?
- Can a role be escalated through an update?
- Can an insert create unauthorized relationships?

Do not treat RLS as secure merely because it is enabled.

Evaluate the policy logic.

---

# Workstream F — Privileged Credentials

Search the repository for:

- `SUPABASE_SERVICE_ROLE_KEY`
- AWS credentials
- S3 secrets
- TextBelt keys
- Resend keys
- Database passwords
- JWT secrets
- encryption keys
- API tokens
- private keys

Determine whether any privileged key is:

- Bundled into client code
- Exposed through `NEXT_PUBLIC_*`
- Returned through APIs
- Logged
- Embedded in source
- Used from a Client Component

Any service-role or privileged credential that can reach the browser is a **CRITICAL** finding.

Do not print secret values in the audit report.

Only report variable names and locations.

---

# Workstream G — Patient Route Security

Inventory patient routes.

Examples may include patterns like:

```text
/admin/patients/[id]
/provider/patients/[id]
/family/patients/[id]
```

For every route, determine:

1. Is authentication required?
2. Is role authorization required?
3. Is patient-level authorization required?
4. Where is that authorization performed?
5. Can route parameters be manipulated?
6. Does the server independently verify access?
7. Are unauthorized requests rejected or merely redirected?
8. Does the page fetch more data than the user needs?

Prefer **server-enforced patient authorization** before patient data is returned.

---

# Workstream H — API / Server Action Security

Inventory all APIs and Server Actions that:

- Read patient information
- Write patient information
- Upload files
- Download files
- Delete files
- Change users
- Change roles
- Send messages
- Send SMS
- Send email
- Update schedules
- Manage medications
- Manage insurance
- Manage documents

For each one, determine whether it independently validates:

- Authenticated user
- Role
- Patient association
- Resource ownership
- Allowed operation
- Input schema

Never rely on the page that called an API to have already checked authorization.

---

# Workstream I — File and AWS S3 Security

Because Coming Homecare may contain PHI, inspect the complete document workflow.

Determine:

- Are buckets private?
- Are object URLs public?
- Are signed URLs used?
- Signed URL duration
- Upload path structure
- Download path structure
- Delete authorization
- Filename sanitization
- MIME/type validation
- File-size limits
- Object-key predictability
- Cross-patient access risks
- Whether user-controlled paths reach S3
- Whether metadata contains PHI
- Whether logs expose PHI
- Whether uploads can execute active content

## Critical Test

If a user obtains or guesses another patient's S3 object key, can they retrieve the file?

File authorization should be based on the **logged-in user's relationship to the patient**, not merely possession of an object key.

---

# Workstream J — PHI Exposure Review

Identify places where PHI or patient-identifying information may be exposed through:

- URLs
- Browser logs
- Server logs
- Analytics
- Error reporting
- Client state
- LocalStorage
- SessionStorage
- Cookies
- Query strings
- Email notifications
- SMS notifications
- Push notifications
- File names
- S3 object keys
- Public HTML
- Search engine indexing
- Static generation
- cached responses

Pay particular attention to Next.js caching behavior.

Patient-specific pages should not accidentally be statically generated or shared across users.

---

# Workstream K — 2FA Boundary Review

Evaluate whether 2FA protects the account consistently.

Check for paths that might bypass it:

- Direct URL navigation
- Existing session cookies
- API requests
- Server Actions
- Password-reset flows
- Social/OAuth login, if present
- Newly created accounts
- Invited users
- Role switching
- Impersonation tools
- Admin-created users
- Refresh-token flows

Document exactly what marks a session as:

> 2FA VERIFIED

Determine whether that state is trusted server-side.

---

# Workstream L — Current Calendar/Scheduling Capability

Locate all existing calendar and scheduling code.

Document:

- Calendar libraries
- Schedule tables
- Shift tables
- Appointment tables
- Event models
- Recurrence support
- Timezone handling
- User timezone handling
- Patient timezone handling
- Shift assignment logic
- Existing status values
- Notification hooks
- Existing schedule permissions

Determine whether the current model can become the foundation for the future patient timeline or whether a new generalized event model is needed.

Do not replace the current model yet.

Report the recommendation.

---

# 6. Future Architecture Requirement — Patient Timeline

The next build phase should support a generalized patient timeline.

Claude should evaluate how the current data model could evolve toward something conceptually similar to:

```text
Patient
   │
   ├── Timeline Event
   │      ├── Shift
   │      ├── Appointment
   │      ├── Medication Reminder
   │      ├── PA Deadline
   │      ├── Order Renewal
   │      ├── Progress Note
   │      ├── Document
   │      ├── Task
   │      └── Family Reminder
   │
   ├── Providers
   ├── Family Members
   ├── Medications
   ├── Insurance
   ├── Authorizations
   └── Documents
```

This does **not** necessarily mean storing everything in one giant table.

The recommended implementation may use:

- Specialized domain tables
- A shared timeline/event index
- Views
- Event references
- Polymorphic relationships
- A hybrid approach

Claude should recommend the safest and most maintainable option based on the existing schema.

---

# 7. Future Feature — CareBoard / Home Care Display

The future CareBoard should be treated as another authorized client of the existing platform.

It should not have broad patient privileges merely because it is installed inside the patient's home.

Future design should support at least two access states.

## Household Display Mode

May show limited information such as:

- Date
- Time
- Assigned nurse
- Shift times
- Appointment title/time
- Non-sensitive reminders
- Coverage-needed indicators

It should avoid displaying detailed PHI while unattended.

## Authorized Clinical Mode

After an authorized unlock, the CareBoard may expose additional information according to the user's permissions.

Possible unlock methods may later include:

- PIN
- Passkey
- Authenticated phone approval
- Device-bound authentication

Clinical mode should automatically expire after inactivity.

Claude should **not implement this yet**.

During the audit, determine what authentication/session architecture would be required to support a semi-persistent household display safely.

---

# 8. Future Feature — Nursing Shift Coordination

The architecture should eventually support:

```text
Scheduled Shift
      │
      ├── Assigned
      │
      ├── Coverage Needed
      │
      ├── Open
      │
      ├── Requested
      │
      ├── Pending Family Approval
      │
      ├── Covered
      │
      ├── Completed
      │
      └── Cancelled
```

Potential workflow:

```text
Ashley RN scheduled
        ↓
Requests coverage
        ↓
Shift becomes available to eligible providers
        ↓
Jennifer RN requests shift
        ↓
Automatic assignment
        OR
Family approval
        ↓
Calendar updates for authorized users
```

The future design must prevent:

- Unassigned providers seeing inappropriate patient information
- Providers claiming shifts for patients they are not permitted to serve
- Providers modifying another nurse's completed documentation
- Family users assigning unauthorized providers
- Client-side manipulation of shift assignments

---

# 9. Future Feature — Progress Notes

When electronic Progress Notes are built, the record should be linked to:

- Patient
- Author/provider
- Service date
- Shift, when applicable
- Start/end time, when applicable
- Signed status
- Signature timestamp
- Version/history
- Supporting documents, if applicable

A completed Progress Note should be capable of appearing automatically on the corresponding patient timeline/calendar date.

Authorized users may later select:

```text
Calendar Date
    ↓
Progress Note icon
    ↓
View authorized Progress Note
```

Do not make clinical documents readable merely because someone can see the calendar event.

The calendar entry and the clinical document require separate authorization decisions.

---

# 10. Future Feature — Prior Authorization Documentation

The future system should support a workflow where an authorized user selects:

- Authorization
- Requested date range/lookback period
- Supporting document types

The application can then assemble eligible records such as:

- Progress Notes
- Orders
- Care plans
- Medication lists
- Appointment information
- Supporting clinical records

Potential output:

- Combined PDF
- Individual PDFs
- Print packet
- Download
- Future secure fax workflow

The architecture should preserve document provenance and avoid silently altering signed clinical records.

---

# 11. Future Feature — Daily Care Briefing

The patient timeline should eventually make it possible to generate an authorized daily briefing containing relevant items such as:

- Today's assigned provider
- Appointments
- Transportation information
- Relevant tasks
- Medication/refill reminders
- PA reminders
- Important handoff information
- Documentation due

This should be derived from existing structured data, not maintained as a second manually duplicated schedule.

---

# 12. Future Feature — Shift Handoff

Evaluate how the current platform could eventually support a handoff object separate from the permanent Progress Note.

Potential examples:

- Recent PRN medication
- Sleep changes
- Feeding changes
- Respiratory changes
- Equipment concerns
- Upcoming appointment
- Delivery expected
- Family instruction

Handoff visibility must follow patient/provider authorization.

---

# 13. Future Feature — External Provider Document Intake

External medical providers (MD, NP, PA, surgeon, specialist, etc.) do not currently need a full portal account. They keep their own records in their own systems; Coming Homecare only needs a way to receive documents *from* them when a family member or RN requests records be shared into the patient's file.

## Intake Model

Rather than generating a unique inbound email address per provider or per patient, the design should use a small, fixed number of centralized intake addresses (one to start, expandable to two or three as volume grows — e.g. by region or team) that any external provider can send documents to.

```text
External provider emails documents
            ↓
   Centralized intake address
            ↓
      Pending queue (unapproved)
            ↓
  RN or family member reviews
            ↓
      Approve            Reject/discard
         ↓
  Saved to patient record
  (persists until manually deleted)
```

Documents landing in the pending queue are not yet part of the patient's official record and should not be visible through normal patient-document views until approved.

## Provider Attribution Code

Because a shared intake address can't infer which patient or provider a message belongs to from the sender alone, each patient's **Care Team** entry for a given provider (once that provider record already exists on the patient) should support generating a **5-digit code, system-wide unique and never reused**, stored on that specific provider-within-patient care-team entry.

Once generated, the code is bound to that specific provider entry on that specific patient's Care Team — it is not a general-purpose or reusable submission code.

The provider includes this code (e.g. in the subject line) when emailing documents. The intake pipeline should look up the code and, on a match, automatically move the submitted documentation onto that patient's profile (into the pending queue) for RN/family review — no manual matching of an incoming document to a patient should be required.

## Audit Considerations (for this future feature, not to be built now)

- Pending-queue documents still contain PHI before approval and must be protected by the same access rules as approved documents, not treated as a lower-security holding area.
- A 5-digit code arriving in an email is a routing token, not proof of sender identity — inbound mail is otherwise unauthenticated, so the approval step (not the code) is the actual security control.
- Code generation must guarantee uniqueness and non-reuse at the database level, not just at the UI.
- Attachment handling should follow the same MIME/type validation and malicious-content considerations as Workstream I.
- Approval/rejection should be attributable (who approved, when) per the audit-logging model in Section 15.

---

# 14. Security Principles for the Next Phase

The future build should follow these principles.

## Principle 1 — Default Deny

If access is not explicitly granted, deny it.

## Principle 2 — Server Enforcement

UI hiding is convenience.

Server-side authorization is security.

## Principle 3 — Patient-Level Authorization

A valid account does not automatically grant access to every patient.

## Principle 4 — Least Privilege

Each role should receive only the data and operations it requires.

## Principle 5 — Defense in Depth

Where appropriate:

```text
Authenticated session
        ↓
2FA state
        ↓
Role authorization
        ↓
Patient relationship
        ↓
Resource permission
        ↓
Database/RLS enforcement
```

## Principle 6 — Never Trust IDs from the Browser

Patient IDs, document IDs, shift IDs, note IDs, provider IDs, and authorization IDs supplied by a client must be revalidated server-side.

## Principle 7 — Avoid PHI in Notifications

SMS/email notifications should contain minimal information.

Prefer:

> You have an updated schedule item in Coming Homecare.

rather than including clinical details.

## Principle 8 — Audit Sensitive Actions

The future architecture should support an audit trail for actions such as:

- Viewing sensitive documents
- Creating Progress Notes
- Signing Progress Notes
- Editing records
- Deleting records
- Downloading documents
- Exporting documentation
- Changing schedules
- Reassigning shifts
- Changing permissions
- Changing patient relationships

---

# 15. Audit Logging Readiness

Inspect whether an audit-log system currently exists.

If it does, document:

- Event types
- User ID
- Patient ID
- Resource ID
- Timestamp
- Action
- IP/device data, if collected
- Before/after state
- Retention

If it does not exist, recommend an architecture.

Do not implement it during the audit.

---

# 16. Data Integrity Review

Evaluate whether the existing schema protects against:

- Orphaned records
- Duplicate patient assignments
- Invalid role values
- Deleted-user references
- Deleted-patient references
- Duplicate shifts
- Overlapping shift assignments
- Modification of signed records
- Reassignment of authored records
- Cascading deletion of clinical history
- Missing timestamps
- Unbounded free-text storage
- Timezone inconsistencies

---

# 17. Authorization Model Recommendation

After documenting current behavior, recommend a future authorization model.

Prefer centralized permission functions such as conceptually:

```ts
canViewPatient(user, patientId)
canEditPatient(user, patientId)

canViewMedication(user, patientId)
canEditMedication(user, patientId)

canViewDocument(user, documentId)
canUploadDocument(user, patientId)
canDeleteDocument(user, documentId)

canViewProgressNote(user, noteId)
canCreateProgressNote(user, patientId)
canEditProgressNote(user, noteId)

canViewSchedule(user, patientId)
canModifyShift(user, shiftId)
canClaimOpenShift(user, shiftId)

canViewAuthorization(user, authorizationId)
canExportClinicalPacket(user, patientId)
```

The exact implementation should be based on the existing codebase.

The goal is to avoid scattered patterns such as:

```ts
if (role === "family") ...
```

being independently recreated across dozens of components and endpoints.

---

# 18. Field-Level Permission Readiness

Coming Homecare may require different roles to have different permissions within the same patient record.

Evaluate whether the current design can support:

```text
Resource
 ├── View
 ├── Create
 ├── Edit
 ├── Delete
 ├── Download
 ├── Export
 └── Share
```

Example:

```text
Medication
Admin       View/Edit/Delete
Provider    View/Edit
Family      View
```

Actual permissions should not be assumed from this example.

Document current behavior and recommend a maintainable model.

---

# 19. Patient Relationship Model

Determine how users become linked to patients.

Document:

- Who can create the relationship
- Who can remove it
- Whether start/end dates exist
- Whether relationships can expire
- Whether provider relationships have status
- Whether family relationships have type
- Whether inactive providers retain access
- Whether deleted/suspended users retain access through old sessions

Future provider-patient relationships may require fields similar to:

```text
patient_id
user_id
relationship_type
status
starts_at
ends_at
permissions
created_by
created_at
```

Do not implement this schema unless the existing model requires migration and a later phase is approved.

---

# 20. CareBoard Device Security Readiness

Evaluate what would be needed for a wall-mounted device that stays logged into Coming Homecare.

Consider:

- Device registration
- Device-specific session
- Patient binding
- Limited display scope
- Session expiration
- Remote logout
- Device revocation
- Lost/stolen device handling
- PIN lock
- Automatic privacy mode
- Idle timeout
- Browser refresh behavior
- Power loss/restart
- Network reconnection
- Offline display
- Cached PHI
- LocalStorage
- Service workers
- IndexedDB
- Screenshots/browser history
- URL exposure

Do not use a standard unrestricted user session as the default long-term CareBoard model without evaluating the risk.

---

# 21. Current Technical Debt

Identify technical debt that could materially interfere with this expansion.

Classify findings:

### P0 — Critical Security
Must be fixed before new PHI-related functionality.

### P1 — Structural Blocker
Likely to cause duplication, authorization errors, or major rework.

### P2 — Important Cleanup
Should be addressed while building the new architecture.

### P3 — Cosmetic / Low Risk
Can wait.

Examples:

- Client-only authorization → P0/P1
- Exposed service-role key → P0
- Public patient document bucket → P0
- Duplicate patient-detail implementations → P1/P2
- Repeated role-check code → P1/P2
- Styling inconsistency → P3

---

# 22. Do Not Break Existing Features

During later implementation, preserve currently working functionality unless explicitly approved for replacement.

This includes:

- Existing login
- 2FA
- Existing user roles
- Patient access
- Patient demographics
- Insurance
- Medications
- Documents
- Current notifications
- Existing billing functionality

Billing may become less prominent, but it should not be deleted merely because the strategic focus is changing.

---

# 23. Billing Feature Direction

Billing should remain as an available module but become decoupled from the identity of the platform.

Recommended conceptual structure:

```text
Coming Homecare
│
├── Care Coordination
├── Patient Timeline
├── Schedule
├── Clinical Documentation
├── Documents
├── Authorizations
├── CareBoard
│
└── Billing
```

Do not allow existing billing-specific assumptions to dictate future patient architecture.

---

# 24. Required Audit Deliverables

After inspection, create the following report.

## A. Executive Summary

Maximum approximately 1 page.

Answer:

- Is the current foundation safe enough to extend?
- What are the largest architectural strengths?
- What are the largest risks?
- Are there any P0 blockers?
- Can the existing calendar/scheduling structure be reused?
- Can the existing patient model support the timeline?
- Is the authorization model centralized enough?
- Is CareBoard feasible without major restructuring?

---

## B. Current Architecture Map

Show:

```text
Authentication
Authorization
Database
Storage
Patient routes
API layer
Role portals
Notifications
Calendar
Documents
```

Explain how data currently flows.

---

## C. Authentication & 2FA Report

Document actual implementation and gaps.

---

## D. Authorization Matrix

Create the current role/resource/action matrix.

---

## E. Patient Access Flow

Trace one request end-to-end.

Example:

```text
Family user opens /family/patients/[id]
                ↓
Middleware
                ↓
Session validation
                ↓
2FA validation
                ↓
Patient relationship check
                ↓
Database/RLS
                ↓
Page data
```

Show which steps actually exist.

---

## F. Database / RLS Report

For relevant tables:

| Table | Contains PHI | RLS | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy | Risk |
|---|---|---|---|---|---|---|---|

---

## G. Route/API Security Report

List patient-sensitive routes/actions and their enforcement.

---

## H. File Security Report

Describe upload/download/delete flow and S3 risk.

---

## I. PHI Exposure Report

List potential exposure points.

---

## J. Current Calendar Model

Document existing schedule/calendar architecture and whether it is reusable.

---

## K. Recommended Patient Timeline Architecture

Provide a conceptual future schema.

Do not generate migrations yet unless explicitly requested after the audit.

---

## L. Recommended Permission Architecture

Show how permissions should be centralized.

---

## M. CareBoard Security Architecture

Describe how a household wall display should authenticate safely.

---

## N. Prioritized Remediation List

Use:

```text
P0
P1
P2
P3
```

For every item include:

- Problem
- File/table involved
- Why it matters
- Recommended correction
- Whether correction is required before CareBoard development

---

## O. Proposed Implementation Sequence

Create a phased build plan.

A likely sequence may resemble:

```text
Phase 0 — Security/architecture remediation
Phase 1 — Shared patient detail structure
Phase 2 — Permission engine
Phase 3 — Patient timeline foundation
Phase 4 — Nursing schedule + open shifts
Phase 5 — Appointments/reminders
Phase 6 — Progress Notes
Phase 7 — PA/document packet workflows
Phase 8 — Daily briefings + handoff
Phase 9 — CareBoard display
Phase 10 — Advanced automation
```

Modify this sequence based on what the repository actually contains.

---

# 25. Required Evidence Standard

Every audit finding must reference actual repository evidence.

Use file paths.

Example:

```text
Finding:
Family patient authorization is performed only in the client.

Evidence:
app/family/patients/[id]/page.tsx
components/PatientDetail.tsx

Risk:
A manipulated API request may bypass the UI restriction.
```

Where useful, include function names or short code references.

Do not paste large blocks of source code into the report.

---

# 26. Questions Claude Must Answer Explicitly

At the end of the audit, answer each question with:

- `YES`
- `NO`
- `PARTIALLY`
- `UNVERIFIED`

Then explain.

1. Is every private route authenticated?
2. Is 2FA enforced server-side?
3. Is every patient request patient-authorized?
4. Are API routes independently authorized?
5. Are Server Actions independently authorized?
6. Is Supabase RLS enabled on every relevant table?
7. Are RLS policies sufficient?
8. Can a user alter their role?
9. Can a user alter their patient relationships?
10. Can a provider access an unassigned patient by ID?
11. Can a family user access another family's patient by ID?
12. Are S3 objects private?
13. Are file downloads authorization-checked?
14. Are privileged keys absent from client bundles?
15. Is PHI protected from accidental caching?
16. Is PHI absent from URLs where practical?
17. Is the current patient model reusable?
18. Is the current calendar model reusable?
19. Is there a centralized permission layer?
20. Is there a usable audit-log system?
21. Can Progress Notes be added safely to the current architecture?
22. Can PA-document exports be added safely?
23. Can a CareBoard device be supported safely?
24. What must be fixed before any of these features are built?

---

# 27. Stop Conditions

Stop and report immediately if any of the following are discovered:

- Service-role key exposed to browser code
- AWS secret exposed to browser code
- Public PHI bucket
- Private patient routes without authentication
- Patient data APIs without patient-level authorization
- User-editable role escalation
- User-editable patient assignment escalation
- 2FA enforced only in the UI
- Cross-patient document access
- Cross-patient clinical data access

These findings should be labeled:

> **P0 SECURITY BLOCKER**

Continue the audit after documenting them, but **do not begin new feature implementation**.

---

# 28. No Premature Refactor

Do not rewrite large sections of the application during discovery.

The expected workflow is:

```text
INSPECT
   ↓
DOCUMENT
   ↓
MAP
   ↓
IDENTIFY RISKS
   ↓
RECOMMEND
   ↓
WAIT FOR IMPLEMENTATION APPROVAL
```

Not:

```text
INSPECT
   ↓
REWRITE
```

---

# 29. Future Design Principle

The platform should gradually move toward:

> **Enter information once. Reuse it everywhere it is authorized and relevant.**

Examples:

A medical appointment entered once should be capable of appearing in:

- Family calendar
- Provider calendar
- CareBoard
- Daily briefing
- Appointment preparation
- Timeline

A completed Progress Note entered once should be capable of appearing in:

- Clinical history
- Calendar date
- PA supporting-document search
- Export packet
- Authorized family review

A nursing shift changed once should update:

- Nurse schedule
- Family schedule
- CareBoard
- Open-shift availability
- Notifications
- Daily briefing

Avoid duplicate manual entry wherever possible.

---

# 30. Product Goal

The next generation of Coming Homecare should reduce administrative burden for families and providers by replacing fragmented paper workflows with secure structured digital workflows.

The system should make it easier to answer questions such as:

- Who is working today?
- Is tomorrow's shift covered?
- What appointments are coming up?
- What happened during yesterday's nursing shift?
- Is the Progress Note completed?
- When does the PA expire?
- Do we have enough supporting notes for renewal?
- What paperwork is missing?
- What medications need refill?
- What should today's nurse know before starting care?
- Where is the document I need?

The answer should increasingly be:

> **Open Coming Homecare.**

---

# 31. First Action

Begin with the repository audit only.

Do not create CareBoard UI.

Do not create database migrations.

Do not create the patient timeline.

Do not modify authentication.

Do not modify authorization.

Do not refactor patient pages.

Do not alter existing billing behavior.

Inspect the existing application and return the complete audit described in this file.

Once the audit is reviewed, the next implementation specification will be created from the actual architecture and findings.

