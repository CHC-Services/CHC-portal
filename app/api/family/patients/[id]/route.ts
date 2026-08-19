import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { calculateAge } from '../../../../../lib/patientAge'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'guardian') return null
  return session
}

async function verifyLinked(userId: string, patientId: string) {
  const link = await (prisma.guardianPatient.findUnique as any)({
    where: { userId_patientId: { userId, patientId } },
  })
  return !!link
}

const EDITABLE_FIELDS = [
  'firstName', 'lastName', 'dob', 'gender', 'phone',
  'isMinor', 'guardianFirstName', 'guardianLastName', 'guardianEmail', 'guardianPhone', 'guardianRelationship',
  'linkedSpecialties',
  'insuranceType', 'insuranceId', 'insuranceName', 'insuranceGroup', 'insurancePlan',
  'address', 'city', 'state', 'zip',
  'highTech', 'dxCode1', 'dxCode2', 'dxCode3', 'dxCode4',
  'paNumber', 'paStartDate', 'paEndDate',
  'subscriberName', 'subscriberRelation',
  'networkStatus', 'hasCaseRate', 'caseRateAmount', 'policyNotes',
  'ins2Type', 'ins2Id', 'ins2Name', 'ins2Group', 'ins2Plan',
  'ins2SubscriberName', 'ins2SubscriberRelation',
  'ins2NetworkStatus', 'ins2HasCaseRate', 'ins2CaseRateAmount', 'ins2PolicyNotes',
] as const

// GET — full patient record, for the myPatients detail/edit page
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const link = await (prisma.guardianPatient.findUnique as any)({
    where: { userId_patientId: { userId: session.id, patientId: id } },
  })
  if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const patient = await (prisma.patient.findUnique as any)({ where: { id } })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  // Active nurses linked to this patient — sources the nurse picker on the
  // family Schedule tab (assigning an already-authorized nurse to a shift).
  const nurseLinks = await (prisma.nursePatient.findMany as any)({
    where: { patientId: id, isActive: true },
    select: { id: true, nurse: { select: { id: true, displayName: true, firstName: true, lastName: true } } },
  })

  return NextResponse.json({ patient: { ...patient, medicationRemindersOptIn: link.medicationRemindersOptIn }, nurseLinks })
}

// PATCH — update demographics/insurance/clinical fields, or this guardian's
// own medicationRemindersOptIn flag (lives on GuardianPatient, not Patient)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.id, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  if ('medicationRemindersOptIn' in body) {
    await (prisma.guardianPatient.update as any)({
      where: { userId_patientId: { userId: session.id, patientId: id } },
      data: { medicationRemindersOptIn: !!body.medicationRemindersOptIn },
    })
  }

  const data: Record<string, any> = {}
  for (const key of EDITABLE_FIELDS) {
    if (key in body) data[key] = body[key]
  }

  if (Object.keys(data).length) {
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
  }

  const patient = Object.keys(data).length
    ? await (prisma.patient.update as any)({ where: { id }, data })
    : await (prisma.patient.findUnique as any)({ where: { id } })

  return NextResponse.json({ ok: true, patient })
}
