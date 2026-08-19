import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { getPatientCalendarFeed, type CalendarItem } from '../../../../lib/calendarFeed'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// A guardian's feed across every patient they're linked to. This route is
// read-only; shifts/appointments are created/edited via /api/family/shifts
// and /api/family/appointments.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const links = await prisma.guardianPatient.findMany({
    where: { userId: session.id },
    select: { patientId: true, patient: { select: { firstName: true, lastName: true } } },
  })

  const perPatient = await Promise.all(links.map(l => getPatientCalendarFeed(l.patientId)))
  const patientName = Object.fromEntries(links.map(l => [l.patientId, `${l.patient.firstName} ${l.patient.lastName}`]))

  const items: CalendarItem[] = perPatient
    .flat()
    .map(item => ({ ...item, patientName: item.patientId ? patientName[item.patientId] : item.patientName }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  return NextResponse.json({ items })
}
