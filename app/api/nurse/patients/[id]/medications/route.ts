import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'nurse') return null
  return session
}

async function verifyLinked(nurseId: string, patientId: string) {
  const link = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId, patientId } },
    select: { isActive: true },
  })
  return link?.isActive === true
}

// GET — list all medications for a patient
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const medications = await (prisma.patientMedication.findMany as any)({
    where: { patientId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ medications })
}

// POST — add a new medication
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const canonical = await (prisma.patient.findUnique as any)({ where: { id }, select: { isLocked: true } })
  if (canonical?.isLocked) return NextResponse.json({ error: 'Record locked by admin' }, { status: 403 })

  const body = await req.json()
  const { medicationName, dose, frequency, daySupply, lastFillDate, rxNumber, refillsRemaining, pharmacyName, pharmacyPhone } = body
  if (!medicationName?.trim()) return NextResponse.json({ error: 'Medication name required' }, { status: 400 })
  if (!lastFillDate) return NextResponse.json({ error: 'Last fill date required' }, { status: 400 })

  const medication = await (prisma.patientMedication.create as any)({
    data: {
      patientId: id,
      medicationName: medicationName.trim(),
      dose: dose || null,
      frequency: frequency || null,
      daySupply: daySupply ? parseInt(daySupply, 10) : 30,
      lastFillDate: new Date(lastFillDate),
      rxNumber: rxNumber || null,
      refillsRemaining: refillsRemaining != null && refillsRemaining !== '' ? parseInt(refillsRemaining, 10) : null,
      pharmacyName: pharmacyName || null,
      pharmacyPhone: pharmacyPhone || null,
      createdByUserId: session.id,
      createdByRole: session.role,
    },
  })

  return NextResponse.json({ ok: true, medication })
}

// PATCH — edit an existing medication (body: { medId, ...fields })
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const canonical = await (prisma.patient.findUnique as any)({ where: { id }, select: { isLocked: true } })
  if (canonical?.isLocked) return NextResponse.json({ error: 'Record locked by admin' }, { status: 403 })

  const { medId, medicationName, dose, frequency, daySupply, lastFillDate, rxNumber, refillsRemaining, pharmacyName, pharmacyPhone, active } = await req.json()
  if (!medId) return NextResponse.json({ error: 'medId required' }, { status: 400 })

  const data: Record<string, any> = {}
  if (medicationName !== undefined) data.medicationName = medicationName?.trim()
  if (dose !== undefined) data.dose = dose || null
  if (frequency !== undefined) data.frequency = frequency || null
  if (daySupply !== undefined) data.daySupply = parseInt(daySupply, 10)
  if (lastFillDate !== undefined) data.lastFillDate = new Date(lastFillDate)
  if (rxNumber !== undefined) data.rxNumber = rxNumber || null
  if (refillsRemaining !== undefined) data.refillsRemaining = refillsRemaining != null && refillsRemaining !== '' ? parseInt(refillsRemaining, 10) : null
  if (pharmacyName !== undefined) data.pharmacyName = pharmacyName || null
  if (pharmacyPhone !== undefined) data.pharmacyPhone = pharmacyPhone || null
  if (active !== undefined) data.active = !!active

  // Scope the update to (medId AND patientId) so a nurse can't touch a medication
  // belonging to a different patient just by guessing its id.
  const { count } = await (prisma.patientMedication.updateMany as any)({
    where: { id: medId, patientId: id },
    data,
  })
  if (count === 0) return NextResponse.json({ error: 'Medication not found' }, { status: 404 })

  const medication = await (prisma.patientMedication.findUnique as any)({ where: { id: medId } })
  return NextResponse.json({ ok: true, medication })
}

// DELETE — remove a medication (body: { medId })
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const canonical = await (prisma.patient.findUnique as any)({ where: { id }, select: { isLocked: true } })
  if (canonical?.isLocked) return NextResponse.json({ error: 'Record locked by admin' }, { status: 403 })

  const { medId } = await req.json()
  if (!medId) return NextResponse.json({ error: 'medId required' }, { status: 400 })

  const { count } = await (prisma.patientMedication.deleteMany as any)({ where: { id: medId, patientId: id } })
  if (count === 0) return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
