import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { getNurseCalendarFeed, parseDateRangeParams } from '../../../../lib/calendarFeed'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const range = parseDateRangeParams(new URL(req.url))

  // Non-nurse roles (admin/provider/biller browsing /portal or /resources)
  // still see role-targeted GlobalEvent broadcasts, just nothing patient-scoped.
  if (!session.nurseProfileId) {
    const now = new Date()
    const globalEvents = await prisma.globalEvent.findMany({
      where: { eventDate: range.start || range.end ? { gte: range.start, lte: range.end } : { gte: now } },
      orderBy: { eventDate: 'asc' },
    })
    const items = globalEvents
      .filter(e => e.targetRoles.length === 0 || e.targetRoles.includes(session.role))
      .map(e => ({ id: e.id, source: 'globalEvent' as const, title: e.title, date: e.eventDate, category: e.category, description: e.description ?? undefined, editable: false }))
    return NextResponse.json({ items })
  }

  const items = await getNurseCalendarFeed(session.nurseProfileId, session, range)
  return NextResponse.json({ items })
}
