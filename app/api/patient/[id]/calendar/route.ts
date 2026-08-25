import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'
import { canAccessPatient } from '../../../../../lib/permissions'
import { getPatientCalendarFeed, parseDateRangeParams } from '../../../../../lib/calendarFeed'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Role-agnostic per-patient calendar — backs app/patient/[id]/calendar, and
// is the shared source of truth every role's client hits (nurse/guardian/
// admin all pass the same canAccessPatient check).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canAccessPatient(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const range = parseDateRangeParams(new URL(req.url))
  const items = await getPatientCalendarFeed(patientId, range)
  return NextResponse.json({ items })
}
