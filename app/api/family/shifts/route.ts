import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { canCreateShift } from '../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patientId = new URL(req.url).searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

  const link = await prisma.guardianPatient.findUnique({
    where: { userId_patientId: { userId: session.id, patientId } },
  })
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const shifts = await prisma.shift.findMany({
    where: { patientId, status: { not: 'cancelled' } },
    orderBy: { startTime: 'asc' },
  })
  return NextResponse.json({ shifts })
}

export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patientId, nurseId, startTime, endTime, notes } = await req.json()
  if (!patientId || !startTime || !endTime) {
    return NextResponse.json({ error: 'patientId, startTime, and endTime are required' }, { status: 400 })
  }

  if (!(await canCreateShift(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Integrity check, not an authorization check: whoever is being assigned
  // must actually be an authorized (active) nurse for this patient.
  if (nurseId) {
    const link = await prisma.nursePatient.findUnique({
      where: { nurseId_patientId: { nurseId, patientId } },
    })
    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'That nurse is not authorized for this patient' }, { status: 400 })
    }
  }

  const shift = await prisma.shift.create({
    data: {
      id: crypto.randomUUID(),
      patientId,
      nurseId: nurseId || null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: nurseId ? 'assigned' : 'open',
      notes: notes || null,
      createdByUserId: session.id,
      createdByRole: 'guardian',
    },
  })

  return NextResponse.json({ shift })
}
