# Coming Homecare — Canonical Data, Shared Patient Views & Configurable Role Permissions

## Purpose

Coming Homecare currently has multiple user experiences, including:

- Admin
- Provider
- Family / Caregiver

As the portal has evolved, similar information pages may now exist in multiple role-specific versions.

The goal of this refactor is to prevent the site from developing separate, independently maintained versions of the same patient, provider, insurance, claim, demographic, or account information.

The system should instead use:

> **One canonical source of truth for each data domain + shared reusable UI components + configurable role-based permissions.**

The objective is to make future changes once and have those changes propagate everywhere they are authorized to appear.

---

# Core Architectural Principle

Do **not** maintain separate versions of the same information page for Admin, Provider, and Family/Caregiver users.

Avoid architectures such as:

```text
AdminPatientPage.tsx
ProviderPatientPage.tsx
CaregiverPatientPage.tsx
```

where each page independently defines:

- fields
- labels
- layout
- validation
- data mapping
- visibility
- actions

This creates duplication and increases the chance that one version becomes outdated when another is changed.

Instead, use one shared patient-detail architecture.

---

# Desired Architecture

```text
Canonical Data Sources
│
├── Patient
├── Demographics
├── Provider
├── Insurance
├── Claims
├── Medications
├── Authorizations
├── Documents
└── User Account
       │
       ▼
Shared Service / Data Access Layer
       │
       ▼
Authorization / Permission Layer
       │
       ▼
Shared Reusable Page Components
       │
       ├── Admin
       ├── Provider
       └── Family / Caregiver
```

Each user type should load the same underlying data and shared UI architecture.

The difference between roles should be controlled through permissions, not through separate copies of the page.

---

# Example

If a new field is added:

```text
preferred_pharmacy
```

The intended workflow is:

1. Add the field to the canonical patient data model.
2. Add the field once to the shared patient information component.
3. Define which roles may:
   - view it
   - edit it
   - clear it
   - delete/archive the related record if applicable

The field should then appear automatically anywhere the shared component is used and the current user's permissions allow it.

The developer should **not** need to independently add the same field to:

```text
Admin patient page
Provider patient page
Caregiver patient page
```

---

# Shared Patient Detail Architecture

Conceptually:

```text
Patient Detail
│
├── Overview
├── Demographics
├── Contact Information
├── Care Team
├── Insurance
├── Medications
├── Prior Authorizations
├── Claims
├── Documents
├── Tasks / Reminders
└── Account / Access Information
```

The page structure should be reusable.

Role permissions determine:

- whether a section is visible
- whether a field is visible
- whether a field is read-only
- whether a field is editable
- whether a related record can be created
- whether a related record can be archived/deleted
- whether administrative actions are available

---

# Critical Security Rule

## Hidden in the UI is not the same as unauthorized.

Sensitive data must be protected at the server, API, service, or data-access layer.

For example:

If a Family/Caregiver is not authorized to access claim information, the server should not return claim information to that user's browser and simply hide it with CSS.

Authorization must determine what data may actually be retrieved.

---

# Configurable Authorization System

The Admin should have a settings area where authorized administrators can control what each role is allowed to do.

This should be configuration-driven rather than permanently hard-coded into components.

## Recommended Model

Use a permission model based on:

```text
ROLE
+
RESOURCE
+
ACTION
+
OPTIONAL FIELD / SCOPE
```

Example:

```text
Provider
+
Patient
+
Edit
+
preferred_pharmacy
```

---

# Permission Actions

At minimum, support these permission actions:

```text
VIEW
CREATE
EDIT
ARCHIVE
DELETE
```

Additional actions may eventually include:

```text
EXPORT
DOWNLOAD
UPLOAD
ASSIGN
APPROVE
SUBMIT
RESTORE
MANAGE_ACCESS
```

---

# Permission Levels

Permissions can exist at multiple levels.

## 1. Page / Resource Level

Example:

```text
Provider → Insurance → VIEW = true
Provider → Insurance → EDIT = false
Provider → Insurance → DELETE = false
```

This determines general access to an information category.

---

## 2. Field Level

Example:

```text
Provider → Patient → date_of_birth → VIEW = true
Provider → Patient → date_of_birth → EDIT = false

Provider → Patient → preferred_pharmacy → VIEW = true
Provider → Patient → preferred_pharmacy → EDIT = true
```

This provides precise control over individual information fields.

---

## 3. Record Action Level

Example:

```text
Provider → Patient → DELETE = false

Provider → InsuranceRecord → ARCHIVE = true
Provider → InsuranceRecord → DELETE = false
```

This allows a user to modify or retire related records without necessarily allowing them to delete the entire patient.

---

# Recommended Admin Permission Settings UI

Create a settings area such as:

```text
Admin
└── Settings
    └── Roles & Permissions
```

The page could display a permission matrix.

Example:

| Resource / Field | Admin | Provider | Family/Caregiver |
|---|---|---|---|
| Patient — View | Allow | Allow | Allow |
| Patient — Edit | Allow | Limited | Limited |
| Patient — Delete | Allow | Deny | Deny |
| Demographics — View | Allow | Allow | Allow |
| Demographics — Edit | Allow | Allow | Limited |
| Insurance — View | Allow | Allow | Allow |
| Insurance — Edit | Allow | Deny | Deny |
| Insurance — Archive | Allow | Deny | Deny |
| Claims — View | Allow | Allow | Deny |
| Claims — Edit | Allow | Deny | Deny |

For field-level controls, selecting a resource could expand into individual fields.

Example:

```text
Patient Demographics
│
├── Legal Name
│   ├── View:   Admin ✓ Provider ✓ Caregiver ✓
│   ├── Edit:   Admin ✓ Provider ✕ Caregiver ✕
│   └── Delete: N/A
│
├── Phone Number
│   ├── View:   Admin ✓ Provider ✓ Caregiver ✓
│   ├── Edit:   Admin ✓ Provider ✓ Caregiver ✓
│   └── Delete: N/A
│
└── Preferred Pharmacy
    ├── View:   Admin ✓ Provider ✓ Caregiver ✓
    ├── Edit:   Admin ✓ Provider ✓ Caregiver ✓
    └── Delete: N/A
```

---

# Permission Defaults

The system should have safe defaults.

Suggested initial posture:

## Admin

```text
VIEW       = Allow
CREATE     = Allow
EDIT       = Allow
ARCHIVE    = Allow
DELETE     = Restricted / Admin-only
```

## Provider

```text
VIEW       = Allow where clinically/operationally appropriate
CREATE     = Limited
EDIT       = Limited
ARCHIVE    = Deny unless specifically enabled
DELETE     = Deny
```

## Family / Caregiver

```text
VIEW       = Allow where appropriate
CREATE     = Limited
EDIT       = Limited
ARCHIVE    = Deny unless specifically enabled
DELETE     = Deny
```

These should be defaults, not permanent hard-coded rules.

An authorized Admin should be able to change them later.

---

# Future Example

Initially:

```text
Provider → Patient → DELETE = false
```

Later, if the organization grows:

```text
Provider → Patient → ARCHIVE = true
```

or, if explicitly desired:

```text
Provider → Patient → DELETE = true
```

The change should be made from the Admin permission settings rather than by modifying application code.

Similarly:

```text
Family/Caregiver → InsuranceRecord → EDIT = false
```

could later become:

```text
Family/Caregiver → InsuranceRecord → EDIT = true
```

without rebuilding the insurance page.

---

# Strong Recommendation: Archive / Soft Delete Before Hard Delete

For patient, insurance, claim, authorization, document, and other healthcare-related records, do not make permanent deletion the normal workflow.

Prefer:

```text
ACTIVE
ARCHIVED
INACTIVE
DELETED / SOFT-DELETED
```

rather than immediately removing database records.

Example:

An old insurance record may no longer be current, but historical information may still be needed.

Instead of:

```text
DELETE insurance_record
```

prefer:

```text
insurance_record.status = "ARCHIVED"
```

The record can then disappear from normal active views while remaining available to authorized users when historical information is needed.

Permanent hard deletion should be reserved for specific situations and higher-level permissions.

---

# Permission Precedence

Permissions should follow a predictable hierarchy.

Recommended order:

```text
Explicit User Override
        ↓
Role Permission
        ↓
Resource Permission
        ↓
Field Permission
        ↓
Safe Default
```

However, avoid user-by-user overrides unless genuinely needed.

Prefer managing permissions by role or permission group so the system remains maintainable as the user base grows.

---

# Recommended Roles vs Permission Groups

Do not assume that every future provider or caregiver will need identical access.

Eventually, consider supporting permission groups such as:

```text
Administrator
Billing Administrator
Clinical Administrator

RN Provider
LPN Provider
Read-Only Provider

Primary Family Caregiver
Family Viewer
Legal Guardian
Authorized Representative
```

These groups can inherit a baseline permission set.

Example:

```text
Provider Base Permissions
       │
       ├── RN Provider
       ├── LPN Provider
       └── Read-Only Provider
```

This prevents the application from requiring hard-coded logic such as:

```ts
if (user.role === "provider") { ... }
```

everywhere in the codebase.

Instead, components should ask:

```text
Can this user VIEW this resource?
Can this user EDIT this field?
Can this user ARCHIVE this record?
```

---

# Preferred Permission Check Pattern

Conceptually:

```ts
can(user, "view", "patient.demographics")
can(user, "edit", "patient.preferred_pharmacy")
can(user, "archive", "insurance")
can(user, "delete", "patient")
```

UI components should consume the result of the authorization system.

Example:

```tsx
<Field
  value={patient.preferredPharmacy}
  readOnly={!canEditPreferredPharmacy}
/>
```

The data-access layer must independently enforce the same permission.

The UI permission is for user experience.

The server permission is for security.

---

# Avoid Hard-Coded Role Logic

Avoid repeating code such as:

```ts
if (role === "admin") {
  // show edit button
}

if (role === "provider") {
  // different component
}

if (role === "caregiver") {
  // third component
}
```

Prefer:

```ts
const permissions = getPermissions(currentUser);
```

Then:

```ts
permissions.patient.demographics.view
permissions.patient.demographics.edit
permissions.patient.delete
permissions.insurance.archive
```

or an equivalent centralized authorization helper.

---

# Source-of-Truth Architecture

The overall architecture should become:

```text
DATABASE / PRISMA
        │
        ▼
Canonical Data Models
        │
        ▼
Repository / Service Layer
        │
        ▼
Authorization Engine
        │
        ▼
Shared UI Components
        │
        ▼
Role-Aware User Experience
```

The same patient data should not be duplicated merely because different roles access it.

---

# Canonical Data Domains

The following should each have a defined canonical source of truth:

```text
Patient Information
Demographics
Contact Information
Providers / Care Team
Insurance
Medications
Prior Authorizations
Claims
Documents
Tasks / Reminders
User Accounts
Relationships / Patient Access
```

Where possible, shared pages should reference these canonical entities instead of maintaining role-specific copies.

---

# Relationship-Based Access

Role permissions alone may eventually be insufficient.

A caregiver should not automatically gain access to every patient simply because their role is:

```text
caregiver
```

Access should also consider the relationship between the user and patient.

Conceptually:

```text
User
  │
  ├── Role / Permission Group
  │
  └── Patient Relationship
          │
          ├── Patient A
          └── Patient B
```

Authorization should therefore be able to answer both:

```text
Is this role allowed to view patient medications?
```

and:

```text
Is this specific user authorized to access THIS patient?
```

---

# Audit Logging

Any configurable system that permits users to edit, archive, or delete healthcare-related records should maintain an audit trail.

Track items such as:

```text
who performed the action
what record changed
what field changed
previous value
new value
date/time
action type
```

Example:

```text
2026-08-10 14:32
User: Provider #123
Patient: #456
Field: preferred_pharmacy
Old Value: Pharmacy A
New Value: Pharmacy B
Action: EDIT
```

Permission changes themselves should also be audited.

Example:

```text
Admin #001 changed:
Provider → InsuranceRecord → EDIT
from DENY
to ALLOW
```

---

# Permission Administration Safeguards

The Admin permission-management screen should include safeguards.

Recommended:

1. Only high-level authorized Admin users can change permission policies.
2. Permission changes should be logged.
3. Dangerous permissions should require an additional confirmation.
4. Hard-delete permissions should be clearly distinguished from archive permissions.
5. The system should prevent an Admin from accidentally removing the final account capable of managing permissions.
6. Permission changes should take effect through the centralized authorization system without code changes.

---

# Shared UI Goal

The ideal architecture is:

```text
Change the database/data definition once.
              +
Change the shared UI component once.
              +
Configure who can view/edit/archive/delete it.
              =
Consistent behavior across the entire portal.
```

---

# Claude Refactor Request

Before making code changes:

## Step 1 — Audit Existing Implementations

Inspect the repository and identify:

- Admin patient detail pages
- Provider patient detail pages
- Family/Caregiver patient detail pages
- duplicated components
- duplicated field definitions
- duplicated data-fetching logic
- duplicated validation
- duplicated role checks
- existing Prisma models
- existing authentication / authorization logic

Do not assume the current architecture.

Report what currently exists.

---

## Step 2 — Identify Canonical Data Sources

Determine which existing models/services should become the source of truth for:

- patients
- demographics
- providers
- insurance
- claims
- medications
- prior authorizations
- documents
- reminders/tasks
- accounts
- patient/user relationships

---

## Step 3 — Propose Shared Component Architecture

Identify which pages/components can be consolidated into reusable shared components.

Do not remove role-specific experiences where they are genuinely needed.

The goal is to remove **duplicate definitions of the same information**, not force every role into an identical interface.

---

## Step 4 — Propose Permission Architecture

Design a configurable authorization layer supporting:

```text
VIEW
CREATE
EDIT
ARCHIVE
DELETE
```

at appropriate:

- resource
- section
- field
- record-action

levels.

Permissions must be enforced server-side as well as reflected in the UI.

---

## Step 5 — Propose Admin Permission UI

Create a plan for:

```text
Admin
→ Settings
→ Roles & Permissions
```

where authorized administrators can change future role permissions without editing application code.

---

## Step 6 — Migration Plan

Provide a phased refactor plan that:

- preserves current functionality
- avoids breaking existing routes
- consolidates duplicated data access
- consolidates duplicated UI
- introduces centralized permissions
- allows testing one information domain at a time

Do not perform a large destructive rewrite without first presenting the migration plan.

---

# Final Design Intent

Coming Homecare should have:

> **One source of truth for each piece of information, one reusable implementation of shared information views, and one centralized authorization system that determines what each user may see or do.**

Admin, Provider, and Family/Caregiver should not have independently maintained copies of the same patient information.

Their experiences may differ, but those differences should come from:

- permissions
- visibility
- relationship to the patient
- editability
- available actions
- workflow context

rather than duplicated pages and duplicated data definitions.

The permission system should be designed so that today's restrictive permissions can be safely expanded later as the organization grows, without requiring a redesign of the application.
