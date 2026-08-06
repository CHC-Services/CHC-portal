import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

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

  if (!await verifyLinked(session.id, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patient = await (prisma.patient.findUnique as any)({ where: { id } })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  return NextResponse.json({ patient })
}

// PATCH — update demographics/insurance/clinical fields
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.id, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const data: Record<string, any> = {}
  for (const key of EDITABLE_FIELDS) {
    if (key in body) data[key] = body[key]
  }

  const patient = await (prisma.patient.update as any)({ where: { id }, data })
  return NextResponse.json({ ok: true, patient })
}
