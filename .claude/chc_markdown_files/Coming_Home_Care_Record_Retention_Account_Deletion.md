# Coming Home Care — Record Retention & Account Deletion Specification

## Purpose

This document defines the standard record-retention model and account-deletion workflow for Coming Home Care.

The goal is to keep the policy simple, consistent, and difficult to misapply by avoiding different retention periods based on document category.

---

# 1. Standard Retention Policy

## Active Accounts

For any account that remains active:

- All account records, files, documents, billing records, claims-related records, uploaded files, generated reports, audit history, and other retained account data will remain stored for the lifetime of the active account.
- Records should not be automatically purged based only on age while the account remains active.
- Legal holds, audits, investigations, disputes, or other compliance requirements may require records to remain retained regardless of account status.

**Retention Rule:**

> Active Account = Retain indefinitely while active.

---

## Inactive / Archived Accounts

When an account becomes inactive, suspended for closure, archived, or otherwise no longer actively used:

- The system will retain account data for a minimum of **10 years**.
- The 10-year retention period is measured from the account's final inactive/archive date unless a later legal, contractual, billing, audit, or compliance event requires a longer retention period.
- A legal hold or compliance hold must override automated destruction.

**Retention Rule:**

> Inactive / Archived Account = Retain for a minimum of 10 years.

---

## Accounts Older Than 10 Years at Time of Closure

If an account has existed for longer than 10 years when it becomes inactive:

- Records older than the applicable 10-year retention window may become eligible for destruction.
- Records that fall within the most recent 10-year retention window must remain archived.
- Records subject to a legal hold, audit, investigation, contractual requirement, litigation hold, or other mandatory retention requirement must not be destroyed regardless of age.

### Example

Account created:

`01/01/2012`

Account made inactive:

`01/01/2027`

At closure:

- Records dated before `01/01/2017` may be eligible for secure destruction.
- Records dated `01/01/2017` through `01/01/2027` remain retained.
- Any record under legal/compliance hold remains retained regardless of date.

---

# 2. Retention Priority

Retention decisions should follow this priority:

1. **Legal / Compliance Hold**
2. **Mandatory Legal or Contractual Retention Requirement**
3. **Active Account Lifetime Retention**
4. **10-Year Inactive / Archived Account Retention**
5. **Secure Destruction Eligibility**

No user-requested account deletion should override a legal or compliance retention requirement.

---

# 3. Recommended Account Statuses

Use explicit account states rather than immediately deleting records.

```text
ACTIVE
INACTIVE
DELETION_REQUESTED
SUSPENDED_PENDING_DELETION
ARCHIVED_RETENTION
PURGE_ELIGIBLE
PURGED
LEGAL_HOLD
```

### Suggested Meaning

- `ACTIVE` — Normal active account.
- `INACTIVE` — Account is no longer being actively used.
- `DELETION_REQUESTED` — User has initiated the deletion workflow.
- `SUSPENDED_PENDING_DELETION` — Login access is disabled and account closure has been submitted.
- `ARCHIVED_RETENTION` — Required records remain stored but are no longer part of the active account experience.
- `PURGE_ELIGIBLE` — Applicable retention period has expired and no hold prevents destruction.
- `PURGED` — Eligible records have been securely destroyed.
- `LEGAL_HOLD` — Automated deletion and destruction are suspended.

---

# 4. Delete Profile Workflow

Clicking **Delete Profile** must not immediately erase account records.

Instead, it launches the following three-step workflow.

---

## Step 1 — Export Account Data

### Screen Title

**Before You Delete Your Account**

### Prompt

Ask:

> Would you like to export a copy of your files and account data before continuing?

### Options

- **Yes — Export My Data**
- **No — Continue Without Exporting**

### Required Notice

Display a notice similar to:

> Once your account closure is finalized, non-essential account data that is not required for legal, billing, security, contractual, or compliance purposes may be permanently destroyed. Records that Coming Home Care is required to retain will remain securely archived for the applicable retention period and will no longer be available through your active account.

### If User Selects Yes

Generate or queue an export containing all user-accessible data that the user is permitted to receive.

Where applicable, include:

- Uploaded documents
- Licenses and certificates
- Invoices and receipts
- Tax forms and reports
- Explanations of Benefit
- Billing records
- User-generated reports
- Account profile data
- Other downloadable records associated with the user's account

The export process should not include internal-only security information, system secrets, restricted audit data, or records the user is not authorized to receive.

The user must still continue through Steps 2 and 3 to complete account deletion.

---

# 5. Step 2 — Important Document Confirmation

### Screen Title

**Confirm Your Important Records**

Before allowing account closure submission, display the following acknowledgment:

> Please confirm that you have saved or exported copies of the important records you may need after your account is closed.

Require the user to individually check each applicable item:

- [ ] **Licenses & Certificates**
- [ ] **Invoices & Receipts**
- [ ] **Tax Forms & Reports**
- [ ] **Explanations of Benefit**

### Confirmation Requirement

The **Submit Account Deletion** button must remain disabled until all required acknowledgment boxes are checked.

### Button

**Submit Account Deletion**

When submitted:

1. Record the user's acknowledgment timestamp.
2. Record the authenticated user ID.
3. Record the deletion request timestamp.
4. Store an audit event showing that the deletion workflow was completed.
5. Immediately terminate active sessions.
6. Disable normal account login.
7. Change account status to:

```text
SUSPENDED_PENDING_DELETION
```

8. Begin the archival and retention workflow.

---

# 6. Step 3 — Confirmation Page

### Screen Title

**Account Closure Requested**

### Confirmation Message

> Your profile has been successfully suspended and queued for deletion. You can no longer access the account through the normal login process. Records that must be retained for legal, billing, contractual, security, or compliance purposes will remain securely archived according to Coming Home Care's retention policy. Other eligible account data will be securely removed as part of the account closure process.

### Optional Display

Show:

- Date deletion was requested
- Account status: `Suspended / Pending Deletion`
- Export status, if the user requested an export
- Support/contact option for questions regarding the closure

Do not expose retained archived records through the normal user interface after closure.

---

# 7. Backend Closure Process

After the user completes Step 2, the system should perform the following actions.

## Immediate Actions

- Revoke all sessions and authentication tokens.
- Disable login.
- Disable SMS, email, push, and other routine notifications.
- Remove account from active user lists.
- Remove the account from normal provider/patient/family workflows.
- Disable API access associated with the user.
- Prevent additional uploads, edits, or billing submissions.

## Data Classification

Separate data into two logical groups.

### A. Retained Archive

Examples:

- Claims and billing records
- Explanations of Benefit
- Invoices and payment records
- Tax documents
- Licenses and certificates where retention is appropriate
- Signed agreements
- Authorizations
- PHI associated with retained healthcare or billing records
- Audit history
- Security events required for compliance
- Records subject to legal or compliance hold

### B. Deletion-Eligible Data

Examples may include:

- User interface preferences
- Saved themes
- Non-essential notification preferences
- Temporary files
- Cached data
- Non-essential drafts
- Optional personalization data
- Other records not required for legal, security, billing, contractual, operational, or compliance purposes

Deletion eligibility must always be determined by server-side retention rules, never solely by the user's selection.

---

# 8. Archive Security Requirements

Archived records must remain protected with the same security expectations as active PHI.

At minimum:

- Encryption at rest
- Encryption in transit
- Restricted role-based access
- Audit logging
- No standard user access
- No public URLs
- No unauthenticated download links
- No use for marketing or unrelated purposes
- Access limited to authorized administrative, compliance, billing, legal, or security functions

Archived records should preferably be separated logically from normal production-facing account data.

---

# 9. Suggested Retention Metadata

Each retained record should contain or reference retention metadata.

```text
record_id
account_id
patient_id
provider_id
record_type
created_at
service_date
billing_date
payment_date
account_inactive_date
retention_start_date
retention_until
archive_status
legal_hold
legal_hold_reason
purge_eligible_at
purged_at
```

Not every field will apply to every record.

---

# 10. Retention Calculation

Default rule for inactive accounts:

```text
retention_until = account_inactive_date + 10 years
```

For accounts older than 10 years at closure, records outside the 10-year window may be evaluated for destruction.

However:

```text
IF legal_hold = true
    DO NOT PURGE

IF another legal or contractual retention rule requires a later date
    USE THE LATER DATE
```

---

# 11. Automated Purge Process

A scheduled retention job should periodically identify records eligible for destruction.

A record may only be purged when:

```text
account_status != ACTIVE

AND record_age exceeds applicable retention requirement

AND legal_hold = false

AND no contractual hold exists

AND no pending audit exists

AND no billing/payment dispute exists

AND no investigation or litigation hold exists
```

Before destruction, the system should create an audit event recording:

- Record or batch identifier
- Reason for destruction
- Applicable retention rule
- Destruction date
- System/process performing destruction

The audit entry should avoid retaining the actual PHI that was intentionally destroyed.

---

# 12. No Cascading Hard Delete From Delete Profile

The **Delete Profile** button must never directly trigger cascading deletion of:

- Patient records
- Claims
- Billing history
- EOBs
- Financial records
- Documents
- PHI
- Audit history
- Signed agreements
- Compliance records

Account deletion should instead trigger:

```text
User requests deletion
        ↓
Export option
        ↓
Document acknowledgment
        ↓
Account suspended
        ↓
Active access removed
        ↓
Records evaluated
        ↓
Required records archived
        ↓
Non-essential eligible data destroyed
        ↓
10-year retention clock continues
        ↓
Retention expires
        ↓
Final eligibility check
        ↓
Secure purge
```

---

# 13. Administrative Controls

Authorized administrators should be able to view:

- Account status
- Date account became inactive
- Date deletion was requested
- Retention expiration date
- Archive status
- Legal hold status
- Export request status
- Purge eligibility
- Purge completion date

Administrators should not have a routine **Delete Everything Now** function for retained healthcare records.

Any exceptional manual destruction function should require elevated authorization and create a permanent audit event.

---

# 14. Core Business Rule

The system should follow this simple default:

> **If the account is active, retain its records for the lifetime of the account. If the account becomes inactive, retain the applicable records for at least 10 years. User-requested deletion removes access to the account but does not override mandatory record-retention requirements.**

This standard is intended to reduce errors caused by assigning shorter retention periods to incorrectly categorized records.

---

# 15. Implementation Note

This specification defines Coming Home Care's internal retention standard and intended application behavior. It should be reviewed against applicable HIPAA requirements, New York State law, Medicaid requirements, payer agreements, Business Associate Agreements, tax-record requirements, litigation holds, and other contractual obligations before production deployment.

Where another applicable requirement mandates retention beyond this policy, **the longer retention requirement controls**.
