# Coming Homecare — Public Homepage & Portal Entry Architecture

## Purpose

Coming Homecare is expanding to support both:

1. **Families & Caregivers**
2. **Nurses & Healthcare Providers**

The public-facing homepage must be structured so that neither audience feels they have landed on the wrong website.

A provider should not interpret the site as being primarily a parent/family website, and a parent or caregiver should not interpret the site as being primarily a medical provider portal.

The homepage should position **Coming Homecare as the umbrella platform**, with two clearly defined experiences underneath it.

---

# Core Positioning

The homepage should be presented as a **neutral care coordination gateway** rather than as a provider portal with family features added onto it.

The first screen should immediately communicate that Coming Homecare serves both:

- Families and caregivers managing care at home
- Nurses and healthcare providers managing professional and administrative workflows

Neither audience should visually or structurally appear secondary.

---

# Recommended Hero Section

## Main Brand

**Coming Homecare**

## Suggested Headline

**Helping families and care teams stay organized, informed, and connected.**

## Suggested Supporting Copy

Tools for caregivers, families, nurses, and healthcare providers to manage the details of home care without adding more work to an already full day.

---

# Primary Audience Gateway

Directly below the hero, display two equally weighted portal cards.

Neither card should appear more prominent than the other.

## Card 1 — Families & Caregivers

Suggested content:

- Medication reminders
- Prior authorization renewal reminders
- Appointment and document tracking
- Care coordination tools
- Important recurring care reminders

Primary CTA:

**Enter Family Portal →**

---

## Card 2 — Nurses & Providers

Suggested content:

- Time and task management
- Billing and claim tools
- Patient-care organization
- Administrative resources
- Professional workflow tracking

Primary CTA:

**Enter Provider Portal →**

---

# Public Terminology

Avoid using **“Parent Portal”** as the primary public-facing label.

Use:

## **Families & Caregivers**

This terminology is intentionally broader and can include:

- Parents of medically complex children
- Adult children caring for parents
- Spouses
- Legal guardians
- Authorized family members
- Non-family caregivers
- Other individuals involved in home care

Inside authenticated user accounts, terminology can become more specific based on the user's relationship to the patient.

---

# Shared Homepage Section

After the two audience entry cards, bring both audiences back together under the shared Coming Homecare mission.

## Suggested Section Heading

**Home care has a lot of moving pieces.**

## Suggested Supporting Message

Coming Homecare helps keep them together.

Use a simple 4-part feature section.

---

## Remember

Help users stay ahead of:

- Medications
- Appointments
- Renewals
- Recurring care tasks
- Important deadlines

---

## Organize

Help users manage:

- Documents
- Schedules
- Authorizations
- Important care information
- Administrative records

---

## Coordinate

Help the people involved in care work from the same organized information.

This may include:

- Families
- Caregivers
- Nurses
- Providers
- Other authorized members of the care team

---

## Simplify

Automate repetitive administrative tasks wherever possible.

The goal is to reduce the amount of mental and administrative work required to manage home care.

---

# Audience-Specific Homepage Sections

Lower on the homepage, create separate sections for each audience.

These sections provide more detail without making the entire homepage belong to one user group.

---

## Supporting Families

Use a softer, more human presentation.

Possible topics:

- Medication reminders
- Prior authorization renewal reminders
- Upcoming care tasks
- Appointments
- Important document tracking
- Family care coordination
- Recurring reminders
- Managing complex care responsibilities

This section should communicate:

- Reassurance
- Organization
- Reduced mental load
- Staying ahead of important care needs

---

## Supporting Care Professionals

Use a more operational and workflow-oriented presentation.

Possible topics:

- Billing
- Claims
- Documentation
- Time tracking
- Patient-related task organization
- Administrative workflow
- Professional reminders
- Care coordination tools

This section should communicate:

- Efficiency
- Organization
- Administrative simplification
- Reduced repetitive work
- Better workflow visibility

---

# Navigation Structure

Recommended public navigation:

- **Home**
- **Families**
- **Care Professionals**
- **Resources**
- **About**
- **Sign In**

The navigation should avoid defaulting users directly into one portal type.

---

# Sign-In Experience

When a user clicks **Sign In**, do not immediately present a generic username/password form.

First display an audience selection screen.

## Suggested Heading

**Which portal would you like to access?**

Provide two options:

### Family & Caregiver Portal

Routes the user into the family-facing authentication flow.

### Nurse & Provider Portal

Routes the user into the provider-facing authentication flow.

---

# Recommended URL Structure

Initial recommended structure:

```text
cominghomecare.com/family
cominghomecare.com/provider
```

This path-based architecture is preferred initially because it:

- Keeps both experiences under the main Coming Homecare domain
- Reinforces that both are part of one platform
- Is easier to maintain than separate subdomains
- Allows shared layouts, authentication logic, and components
- Provides room for audience-specific page structures

A future alternative could use:

```text
family.cominghomecare.com
provider.cominghomecare.com
```

However, separate subdomains are not necessary unless infrastructure, branding, authentication, or application architecture eventually requires greater separation.

---

# Visual Differentiation Strategy

Both portal experiences should remain unmistakably part of the **Coming Homecare brand**.

Maintain shared:

- Logo
- Core typography
- Deep navy
- Muted sage
- White / neutral surfaces
- Shared layout language
- Shared component system

Use subtle differences to help users immediately recognize which side they are on.

---

## Family / Caregiver Experience

Suggested visual emphasis:

- Softer sage usage
- Warm home-care photography
- Family and caregiver imagery
- More supportive whitespace
- Softer visual transitions

Suggested language:

- Remember
- Support
- Stay ahead
- Organize
- Coordinate
- Keep track
- Simplify

---

## Provider Experience

Suggested visual emphasis:

- Stronger deep navy usage
- Clinical/professional photography
- Nurse and provider imagery
- More structured workflow UI
- Clear dashboards and data hierarchy

Suggested language:

- Manage
- Document
- Submit
- Track
- Coordinate
- Review
- Organize

---

# Suggested Homepage Hierarchy

```text
COMING HOMECARE

Helping families and care teams stay organized,
informed, and connected.

┌────────────────────────────┐   ┌────────────────────────────┐
│ Families & Caregivers      │   │ Nurses & Providers         │
│                            │   │                            │
│ Medication reminders       │   │ Billing & claims           │
│ PA renewal reminders       │   │ Time tracking              │
│ Appointments               │   │ Documentation              │
│ Care organization          │   │ Administrative tools       │
│                            │   │                            │
│ Enter Family Portal →      │   │ Enter Provider Portal →    │
└────────────────────────────┘   └────────────────────────────┘


Home care has a lot of moving pieces.
Coming Homecare helps keep them together.


REMEMBER        ORGANIZE        COORDINATE        SIMPLIFY


Supporting Families
[Family-oriented feature preview]


Supporting Care Professionals
[Provider-oriented feature preview]


ABOUT COMING HOMECARE

Built from the perspective of a nurse, caregiver,
and someone who understands how much administrative
work happens outside the actual moments of care.
```

---

# Information Architecture Principle

Coming Homecare should be treated as the **parent platform**.

The homepage should not be designed as:

```text
Provider Portal
    └── Family features
```

or:

```text
Family Portal
    └── Provider features
```

Instead, the architecture should be:

```text
Coming Homecare
│
├── Families & Caregivers
│   ├── Public family information
│   ├── Family login
│   └── Family dashboard / tools
│
├── Nurses & Providers
│   ├── Public provider information
│   ├── Provider login
│   └── Provider dashboard / tools
│
├── Shared Resources
│
├── About
│
└── Shared Platform Services
```

---

# Future Scalability

The public homepage architecture should allow additional audiences to be introduced later without redesigning the entire site.

A possible future expansion could be:

```text
Coming Homecare
│
├── Families & Caregivers
├── Nurses & Providers
├── Agencies & Organizations
└── Shared Resources
```

For that reason:

- Avoid hard-coding the homepage around exactly two permanent user roles
- Build audience cards as reusable components
- Store audience configuration in a maintainable data structure
- Keep shared homepage sections independent from audience-specific content
- Keep authentication routing modular
- Avoid duplicating shared brand components across separate portal codebases

---

# Recommended Component Structure

Potential component organization:

```text
/components
  /public-home
    Hero.tsx
    AudienceGateway.tsx
    AudienceCard.tsx
    SharedBenefits.tsx
    FamilyOverview.tsx
    ProviderOverview.tsx
    AboutPreview.tsx
    PublicCTA.tsx

  /navigation
    PublicHeader.tsx
    PublicFooter.tsx
    SignInSelector.tsx
```

Audience card data could eventually be configuration-driven rather than hard-coded.

Example concept:

```ts
const portalAudiences = [
  {
    id: "family",
    title: "Families & Caregivers",
    description: "...",
    href: "/family",
    features: [...]
  },
  {
    id: "provider",
    title: "Nurses & Providers",
    description: "...",
    href: "/provider",
    features: [...]
  }
];
```

This makes it easier to add future portal types without rebuilding the homepage architecture.

---

# UX Rules

1. The homepage must identify both audiences above the fold.
2. Neither audience should appear secondary.
3. Do not require users to understand internal Coming Homecare terminology before choosing a portal.
4. Use clear human-readable labels instead of technical account-role names.
5. A user should be able to reach the correct portal within one obvious click.
6. Shared platform messaging should appear before detailed audience-specific marketing.
7. Family and provider experiences should feel related but visually distinguishable.
8. Avoid duplicating the entire public site for each audience.
9. Keep shared branding and public resources centralized.
10. Design the architecture so additional portal types can be added later.

---

# Primary Design Goal

The visitor should understand within a few seconds:

> **Coming Homecare is one platform designed to support both the people receiving/managing care at home and the professionals helping provide that care.**

The homepage should function as the common front door, while each portal becomes a clearly defined path once the user identifies which experience they need.
