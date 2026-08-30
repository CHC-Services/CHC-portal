# Coming Homecare — Scheduling → Pending Hours Workflow Specification

## Purpose

Build the scheduling system so that a scheduled nursing shift becomes the **source of truth for expected work hours** and automatically creates the appropriate **Pending Hours** records in the assigned nurse's portal.

The nurse should not have to manually recreate hours that were already scheduled. After the shift is completed, the nurse should primarily confirm the scheduled hours or make corrections when the actual hours worked differed.

---

## 1. Core Data Relationship

A scheduled shift and its resulting hour records must remain linked.

Each shift should have a unique `shift_id`.

Any Pending Hours or Confirmed Hours records generated from that shift must reference the same `shift_id`.

Conceptually:

```text
Scheduled Shift
    ↓
shift_id
    ↓
Pending Hours
    ↓
Nurse Confirmation / Adjustment
    ↓
Confirmed Hours
    ↓
Billing / Work Log
```

Do **not** create disconnected copies of the schedule data.

This relationship should eventually allow other clinical records to reference the same shift, including:

- Progress notes
- MAR / medication administration
- Vitals
- Clinical documentation
- Billing records
- Patient daily care calendar

---

## 2. Creating a Scheduled Shift

When an authorized user schedules a nurse, capture at minimum:

```text
shift_id
patient_id
nurse_id
shift_start_datetime
shift_end_datetime
status
created_by
created_at
updated_at
```

Example:

```text
Patient: Patient A
Nurse: Nurse A
Start: Saturday 08/29/2026 7:00 PM
End: Sunday 08/30/2026 7:00 AM
Total Scheduled Hours: 12
```

The calendar should visually treat this as **one continuous overnight shift**, even though it crosses midnight.

---

## 3. Calendar Display

The portal currently supports:

- Month View
- Week View
- Day View

The scheduled shift should remain one logical shift across all views.

For an overnight shift, the UI can visually indicate that the shift continues into the following day.

Example:

```text
Nurse A
7:00 PM → 7:00 AM
12 hrs • Overnight
```

The database should **not** create two independent shifts simply because midnight occurs.

There should still be one `shift_id`.

---

## 4. Automatic Pending Hours Creation

When a shift is created or assigned to a nurse, automatically create Pending Hours records for that nurse.

The nurse should see these records in their personal portal without manually entering them.

Example scheduled shift:

```text
Saturday 7:00 PM → Sunday 7:00 AM
Total: 12 hours
```

The system should recognize the midnight boundary for date-of-service/billing purposes.

Expected pending hour allocation:

```text
Saturday: 5.00 hours
Sunday:   7.00 hours
Total:   12.00 hours
```

Both records remain linked to the same `shift_id`.

Suggested structure:

```text
pending_hour_id
shift_id
patient_id
nurse_id
date_of_service
scheduled_start
scheduled_end
scheduled_hours
actual_start
actual_end
actual_hours
status
created_at
updated_at
```

---

## 5. Overnight Shift Logic

### Important distinction

**Scheduling:** one continuous shift.

**Date-of-service accounting:** split hours at midnight when necessary.

For:

```text
08/29/2026 19:00
through
08/30/2026 07:00
```

The system calculates:

```text
08/29/2026 = 19:00 → 24:00 = 5 hours
08/30/2026 = 00:00 → 07:00 = 7 hours
```

This allows the calendar to remain intuitive while still calculating the correct number of hours attributable to each date of service.

---

## 6. Pending Hours Status

Scheduled hours should initially have a status such as:

```text
UPCOMING
```

or:

```text
PENDING
```

They are **not billable/confirmed hours merely because they appear on the schedule.**

The nurse's portal can display upcoming scheduled hours in advance, but they remain unconfirmed.

---

## 7. Future Shift Confirmation Lock — HARD RULE

A nurse must **never be able to confirm future scheduled hours as worked.**

The system must validate this on the **server/database layer**, not only by disabling a button in the frontend.

### Required rule

```text
current_datetime < shift_end_datetime
    → confirmation prohibited

current_datetime >= shift_end_datetime
    → confirmation may be permitted
```

Therefore:

```text
Shift:
September 3, 2026
7:00 AM → 7:00 PM

Current Date:
August 29, 2026

Result:
Pending hours visible
Confirm button disabled
```

The nurse may see that the shift is scheduled but cannot certify that the work occurred.

---

## 8. Overnight Confirmation Rule

For overnight shifts, confirmation eligibility should be based on the **end timestamp of the entire shift**, not simply whether one of the dates of service has begun.

Example:

```text
Saturday 7:00 PM → Sunday 7:00 AM
```

At:

```text
Sunday 1:00 AM
```

the Saturday portion has technically occurred, but the scheduled shift itself is still active.

Default behavior:

```text
Do not allow final confirmation until Sunday 7:00 AM.
```

This keeps the two date-of-service hour records synchronized with the single underlying shift.

---

## 9. Nurse Confirmation Workflow

Once:

```text
current_datetime >= shift_end_datetime
```

the nurse can review the scheduled hours.

Provide simple actions such as:

```text
✓ Confirm Scheduled Hours
✎ Adjust Actual Hours
○ Did Not Work
```

### Confirm Scheduled Hours

If the nurse worked exactly as scheduled:

```text
actual_start = scheduled_start
actual_end = scheduled_end
actual_hours = scheduled_hours
status = CONFIRMED
```

No manual re-entry should be necessary.

### Adjust Actual Hours

If the nurse arrived late, left early, stayed late, etc., allow the nurse to enter the actual times.

Example:

```text
Scheduled:
7:00 AM → 7:00 PM

Actual:
7:12 AM → 6:45 PM
```

The system recalculates the actual hours and any date-of-service split automatically.

### Did Not Work

The nurse can indicate that the scheduled shift was not worked.

Suggested status:

```text
NOT_WORKED
```

This should preserve the historical scheduled record rather than silently deleting it.

---

## 10. Nurse Reassignment

If a scheduled shift is reassigned before it is completed:

```text
Nurse A → Nurse B
```

the pending-hour records must automatically follow the schedule assignment.

Example:

```text
Original:
Nurse A
Saturday 7 PM → Sunday 7 AM
12 pending hours

Reassigned:
Nurse B
Saturday 7 PM → Sunday 7 AM
```

Expected behavior:

### Nurse A

The pending hours should no longer appear as hours Nurse A is expected to confirm.

The underlying record may be:

```text
REASSIGNED
```

rather than permanently deleted so the audit history remains intact.

### Nurse B

The system automatically generates or transfers the appropriate Pending Hours records into Nurse B's portal.

Nurse B should not need to manually create them.

---

## 11. Reassignment Audit Trail

Preserve:

```text
shift_id
previous_nurse_id
new_nurse_id
changed_by
changed_at
reason (optional)
```

Example:

```text
Shift #12345

Originally assigned:
Nurse A

Reassigned:
Nurse B

Changed:
08/29/2026 4:32 PM

Changed By:
Family Administrator
```

This prevents ambiguity about who was originally scheduled.

---

## 12. Safeguard: Existing Documentation or Confirmed Hours

Automatic reassignment should only occur safely when the outgoing nurse has **not already confirmed hours or created finalized clinical documentation tied to that shift.**

If Nurse A has already:

- Confirmed hours
- Signed a progress note
- Recorded medication administration
- Finalized clinical documentation

then changing the schedule must **not silently transfer those records to Nurse B.**

Instead:

```text
REASSIGNMENT REQUIRES REVIEW
```

The system should require an explicit correction workflow by an authorized user.

Clinical records authored by Nurse A must never simply become attributed to Nurse B because the calendar assignment changed.

---

## 13. Schedule Edits

If the shift time changes before completion:

```text
Original:
7:00 AM → 7:00 PM

Updated:
8:00 AM → 8:00 PM
```

the associated unconfirmed Pending Hours records should automatically recalculate.

Because everything references `shift_id`, the system should **update existing linked pending records rather than creating duplicates.**

---

## 14. Duplicate Prevention

Before creating Pending Hours records, verify whether records already exist for:

```text
shift_id
+
nurse_id
+
date_of_service
```

Do not generate duplicate pending lines when:

- A schedule is edited
- A page is refreshed
- An API call retries
- A shift is reassigned
- A background process runs more than once

The operation should be **idempotent**.

A database uniqueness constraint should be used where appropriate rather than relying solely on frontend logic.

---

## 15. Recommended Shift Statuses

Suggested shift lifecycle:

```text
SCHEDULED
↓
IN_PROGRESS
↓
AWAITING_CONFIRMATION
↓
CONFIRMED
```

Alternative branches:

```text
SCHEDULED → CANCELLED
SCHEDULED → REASSIGNED
AWAITING_CONFIRMATION → NOT_WORKED
AWAITING_CONFIRMATION → ADJUSTED → CONFIRMED
```

---

## 16. Billing / Work Log Relationship

Once hours are confirmed, they can feed the nurse's work log/billing workflow.

Conceptually:

```text
Schedule
   ↓
Pending Hours
   ↓
Shift Occurs
   ↓
Nurse Confirms / Adjusts
   ↓
Confirmed Hours
   ↓
Work Log
   ↓
Billing
```

The schedule itself should **never automatically create billable hours without nurse confirmation.**

This distinction is important:

```text
Scheduled = expected work
Confirmed = nurse attests work occurred
Billable = confirmed work eligible for billing
```

---

## 17. Recommended UI Behavior

### Upcoming shift

```text
SAT AUG 29 → SUN AUG 30

Patient A
7:00 PM – 7:00 AM
12.0 hrs • Overnight

UPCOMING
Confirmation available after 7:00 AM Sunday
```

### Completed shift awaiting confirmation

```text
SAT AUG 29 → SUN AUG 30

Patient A
7:00 PM – 7:00 AM
12.0 hrs

AWAITING CONFIRMATION

[ Confirm 12.0 Hours ]
[ Adjust Hours ]
[ Did Not Work ]
```

The goal should be **tap-to-confirm**, not duplicate data entry.

---

## 18. Server-Side Validation Requirements

The backend must independently enforce:

1. Future shifts cannot be confirmed.
2. Shift confirmation cannot occur before `shift_end_datetime`.
3. A nurse can only confirm hours assigned to them unless an authorized administrative correction process is used.
4. Confirmed hours cannot silently move between nurses.
5. Reassignment updates unconfirmed Pending Hours.
6. Schedule edits update linked unconfirmed Pending Hours.
7. Duplicate Pending Hours cannot be generated.
8. Total date-of-service hour segments must equal the duration of the parent shift.
9. Cancelled shifts cannot be confirmed.
10. Clinical records remain attributed to their actual author regardless of later schedule changes.

Frontend restrictions should improve usability, but **frontend validation must never be the only protection.**

---

## 19. Future Integration Architecture

Design the `shift_id` relationship now so the scheduling system can eventually serve as the central anchor for a patient's day-of-care record.

Future relationship:

```text
PATIENT
   │
   └── DATE OF CARE
          │
          └── SHIFT
                ├── Assigned Nurse
                ├── Scheduled Hours
                ├── Confirmed Hours
                ├── Progress Note
                ├── MAR Entries
                ├── PRN Medications
                ├── Vitals
                ├── Clinical Events
                └── Billing / Work Log
```

This supports the broader Coming Homecare goal of allowing a date on the patient's care calendar to open a cohesive view of the care delivered that day.

---

# Primary Design Principle

**Enter the information once and propagate it through the system.**

The family/administrator creates the schedule.

The system creates the expected Pending Hours.

The nurse completes the shift.

The nurse confirms or adjusts what actually occurred.

The confirmed data flows into the work log and billing workflow.

At no point should the nurse have to manually recreate a scheduled shift simply to report that the scheduled work occurred.
