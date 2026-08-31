import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canConfirmPendingHour } from '../../../../../../lib/pendingHours'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// "I worked different hours than scheduled" — body { actualStart, actualEnd }
// (ISO strings). Recomputes hours from the actual times and materializes the
// TimeEntry off those instead of the scheduled ones.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const { actualStart, actualEnd } = await req.json()
  if (!actualStart || !actualEnd) {
    return NextResponse.json({ error: 'actualStart and actualEnd are required' }, { status: 400 })
  }

  const start = new Date(actualStart)
  const end = new Date(actualEnd)
  const hours = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100
  if (isNaN(hours) || hours <= 0) {
    return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
  }

  const pendingHour = await (prisma.pendingHour.findUnique as any)({
    where: { id },
    include: { shift: { select: { endTime: true } } },
  })
  if (!pendingHour) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!canConfirmPendingHour(pendingHour, pendingHour.shift.endTime, session.nurseProfileId)) {
    return NextResponse.json({ error: 'This shift can’t be confirmed yet — it hasn’t ended.' }, { status: 403 })
  }

  try {
    const timeEntryId = await prisma.$transaction(async (tx: any) => {
      const timeEntry = await tx.timeEntry.create({
        data: {
          nurseId: pendingHour.nurseId,
          patientId: pendingHour.patientId,
          workDate: pendingHour.dateOfService,
          hours,
        },
      })
      await tx.pendingHour.update({
        where: { id },
        data: { status: 'confirmed', timeEntryId: timeEntry.id, actualStart: start, actualEnd: end, actualHours: hours },
      })
      return timeEntry.id
    })
    return NextResponse.json({ ok: true, timeEntryId })
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'An hours entry already exists for this date and patient — resolve it on myHours before confirming.' }, { status: 409 })
    }
    throw err
  }
}
