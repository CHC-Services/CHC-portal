import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth'
import { getPatientCalendarFeed } from '../../../../lib/calendarFeed'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patientId = new URL(req.url).searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

  const items = await getPatientCalendarFeed(patientId)
  return NextResponse.json({ items })
}
