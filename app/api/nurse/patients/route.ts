import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'nurse') return null
  return session
}

function nextAccountNumber(count: number) {
  return `PT-${String(count + 1).padStart(3, '0')}`
}

// GET — list this nurse's linked patients (canonical merged with overrides)
export async function GET(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const links = await (prisma.nursePatient.findMany as any)({
    where: { nurseId: session.nurseProfileId, isActive: true },
    include: { patient: true },
    orderBy: { createdAt: 'asc' },
  })

  const patients = links.map((link: any) => ({
    linkId: link.id,
    patientId: link.patientId,
    overrides: link.overrides,
    merged: { ...link.patient, ...(link.overrides || {}) },
  }))

  return NextResponse.json({ patients })
}

// POST — create a new canonical patient + link, OR link to existing patient
export async function POST(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Link to existing patient
  if (body.existingPatientId) {
    const existing = await (prisma.nursePatient.findUnique as any)({
      where: { nurseId_patientId: { nurseId: session.nurseProfileId!, patientId: body.existingPatientId } },
    })
    if (existing) {
      if (!existing.isActive) {
        await (prisma.nursePatient.update as any)({
          where: { id: existing.id },
          data: { isActive: true, updatedAt: new Date() },
        })
      }
      return NextResponse.json({ ok: true, linked: true })
    }
    await (prisma.nursePatient.create as any)({
      data: {
        id: crypto.randomUUID(),
        nurseId: session.nurseProfileId!,
        patientId: body.existingPatientId,
      },
    })
    return NextResponse.json({ ok: true, linked: true })
  }

  // Create new canonical patient + link
  const { patient: p } = body
  if (!p) return NextResponse.json({ error: 'Missing patient data' }, { status: 400 })

  const count = await (prisma.patient.count as any)()
  const accountNumber = nextAccountNumber(count)

  const patient = await (prisma.patient.create as any)({
    data: {
      id: crypto.randomUUID(),
      accountNumber,
      lastName: p.lastName?.trim(),
      firstName: p.firstName?.trim(),
      dob: p.dob?.trim(),
      gender: p.gender || null,
      insuranceType: p.insuranceType,
      insuranceId: p.insuranceId?.trim(),
      insuranceName: p.insuranceName || null,
      insuranceGroup: p.insuranceGroup || null,
      insurancePlan: p.insurancePlan || null,
      address: p.address || null,
      city: p.city || null,
      state: p.state || null,
      zip: p.zip || null,
      phone: p.phone || null,
      highTech: p.highTech ?? false,
      dxCode1: p.dxCode1 || null,
      dxCode2: p.dxCode2 || null,
      dxCode3: p.dxCode3 || null,
      dxCode4: p.dxCode4 || null,
      paNumber: p.paNumber || null,
      paStartDate: p.paStartDate || null,
      paEndDate: p.paEndDate || null,
      subscriberName: p.subscriberName || null,
      subscriberRelation: p.subscriberRelation || null,
      networkStatus: p.networkStatus || null,
      hasCaseRate: p.hasCaseRate ?? false,
      caseRateAmount: p.caseRateAmount || null,
      policyNotes: p.policyNotes || null,
    },
  })

  await (prisma.nursePatient.create as any)({
    data: {
      id: crypto.randomUUID(),
      nurseId: session.nurseProfileId!,
      patientId: patient.id,
    },
  })

  return NextResponse.json({ ok: true, patient })
}
