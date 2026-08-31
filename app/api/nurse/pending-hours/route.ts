import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { effectivePendingHourStatus } from '../../../../lib/pendingHours'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// This nurse's Pending Hours — scheduled/awaiting-confirmation shifts she
// hasn't confirmed yet, plus recently confirmed/not-worked ones for context.
// Feeds the "Scheduled Shifts" section on /nurse/hours.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const rows = await (prisma.pendingHour.findMany as any)({
    where: {
      nurseId: session.nurseProfileId,
      OR: [
        { status: 'scheduled' },
        { status: { in: ['confirmed', 'not_worked'] }, updatedAt: { gte: thirtyDaysAgo } },
      ],
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      shift: { select: { endTime: true, startTime: true } },
    },
    orderBy: { dateOfService: 'asc' },
  })

  const items = rows.map((r: any) => ({
    id: r.id,
    shiftId: r.shiftId,
    patientId: r.patientId,
    patientName: `${r.patient.firstName} ${r.patient.lastName}`,
    dateOfService: r.dateOfService,
    scheduledStart: r.scheduledStart,
    scheduledEnd: r.scheduledEnd,
    scheduledHours: r.scheduledHours,
    actualStart: r.actualStart,
    actualEnd: r.actualEnd,
    actualHours: r.actualHours,
    shiftEndTime: r.shift.endTime,
    status: effectivePendingHourStatus(r.status, r.shift.endTime),
  }))

  return NextResponse.json({ items })
}
