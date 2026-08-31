import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canConfirmPendingHour } from '../../../../../../lib/pendingHours'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// "This scheduled shift wasn't worked" — no TimeEntry gets created; the
// scheduled record is preserved with status 'not_worked' rather than deleted
// (spec §9), so there's still a historical trace of what was scheduled.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const pendingHour = await (prisma.pendingHour.findUnique as any)({
    where: { id },
    include: { shift: { select: { endTime: true } } },
  })
  if (!pendingHour) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!canConfirmPendingHour(pendingHour, pendingHour.shift.endTime, session.nurseProfileId)) {
    return NextResponse.json({ error: 'This shift can’t be marked yet — it hasn’t ended.' }, { status: 403 })
  }

  await (prisma.pendingHour.update as any)({ where: { id }, data: { status: 'not_worked' } })
  return NextResponse.json({ ok: true })
}
