import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patient = await (prisma.patient.findUnique as any)({
    where: { id: params.id },
    include: {
      nurseLinks: {
        include: {
          nurse: { select: { id: true, displayName: true, accountNumber: true, email: true } },
        },
      },
      timeEntries: {
        orderBy: { workDate: 'desc' },
        take: 50,
        include: {
          nurse: { select: { displayName: true, accountNumber: true } },
        },
      },
    },
  })

  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ patient })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates = await req.json()
  const allowed = [
    'lastName', 'firstName', 'dob', 'gender',
    'insuranceType', 'insuranceId', 'insuranceName', 'insuranceGroup', 'insurancePlan',
    'address', 'city', 'state', 'zip', 'phone',
    'highTech', 'dxCode1', 'dxCode2', 'dxCode3', 'dxCode4',
    'paNumber', 'paStartDate', 'paEndDate',
    'subscriberName', 'subscriberRelation',
    'networkStatus', 'hasCaseRate', 'caseRateAmount', 'policyNotes',
  ]
  const data: Record<string, any> = {}
  for (const key of allowed) {
    if (key in updates) data[key] = updates[key]
  }
  data.updatedAt = new Date()

  const patient = await (prisma.patient.update as any)({
    where: { id: params.id },
    data,
  })

  return NextResponse.json({ ok: true, patient })
}
