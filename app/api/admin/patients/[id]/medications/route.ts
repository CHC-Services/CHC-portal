import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { resolvePharmacy, flattenMedication } from '../../../../../../lib/pharmacyLookup'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// POST — add a new medication
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { medicationName, rxcui, dose, doseUnit, unitStrength, unitType, frequency, route, duration, daySupply, lastFillDate, rxNumber, refillsRemaining, pharmacyName, pharmacyAddress, pharmacyPhone } = body
  if (!medicationName?.trim()) return NextResponse.json({ error: 'Medication name required' }, { status: 400 })
  if (!lastFillDate) return NextResponse.json({ error: 'Last fill date required' }, { status: 400 })

  const pharmacyId = await resolvePharmacy({ name: pharmacyName, address: pharmacyAddress, phone: pharmacyPhone })

  const medication = await (prisma.patientMedication.create as any)({
    data: {
      patientId: id,
      medicationName: medicationName.trim(),
      rxcui: rxcui || null,
      dose: dose || null,
      doseUnit: doseUnit || null,
      unitStrength: unitStrength || null,
      unitType: unitType || null,
      frequency: frequency || null,
      route: route || null,
      duration: duration || null,
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
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { medId, medicationName, rxcui, dose, doseUnit, unitStrength, unitType, frequency, route, duration, daySupply, lastFillDate, rxNumber, refillsRemaining, pharmacyName, pharmacyAddress, pharmacyPhone, active } = await req.json()
  if (!medId) return NextResponse.json({ error: 'medId required' }, { status: 400 })

  const data: Record<string, any> = {}
  if (medicationName !== undefined) data.medicationName = medicationName?.trim()
  if (rxcui !== undefined) data.rxcui = rxcui || null
  if (dose !== undefined) data.dose = dose || null
  if (doseUnit !== undefined) data.doseUnit = doseUnit || null
  if (unitStrength !== undefined) data.unitStrength = unitStrength || null
  if (unitType !== undefined) data.unitType = unitType || null
  if (frequency !== undefined) data.frequency = frequency || null
  if (route !== undefined) data.route = route || null
  if (duration !== undefined) data.duration = duration || null
  if (daySupply !== undefined) data.daySupply = parseInt(daySupply, 10)
  if (lastFillDate !== undefined) data.lastFillDate = new Date(lastFillDate)
  if (rxNumber !== undefined) data.rxNumber = rxNumber || null
  if (refillsRemaining !== undefined) data.refillsRemaining = refillsRemaining != null && refillsRemaining !== '' ? parseInt(refillsRemaining, 10) : null
  if (pharmacyName !== undefined) data.pharmacyId = await resolvePharmacy({ name: pharmacyName, address: pharmacyAddress, phone: pharmacyPhone })
  if (active !== undefined) data.active = !!active

  const { count } = await (prisma.patientMedication.updateMany as any)({
    where: { id: medId, patientId: id },
    data,
  })
  if (count === 0) return NextResponse.json({ error: 'Medication not found' }, { status: 404 })

  const medication = await (prisma.patientMedication.findUnique as any)({ where: { id: medId }, include: { pharmacy: true } })
  return NextResponse.json({ ok: true, medication: flattenMedication(medication) })
}

// DELETE — remove a medication (body: { medId })
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { medId } = await req.json()
  if (!medId) return NextResponse.json({ error: 'medId required' }, { status: 400 })

  const { count } = await (prisma.patientMedication.deleteMany as any)({ where: { id: medId, patientId: id } })
  if (count === 0) return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
