import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { getPatientCalendarFeed, parseDateRangeParams, type CalendarItem } from '../../../../lib/calendarFeed'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Two modes:
// - ?patientId=... — that one patient's calendar (unchanged from before).
// - no patientId — admin's own "adCalendar" management view: every
//   GlobalEvent they've created, regardless of audience (they're the
//   author/manager, so unlike every other role's feed this is NOT filtered
//   by targetRoles — that filtering is what recipients see, not what the
//   admin managing them sees).
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const patientId = url.searchParams.get('patientId')
  const range = parseDateRangeParams(url)

  if (patientId) {
    const items = await getPatientCalendarFeed(patientId, range)
    return NextResponse.json({ items })
  }

  const now = new Date()
  const events = await prisma.globalEvent.findMany({
    where: { eventDate: range.start || range.end ? { gte: range.start, lte: range.end } : { gte: now } },
    orderBy: { eventDate: 'asc' },
  })
  const items: CalendarItem[] = events.map(e => ({
    id: e.id,
    source: 'globalEvent' as const,
    title: e.title,
    date: e.eventDate,
    category: e.category,
    description: e.description ?? undefined,
    editable: true,
    targetRoles: e.targetRoles,
    allDay: e.allDay,
    recurrence: e.recurrence,
  }))
  return NextResponse.json({ items })
}
