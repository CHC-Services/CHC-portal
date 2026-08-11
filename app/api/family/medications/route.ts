import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { resolvePharmacy, flattenMedication } from '../../../../lib/pharmacyLookup'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'guardian') return null
  return session
}

async function verifyGuardianLinked(userId: string, patientId: string) {
  const link = await (prisma.guardianPatient.findUnique as any)({
    where: { userId_patientId: { userId, patientId } },
  })
  return !!link
}

// GET — the guardian's linked patient(s) + their medications
export async function GET(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const links = await (prisma.guardianPatient.findMany as any)({
    where: { userId: session.id },
    include: {
      patient: {
        include: { medications: { orderBy: { createdAt: 'desc' }, include: { pharmacy: true } } },
      },
    },
  })

  const patients = links.map((l: any) => ({
    ...l.patient,
    medications: l.patient.medications.map(flattenMedication),
  }))
  return NextResponse.json({ patients })
}

// POST — add a new medication for one of this guardian's linked patients
export async function POST(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { patientId, medicationName, rxcui, dose, unitStrength, frequency, daySupply, lastFillDate, rxNumber, refillsRemaining, pharmacyName, pharmacyAddress, pharmacyPhone } = body
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })
  if (!await verifyGuardianLinked(session.id, patientId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!medicationName?.trim()) return NextResponse.json({ error: 'Medication name required' }, { status: 400 })
  if (!lastFillDate) return NextResponse.json({ error: 'Last fill date required' }, { status: 400 })

  const pharmacyId = await resolvePharmacy({ name: pharmacyName, address: pharmacyAddress, phone: pharmacyPhone })

  const medication = await (prisma.patientMedication.create as any)({
    data: {
      patientId,
      medicationName: medicationName.trim(),
      rxcui: rxcui || null,
      dose: dose || null,
      unitStrength: unitStrength || null,
      frequency: frequency || null,
      daySupply: daySupply ? parseInt(daySupply, 10) : 30,
      lastFillDate: new Date(lastFillDate),
      rxNumber: rxNumber || null,
      refillsRemaining: refillsRemaining != null && refillsRemaining !== '' ? parseInt(refillsRemaining, 10) : null,
      pharmacyId,
      createdByUserId: session.id,
      createdByRole: session.role,
    },
    include: { pharmacy: true },
  })

  return NextResponse.json({ ok: true, medication: flattenMedication(medication) })
}

// PATCH — edit an existing medication (body: { medId, ...fields })
export async function PATCH(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { medId, medicationName, rxcui, dose, unitStrength, frequency, daySupply, lastFillDate, rxNumber, refillsRemaining, pharmacyName, pharmacyAddress, pharmacyPhone, active } = await req.json()
  if (!medId) return NextResponse.json({ error: 'medId required' }, { status: 400 })

  const existing = await (prisma.patientMedication.findUnique as any)({ where: { id: medId }, select: { patientId: true } })
  if (!existing || !await verifyGuardianLinked(session.id, existing.patientId)) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
  }

  const data: Record<string, any> = {}
  if (medicationName !== undefined) data.medicationName = medicationName?.trim()
  if (rxcui !== undefined) data.rxcui = rxcui || null
  if (dose !== undefined) data.dose = dose || null
  if (unitStrength !== undefined) data.unitStrength = unitStrength || null
  if (frequency !== undefined) data.frequency = frequency || null
  if (daySupply !== undefined) data.daySupply = parseInt(daySupply, 10)
  if (lastFillDate !== undefined) data.lastFillDate = new Date(lastFillDate)
  if (rxNumber !== undefined) data.rxNumber = rxNumber || null
  if (refillsRemaining !== undefined) data.refillsRemaining = refillsRemaining != null && refillsRemaining !== '' ? parseInt(refillsRemaining, 10) : null
  if (pharmacyName !== undefined) data.pharmacyId = await resolvePharmacy({ name: pharmacyName, address: pharmacyAddress, phone: pharmacyPhone })
  if (active !== undefined) data.active = !!active

  const medication = await (prisma.patientMedication.update as any)({ where: { id: medId }, data, include: { pharmacy: true } })
  return NextResponse.json({ ok: true, medication: flattenMedication(medication) })
}

// DELETE — remove a medication (body: { medId })
export async function DELETE(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { medId } = await req.json()
  if (!medId) return NextResponse.json({ error: 'medId required' }, { status: 400 })

  const existing = await (prisma.patientMedication.findUnique as any)({ where: { id: medId }, select: { patientId: true } })
  if (!existing || !await verifyGuardianLinked(session.id, existing.patientId)) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
  }

  await (prisma.patientMedication.delete as any)({ where: { id: medId } })
  return NextResponse.json({ ok: true })
}
