import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

function nextAccountNumber(count: number) {
  return `PT-${String(count + 1).padStart(3, '0')}`
}

export async function POST(req: Request) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patient: p, initialPA } = await req.json()
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
      insuranceType: p.insuranceType || 'Medicaid',
      insuranceId: p.insuranceId?.trim() || '',
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
      subscriberName: p.subscriberName || null,
      subscriberRelation: p.subscriberRelation || null,
      networkStatus: p.networkStatus || null,
      hasCaseRate: p.hasCaseRate ?? false,
      caseRateAmount: p.caseRateAmount || null,
      policyNotes: p.policyNotes || null,
    },
  })

  if (initialPA?.paNumber?.trim()) {
    await (prisma.patientPA.create as any)({
      data: {
        id: crypto.randomUUID(),
        patientId: patient.id,
        paNumber: initialPA.paNumber.trim(),
        paStartDate: initialPA.paStartDate || null,
        paEndDate: initialPA.paEndDate || null,
        highTech: initialPA.highTech ?? false,
      },
    })
    if (initialPA.highTech) {
      await (prisma.patient.update as any)({ where: { id: patient.id }, data: { highTech: true } })
    }
  }

  return NextResponse.json({ ok: true, patient })
}

export async function GET(req: Request) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patients = await (prisma.patient.findMany as any)({
    include: {
      nurseLinks: {
        include: {
          nurse: { select: { id: true, displayName: true, firstName: true, lastName: true, accountNumber: true } },
        },
      },
      priorAuths: { orderBy: [{ paStartDate: 'desc' }, { createdAt: 'desc' }] },
      _count: { select: { timeEntries: true } },
    },
    orderBy: { accountNumber: 'asc' },
  })

  return NextResponse.json({ patients })
}
