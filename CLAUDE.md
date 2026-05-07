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

**Migrations** — applied manually:
1. `execute_sql` via Supabase MCP (project: `rfhewykretdmldfwpnbw`, region: us-east-1)
2. `npx prisma migrate resolve --applied <migration_name>`
3. `npx prisma generate`

## Design System
- Navy: `#2F3E4E`, Sage: `#7A8F79`, Blue-grey bg: `#D9E1E8`, Off-white: `#F4F6F5`
- Brand name: **myProvider** (not myPortal) — italic sage "my" prefix on all portal labels
- Inputs: `border border-[#D9E1E8] p-2 rounded-lg focus:ring-2 focus:ring-[#7A8F79]`
- Primary button: `bg-[#2F3E4E] text-white rounded-xl hover:bg-[#7A8F79]`

## Layout Architecture
- **NurseSideNav** (`app/components/NurseSideNav.tsx`) — fixed floating panel, `lg:` only, mounted in root layout with `user?.role === 'nurse'` check. Links: myDashboard, myPatients, myHours, myClaims, myInvoices, myDocuments, myProfile, myCare.
- Root layout adds `lg:pl-[calc(10vw+1.5rem)]` to page-wrap when role === nurse.
- Nurse layout (`app/nurse/layout.tsx`) is a pass-through — just `<>{children}</>`.
- Login redirects: nurse → `/nurse`, admin → `/admin`. `/portal` redirects all authenticated users.
- All nurse banner links are `md:hidden` (they live in the side nav on desktop).

## Patient Module (completed 2026-05-07)

### Architecture
Canonical `Patient` record + per-nurse `NursePatient` JSON override layer.
Read merge: `{ ...canonical, ...(overrides || {}) }`. Nurses write only to overrides; canonical unchanged unless admin edits.

### Patient Schema Fields
Demographics: `lastName`, `firstName`, `dob`, `gender`, `phone`, `address`, `city`, `state`, `zip`
Insurance: `insuranceType` (Medicaid/Commercial), `insuranceId`, `insuranceName`, `insuranceGroup`, `insurancePlan`
Clinical: `highTech` (bool), `dxCode1-4`, `paNumber`, `paStartDate`, `paEndDate`
Commercial-only: `subscriberName`, `subscriberRelation`, `networkStatus` (IN/OON), `hasCaseRate` (bool), `caseRateAmount`, `policyNotes`
Account number: `PT-001` format, sequential on creation.
`TimeEntry.patientId` — optional FK linking hours to a patient for billing.

### APIs
| Route | Methods | Notes |
|---|---|---|
| `/api/nurse/patients` | GET, POST | List merged patients; create new or link existing |
| `/api/nurse/patients/search` | POST | Search by lastName + dob + insuranceId |
| `/api/nurse/patients/[id]` | PATCH, DELETE | Patch overrides; soft unlink |
| `/api/admin/patients` | GET | All patients with nurseLinks + _count.timeEntries |
| `/api/admin/patients/[id]` | GET, PATCH | Single patient detail + canonical edit |
| `/api/admin/patients/[id]/assign` | POST, DELETE | Link/unlink a nurse to a patient |
| `/api/time-entry` | GET, POST | GET includes patient info; POST accepts patientId |

### Pages
- `app/nurse/patients/page.tsx` — myPatients: search bar + Add Patient button; modal: search → found (link existing) / not found → new patient form. Form branches Medicaid vs Commercial for required fields. All clinical fields always shown.
- `app/admin/patients/page.tsx` — adPatients: searchable table; slide-over panel with full canonical edit + nurse assign/unlink.
- `app/nurse/hours/page.tsx` — patient dropdown in Submit Hours (nurse sees `J. Smith` format); Patient column in history table.

### Nurse hours patient label
Dropdown: `${firstName[0]}. ${lastName.slice(0,5)}` — admin sees account number (PT-001).

## What's Not Built Yet
- Individual patient detail/edit view for nurses (currently card-only, no drill-down)
- Voice dictation feature linked to patients (architecture agreed, not started)
- Parent account level for patient assignment (future role)
- myHours: admin view of patient column shows account number (UI not yet updated on admin side)
