import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { flattenMedication } from '../../../../../lib/pharmacyLookup'
import { calculateAge } from '../../../../../lib/patientAge'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const patient = await (prisma.patient.findUnique as any)({
    where: { id },
    include: {
      nurseLinks: {
        include: {
          nurse: { select: { id: true, userId: true, displayName: true, firstName: true, lastName: true, accountNumber: true } },
        },
      },
      guardianLinks: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      priorAuths: { orderBy: [{ paStartDate: 'desc' }, { createdAt: 'desc' }] },
      medications: { orderBy: { createdAt: 'desc' }, include: { pharmacy: true, scheduleTimes: { orderBy: { sortOrder: 'asc' } } } },
      timeEntries: {
        orderBy: { workDate: 'desc' },
        take: 50,
        include: {
          nurse: { select: { displayName: true, firstName: true, lastName: true, accountNumber: true } },
        },
      },
    },
  })

  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ patient: { ...patient, medications: (patient.medications || []).map(flattenMedication) } })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const updates = await req.json()
  const allowed = [
    'lastName', 'firstName', 'dob', 'gender',
    'insuranceType', 'insuranceId', 'insuranceName', 'insuranceGroup', 'insurancePlan',
    'address', 'city', 'state', 'zip', 'phone',
    'isMinor', 'guardianFirstName', 'guardianLastName', 'guardianEmail', 'guardianPhone', 'guardianRelationship',
    'linkedSpecialties',
    'highTech', 'dxCode1', 'dxCode2', 'dxCode3', 'dxCode4',
    'paNumber', 'paStartDate', 'paEndDate',
    'subscriberName', 'subscriberRelation',
    'networkStatus', 'hasCaseRate', 'caseRateAmount', 'policyNotes',
    'ins2Type', 'ins2Id', 'ins2Name', 'ins2Group', 'ins2Plan',
    'ins2SubscriberName', 'ins2SubscriberRelation',
    'ins2NetworkStatus', 'ins2HasCaseRate', 'ins2CaseRateAmount', 'ins2PolicyNotes',
    'documentRemindersEnabled', 'paRemindersEnabled',
    'partialShiftClaimsRequireApproval',
  ]
  const data: Record<string, any> = {}
  for (const key of allowed) {
    if (key in updates) data[key] = updates[key]
  }
  data.updatedAt = new Date()

  const current = await (prisma.patient.findUnique as any)({
    where: { id },
    select: { dob: true, isMinor: true, phone: true, guardianFirstName: true, guardianLastName: true, guardianPhone: true, guardianRelationship: true },
  })
  const merged = { ...current, ...data }
  // Under-18 by DOB is always treated as a minor, regardless of what the isMinor flag says —
  // a guardian card is mandatory for them, not an optional toggle like it is for adults.
  const age = merged.dob ? calculateAge(merged.dob) : null
  if (age !== null && age < 18) {
    merged.isMinor = true
    data.isMinor = true
  }
  if (!merged.isMinor && !merged.phone) {
    return NextResponse.json({ error: 'Phone number is required for adult patients.' }, { status: 400 })
  }
  if (merged.isMinor && (!merged.guardianFirstName || !merged.guardianLastName || !merged.guardianPhone || !merged.guardianRelationship)) {
    return NextResponse.json({ error: 'Guardian first name, last name, phone, and relationship are required for minor patients.' }, { status: 400 })
  }

  const patient = await (prisma.patient.update as any)({ where: { id }, data })

  return NextResponse.json({ ok: true, patient })
}
