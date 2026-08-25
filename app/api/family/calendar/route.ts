import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth'
import { getFamilyCalendarFeed, parseDateRangeParams } from '../../../../lib/calendarFeed'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// A guardian's feed across every patient they're linked to, plus GlobalEvent
// broadcasts targeted at 'guardian' (or everyone). Read-only; shifts/
// appointments are created/edited via /api/family/shifts and
// /api/family/appointments.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const range = parseDateRangeParams(new URL(req.url))
  const items = await getFamilyCalendarFeed(session.id, session, range)
  return NextResponse.json({ items })
}
