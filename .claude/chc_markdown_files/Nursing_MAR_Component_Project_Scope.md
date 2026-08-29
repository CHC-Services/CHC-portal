# Nursing MAR Component — Project Scope & Implementation Specification

## 1. Project Overview

Build a mobile-first Medication Administration Record (MAR) component for the nursing portal that allows nurses to quickly document medication administration during a shift without requiring repetitive narrative charting.

The MAR should integrate directly with the patient medication profile and the nurse's progress note workflow.

The core design principle is:

> **Medication Profile = what should happen**  
> **Administration Event = what actually happened**  
> **Progress Note = nurse-facing interface used to record the event**  
> **Master MAR = historical presentation of all medication administration events**

The system should avoid duplicating medication data across multiple areas of the application. The patient's active medication profile should remain the source of truth for medication orders and scheduled administration times.

---

# 2. Primary Goals

The component should:

- Be optimized for mobile phones and touch interaction.
- Minimize typing for routine medication administration.
- Automatically identify which medications fall within a nurse's selected shift.
- Allow nurses to document:
  - Medication administered as scheduled.
  - Medication held.
  - Medication administered early.
  - Medication administered late.
  - Reason for held, early, or late administration.
- Automatically record the authenticated nurse's identity and initials.
- Feed all medication administration activity into a Master MAR.
- Maintain a complete audit trail.
- Prevent historical medication records from changing when current orders are modified.
- Allow authorized caregivers, administrators, or lead nurses to manage medication schedules.
- Support future features such as PRN medications, effectiveness reassessments, medication parameters, missed-dose alerts, and shift handoff warnings.

---

# 3. Core System Architecture

The MAR should consist of four connected layers:

```text
PATIENT MEDICATION PROFILE
        ↓
SCHEDULED MEDICATION TIMES
        ↓
SHIFT MAR / PROGRESS NOTE
        ↓
MASTER MAR ADMINISTRATION RECORD
```

The Master MAR should not be manually maintained as a spreadsheet-style record.

Instead, it should be generated dynamically from medication administration events stored in the database.

---

# 4. Patient Medication Profile

## Purpose

The Patient Medication Profile is the source of truth for active medication orders.

Authorized users may include:

- Administrator
- Parent / caregiver
- Lead nurse
- Other specifically authorized clinical users

Routine shift nurses should generally document administration but should not modify the underlying medication order unless their permissions allow it.

## Recommended Medication Fields

Each medication record should support:

| Field | Example |
|---|---|
| Medication Name | Baclofen |
| Dose | 10 mg |
| Route | G-Tube |
| Frequency | TID |
| Scheduled Times | 08:00 / 14:00 / 20:00 |
| Start Date | 08/01/2026 |
| End Date | — |
| PRN | No |
| Instructions | Flush with 20 mL water |
| Prescriber | Dr. Smith |
| Status | Active |
| Order Source | Uploaded order / manual entry |
| Last Modified | Timestamp + user |
| Medication ID | Unique system ID |

Additional future fields may include:

- Medication strength
- Form
- Pharmacy
- Prescription number
- Last filled date
- Refill count
- Hold parameters
- Maximum daily dose
- PRN indication
- Required reassessment interval
- Controlled substance flag
- Order document reference

---

# 5. Medication Scheduling

A medication may have one or multiple scheduled administration times.

Example:

```text
Baclofen 10 mg via G-Tube

08:00
14:00
20:00
```

These scheduled times should exist as structured records rather than being stored only as free text.

The system should use the medication schedule to determine which doses fall within a nurse's selected shift.

---

# 6. New Progress Note Workflow

When the nurse selects:

```text
New Progress Note
```

the application should display a shift setup modal.

## Required Shift Fields

```text
Date of Service

Shift Start Time

Shift End Time
```

Example:

```text
Date of Service
August 27, 2026

Shift Start
7:00 AM

Shift End
7:00 PM

[ Continue ]
```

After the nurse confirms the shift, the application should query the patient's medication schedule.

The system should identify all medication doses scheduled during the selected time range.

Example:

```text
Shift:
07:00–19:00

Scheduled medications:
08:00 Baclofen
10:00 Keppra
14:00 Baclofen
```

These medications should automatically populate into the medication section of the progress note.

The nurse should not need to manually search for or enter routine medications.

---

# 7. Shift MAR / Progress Note Medication Interface

## Mobile-First Design

The shift MAR should use large touch-friendly medication cards.

Avoid spreadsheet layouts and small checkboxes on mobile devices.

Example:

```text
┌───────────────────────────────┐
│ 8:00 AM                       │
│ BACLOFEN                      │
│ 10 mg • G-Tube                │
│                               │
│ [ ✓ GIVEN ]      [ HELD ]     │
└───────────────────────────────┘
```

Primary actions should use large tap targets.

Routine medication administration should require as few interactions as possible.

---

# 8. Administered Medication Workflow

When the nurse taps:

```text
✓ GIVEN
```

the system should automatically record:

- Medication ID
- Patient ID
- Scheduled administration time
- Actual administration / confirmation time
- Dose
- Route
- Authenticated nurse user ID
- Nurse initials
- Progress note ID
- Administration status
- Timestamp

Example display after completion:

```text
✓ 8:00 AM

BACLOFEN
10 mg • G-Tube

Given 8:03 AM • AM
```

Where `AM` represents the authenticated nurse's stored initials.

Routine on-time administration should not require narrative documentation.

---

# 9. Early and Late Administration

The system already knows:

```text
Scheduled Time
Actual Administration Time
```

Therefore, early or late administration should be calculated automatically.

## Administration Window

The application should support a configurable acceptable administration window.

Example:

```text
±30 minutes
```

A medication documented within the accepted window may simply be considered on time.

A medication documented outside the accepted window should trigger an exception workflow.

Example:

```text
Scheduled: 8:00 AM
Given: 9:02 AM

⚠ Given 62 minutes late
```

The nurse should then select or enter a reason.

## Suggested Early / Late Reasons

- Patient sleeping
- Patient unavailable
- Procedure / appointment
- Medication unavailable
- Clinical assessment
- Patient request
- Caregiver request
- Previous dose administered late
- Provider instruction
- Feeding schedule conflict
- Other

If `Other` is selected, require a short narrative field.

---

# 10. Held Medication Workflow

When the nurse taps:

```text
HELD
```

the system should require a reason before the medication can be finalized.

Example:

```text
BACLOFEN 10 MG
G-Tube
Scheduled: 8:00 AM

Medication Held

Reason:

○ Clinical parameters not met
○ Patient refused
○ Caregiver declined
○ Medication unavailable
○ Provider instruction
○ NPO
○ Patient sleeping
○ Other

Additional Note
[________________________]

[ Confirm Held ]
```

## Held Medication Data

The event should store:

```text
status: held
scheduled_time: 08:00
reason: clinical_parameters_not_met
note: BP 82/46
recorded_by: nurse_user_id
recorded_at: timestamp
```

If `Other` is selected, require a narrative note.

The system may optionally require additional documentation for specific hold reasons.

---

# 11. Shift Medication Progress Indicator

At the top of the medication section, display the nurse's documentation progress.

Example:

```text
MEDICATIONS
August 27 • 7a–7p

3 of 5 completed

████████████░░░░
```

Completed medication cards may collapse or visually change so unresolved medications remain prominent.

Example completed card:

```text
┌───────────────────────────────┐
│ ✓ 8:00 AM                     │
│ BACLOFEN                      │
│ 10 mg • G-Tube                │
│ Given 8:03 AM • AM            │
└───────────────────────────────┘
```

---

# 12. Shift Completion / Handoff Validation

Before the nurse finalizes or signs the progress note, the system should verify that every scheduled medication during the shift has been resolved.

Possible statuses:

```text
Administered
Held
Missed
Not Due
Previously Administered
Refused
Unavailable
```

If unresolved medications remain, display a warning.

Example:

```text
⚠ 1 scheduled medication has not been documented.

8:00 PM — Baclofen 10 mg
```

Depending on configuration, the application may:

- Allow the nurse to continue with a warning.
- Require the medication to be resolved.
- Allow a "Not Administered / Missed" status with explanation.

---

# 13. Master MAR

## Purpose

The Master MAR provides the longitudinal medication administration record for the patient.

The Master MAR should be generated from medication administration events rather than manually entered.

Example:

| Medication | 8/27 8a | 8/27 2p | 8/27 8p |
|---|---|---|---|
| Baclofen 10 mg GT | AM 8:03 | AM 2:00 | — |
| Keppra 500 mg GT | AM 10:01 | — | — |
| Senna 8.6 mg GT | H | — | — |

Possible status indicators:

```text
Initials = administered
H = held
R = refused
M = missed
L = late
E = early
```

The visual presentation can evolve, but the underlying administration event should contain the complete details.

---

# 14. MAR Detail View

Tapping a MAR entry should open the full administration details.

Example:

```text
BACLOFEN 10 MG
G-Tube

Scheduled:
8:00 AM

Administered:
8:03 AM

Nurse:
Alex McGann, RN

Status:
Administered

Entered From:
08/27/26 7a–7p Progress Note
```

For exceptions, display:

```text
Status:
Held

Reason:
Clinical parameters not met

Note:
BP 82/46

Documented:
08/27/26 8:04 AM
```

---

# 15. Recommended Database Structure

The medication system should use separate relational records.

Recommended tables:

```text
patient_medications
medication_schedules
medication_administrations
progress_notes
progress_note_shifts
```

Optional future tables:

```text
medication_orders
medication_order_versions
medication_parameters
prn_reassessments
medication_audit_log
medication_corrections
```

---

# 16. Example Database Relationships

```text
patient_medications
    ID 42
    Baclofen 10 mg GT

        ↓

medication_schedules
    ID 101
    medication_id 42
    scheduled_time 08:00

    ID 102
    medication_id 42
    scheduled_time 14:00

    ID 103
    medication_id 42
    scheduled_time 20:00

        ↓

medication_administrations
    medication_id 42
    schedule_id 101
    scheduled_for 2026-08-27 08:00
    administered_at 2026-08-27 08:03
    status administered
    nurse_id 18
    progress_note_id 392
```

---

# 17. Recommended Medication Administration Record Fields

A medication administration event should contain enough historical information to remain accurate even if the medication order later changes.

Recommended fields:

```text
id
patient_id
medication_id
medication_schedule_id
progress_note_id
shift_id

scheduled_for
administered_at
documented_at

status

medication_name_snapshot
dose_snapshot
route_snapshot
instructions_snapshot

administered_by_user_id
administered_by_name_snapshot
administered_by_credentials_snapshot
administered_by_initials_snapshot

timing_status
minutes_early_or_late

exception_reason
exception_note

created_at
updated_at
corrected_at
corrected_by
correction_reason
```

The snapshot fields are important.

For example, if a prescription later changes from:

```text
Baclofen 10 mg
```

to:

```text
Baclofen 20 mg
```

the MAR from the previous month must continue displaying the 10 mg dose that was active when that medication was administered.

---

# 18. Medication Order Versioning

Medication orders should not be destructively overwritten when clinically significant information changes.

Examples:

- Dose change
- Route change
- Frequency change
- Scheduled administration time change
- Medication discontinued
- Medication restarted
- Instructions changed

Instead:

```text
Old order → inactive / historical
New order → active
```

Historical administration events remain attached to the appropriate order version.

---

# 19. Audit Trail

Every clinically significant medication action should be auditable.

Track:

- User
- Action
- Original value
- New value
- Date
- Time
- Device/session where appropriate
- Reason for correction
- Related patient
- Related medication
- Related progress note

Examples of auditable events:

```text
Medication created
Medication edited
Medication discontinued
Schedule changed
Medication administered
Medication held
Medication marked refused
Medication corrected
Late entry created
Administration record amended
```

---

# 20. Corrections and Late Entries

Signed medication administration records should not simply be deleted or silently changed.

Instead, support:

```text
Correction / Amendment
```

The original value should remain available in the audit history.

Example:

```text
Original:
Given 8:03 AM

Corrected:
Given 8:30 AM

Reason:
Incorrect administration time entered

Corrected by:
Alex McGann, RN

Corrected:
08/27/26 10:42 AM
```

Late documentation should also be identifiable.

Example:

```text
Administered:
8:00 AM

Documented:
10:37 AM

Late Entry
```

---

# 21. PRN Medication Workflow

PRN medications should use a different workflow than routine scheduled medications.

A nurse may select:

```text
+ PRN Medication
```

Then choose from the patient's active PRN medication list.

Example:

```text
Acetaminophen
650 mg via G-Tube
Every 6 hours PRN

Reason / Indication:

○ Pain
○ Fever
○ Headache
○ Other

[ Administer ]
```

The system should automatically evaluate:

- Last administration
- Minimum interval
- Maximum daily dose
- PRN restrictions

---

# 22. PRN Effectiveness Reassessment

Some PRN medications should trigger a follow-up reassessment.

Example:

```text
Acetaminophen given at 2:15 PM
Reason: Pain
Pain score: 6/10

Reassessment Due:
3:15 PM
```

The system may then create a task:

```text
PRN EFFECTIVENESS

Pain reassessment

Current pain:
[ 0–10 ]

Response:
○ Effective
○ Partially effective
○ Ineffective

Notes:
[ Optional ]
```

The reassessment should link back to the original PRN administration event.

---

# 23. Medication Parameters

Some medications require administration parameters.

Example:

```text
Metoprolol 25 mg PO

Hold if:
SBP < 90
HR < 60
```

Future versions of the MAR may integrate recent patient vitals.

If:

```text
HR = 54
```

the medication card could display:

```text
⚠ HOLD PARAMETER MET

Current HR: 54
Order: Hold if HR < 60
```

The nurse should still confirm the clinical action rather than having the software autonomously make the medication decision.

---

# 24. Missed Medication Detection

If a scheduled dose remains unresolved beyond an expected administration window, the system should flag it.

Example:

```text
⚠ Medication Documentation Needed

Baclofen 10 mg
Scheduled: 2:00 PM
Current time: 3:20 PM
```

The nurse can then document:

```text
Given Late
Held
Refused
Missed
Medication Unavailable
Other
```

---

# 25. Shift Handoff Integration

If one nurse's shift ends and another begins, unresolved medication issues should be visible during handoff.

Example:

```text
SHIFT HANDOFF

⚠ Medication Follow-Up

Baclofen 10 mg
Scheduled 6:30 PM

Status:
Not yet documented
```

This reduces reliance on verbal-only handoff communication.

---

# 26. Authentication and Nurse Identity

Medication administration documentation should use the authenticated user's account.

The nurse should not manually type their initials each time.

User profile fields should include:

```text
First Name
Last Name
Credentials
Professional License
MAR Initials
User ID
```

Example:

```text
Alex McGann, RN
Initials: AM
```

When a medication is documented, the platform automatically applies the authenticated nurse's identity.

---

# 27. Permissions

Recommended role-based permissions:

## Administrator

May:

- Create medications
- Modify medication orders
- Discontinue medications
- Manage schedules
- View all MAR records
- Review audit logs
- Correct records when authorized

## Parent / Caregiver

Configurable permissions may allow:

- Add medication information
- Maintain medication schedules
- Upload medication orders
- View MAR
- View medication history

Clinical order changes may require additional confirmation depending on system policy.

## Lead Nurse

May potentially:

- Manage medication schedules
- Verify medication orders
- Correct order details
- View MAR
- Review administration exceptions

## Shift Nurse

May:

- View active medication orders
- Document medication administration
- Hold medication
- Document refusal
- Document early/late administration
- Administer PRN medication
- Complete PRN reassessment
- View relevant MAR history

Shift nurses should not automatically have permission to alter the prescription source of truth.

---

# 28. Mobile UX Requirements

The MAR should be designed mobile-first.

Requirements:

- Large touch targets
- Minimal typing
- Clear status indicators
- One-handed usability
- No horizontal scrolling for routine tasks
- Avoid spreadsheet layouts on phones
- Persistent save state
- Fast interaction
- Large medication names
- Clear dose and route
- Visible scheduled time
- Distinct unresolved vs completed states

Recommended minimum tap target:

```text
44 × 44 px
```

Prefer larger buttons for primary medication actions.

---

# 29. Suggested Mobile Medication Card

Unresolved:

```text
┌───────────────────────────────┐
│ 8:00 AM                       │
│                               │
│ BACLOFEN                      │
│ 10 mg • G-Tube                │
│                               │
│ Flush with 20 mL water        │
│                               │
│ [ ✓ GIVEN ]      [ HELD ]     │
└───────────────────────────────┘
```

Completed:

```text
┌───────────────────────────────┐
│ ✓ 8:00 AM                     │
│ BACLOFEN                      │
│ 10 mg • G-Tube                │
│                               │
│ Given 8:03 AM • AM            │
└───────────────────────────────┘
```

Exception:

```text
┌───────────────────────────────┐
│ ⚠ 8:00 AM                     │
│ BACLOFEN                      │
│ 10 mg • G-Tube                │
│                               │
│ HELD                          │
│ Clinical parameters not met   │
└───────────────────────────────┘
```

---

# 30. Connectivity and Save Behavior

Home care nurses may have inconsistent cellular or Wi-Fi connectivity.

The MAR should be resilient to temporary connection interruptions.

Recommended behavior:

1. Nurse taps medication action.
2. UI immediately shows a pending/saving state.
3. Event is stored locally if necessary.
4. Application attempts server synchronization.
5. UI confirms when server save completes.
6. Failed synchronization remains clearly visible.

Never display a medication as successfully documented if the server has not ultimately accepted the record.

Future development may include offline-first support.

---

# 31. Duplicate Administration Protection

The application should protect against accidental duplicate documentation.

Before creating an administration event, check whether the scheduled medication instance has already been resolved.

Example:

```text
This medication was already documented.

Baclofen 10 mg
Scheduled: 8:00 AM
Given: 8:03 AM
By: AM
```

The user may open the existing record instead of creating another administration event.

---

# 32. Concurrent Nurse Protection

If multiple caregivers or nurses have access to the patient chart simultaneously, the system should detect conflicting updates.

Example:

Nurse A administers and documents medication.

Nurse B has an older version of the page open.

When Nurse B taps `Given`, the system should return:

```text
This medication has already been documented by another user.

Refresh medication status.
```

---

# 33. Progress Note Integration

Medication documentation should be embedded within the nurse's shift progress note workflow.

The progress note should reference medication administration events instead of copying medication records as independent data.

Possible progress note section:

```text
MEDICATION ADMINISTRATION

✓ Baclofen 10 mg GT — 8:03 AM
✓ Keppra 500 mg GT — 10:01 AM
⚠ Senna 8.6 mg GT — Held
✓ Baclofen 10 mg GT — 2:00 PM
```

The nurse should be able to open any medication entry to see full MAR detail.

---

# 34. Medication Section Summary

At note completion, generate a concise structured summary.

Example:

```text
Scheduled Medications: 4
Administered: 3
Held: 1
Late: 0
Refused: 0
Missed: 0
```

This information should be generated automatically from administration events.

---

# 35. Master MAR Views

The Master MAR should support multiple viewing formats.

Recommended views:

```text
Day
Week
Month
Medication
Administration History
Exceptions Only
```

## Monthly MAR

Traditional-style presentation for printing/export.

## Daily Timeline

Mobile-friendly chronological list.

Example:

```text
08:03  Baclofen 10 mg GT      ✓ AM
10:01  Keppra 500 mg GT       ✓ AM
14:00  Baclofen 10 mg GT      ✓ AM
18:00  Senna 8.6 mg GT        H AM
```

## Exceptions View

Show only:

- Held
- Refused
- Missed
- Late
- Early
- Medication unavailable
- Corrections

---

# 36. MAR Export

Future versions should support exporting MAR records.

Potential formats:

```text
PDF
Print
Secure download
Fax workflow
Clinical record package
Prior authorization supporting documentation
```

Exports should display:

- Patient
- Medication
- Dose
- Route
- Ordered frequency
- Scheduled administration times
- Administration dates
- Nurse initials
- Initials legend
- Exceptions
- Held reasons
- Date range
- Medication order changes where relevant

---

# 37. Reporting and Quality Review

The MAR database can eventually support operational reports.

Examples:

```text
Missed medication rate
Held medication frequency
Late medication frequency
PRN utilization
Medication unavailable events
Documentation completion
Medication exceptions by patient
Medication exceptions by date
```

These should remain secondary to the clinical workflow and should not increase documentation burden.

---

# 38. Notifications and Reminders

Potential optional reminders:

```text
Medication due soon
Medication overdue
PRN reassessment due
Medication refill approaching
Prescription expired
Order renewal needed
Medication unavailable
Unresolved medication before shift end
```

Notification preferences should be configurable to avoid unnecessary alert fatigue.

---

# 39. Future Medication Refill Integration

The existing medication profile may later connect MAR utilization with medication refill tracking.

Potential logic:

```text
Medication supply
− administrations
= estimated remaining quantity
```

This could eventually provide:

```text
Estimated supply remaining: 5 days
```

The system should clearly distinguish estimated inventory from pharmacy-confirmed medication availability.

---

# 40. Security and Privacy

MAR data is part of the patient's health record.

The implementation should follow the platform's existing HIPAA security architecture.

Requirements should include:

- Encryption in transit
- Encryption at rest
- Role-based access
- Authentication
- Session security
- Audit logging
- Minimum necessary access
- Secure backups
- Record retention
- Controlled record correction
- No silent deletion of signed clinical records

---

# 41. Recommended Development Phases

## Phase 1 — Core MAR

Build:

- Medication profile
- Medication schedules
- Shift time selection
- Automatic medication population
- Given
- Held
- Held reason
- Nurse identity
- Administration timestamps
- Master MAR
- Audit records

## Phase 2 — Clinical Exceptions

Add:

- Early medication workflow
- Late medication workflow
- Refused
- Missed
- Medication unavailable
- Shift completion warnings
- Order versioning
- Corrections / amendments
- Late entries

## Phase 3 — PRN Workflow

Add:

- PRN medication list
- PRN indication
- Last-dose check
- Minimum interval
- Maximum daily dose
- Reassessment task
- Effectiveness documentation

## Phase 4 — Clinical Intelligence

Add:

- Medication parameters
- Vital-sign integration
- Hold parameter alerts
- Shift handoff alerts
- Medication conflict warnings
- Refill forecasting

## Phase 5 — Reporting / Export

Add:

- Printable monthly MAR
- PDF export
- Exception reports
- Administration history
- Prior authorization record packages
- Quality dashboards

---

# 42. Core Technical Rule

The application should never treat the visible MAR grid as the primary data structure.

The database should store individual medication administration events.

The UI should generate the MAR from those events.

Conceptually:

```text
Medication Order
      +
Medication Schedule
      +
Date / Shift
      ↓
Expected Dose Instance
      ↓
Administration Event
      ↓
Progress Note + Master MAR
```

This architecture provides flexibility for:

- Mobile layouts
- Monthly MARs
- Daily timelines
- PDF exports
- Clinical reports
- Medication history
- Corrections
- Auditing
- Future integrations

without duplicating clinical data.

---

# 43. Final System Model

The completed workflow should function as follows:

```text
1. Authorized user enters medication order.

2. Authorized user assigns scheduled administration times.

3. Nurse selects New Progress Note.

4. Nurse enters:
   - Date of service
   - Shift start
   - Shift end

5. System identifies medications scheduled during that shift.

6. Medication cards automatically populate.

7. Nurse documents each scheduled dose using:
   - Given
   - Held
   - Refused
   - Missed
   - Other approved exception

8. System automatically evaluates early/late timing.

9. Exception reasons are collected only when needed.

10. Every interaction creates a medication administration event.

11. Administration events are linked to:
    - Patient
    - Medication
    - Medication schedule
    - Nurse
    - Shift
    - Progress note

12. Progress note displays the shift medication summary.

13. Master MAR dynamically displays administration history.

14. Historical records retain the medication details that were active at the time of administration.

15. Corrections are appended through an auditable amendment process rather than deleting the original clinical record.
```

---

# 44. Design Principle Summary

The MAR should feel less like completing a traditional electronic form and more like resolving a simple shift checklist.

Routine medication documentation should generally require:

```text
Open Progress Note
        ↓
Medication appears automatically
        ↓
Tap GIVEN
        ↓
Done
```

Additional documentation should only appear when the medication event deviates from the expected routine.

This keeps the system fast enough for real-world home care nursing while still producing a structured, auditable, longitudinal Medication Administration Record.
