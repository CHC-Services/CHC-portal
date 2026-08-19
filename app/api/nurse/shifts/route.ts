import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// This nurse's own shifts, plus open shifts (claimable) on patients they're
// actively linked to.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const links = await prisma.nursePatient.findMany({
    where: { nurseId: session.nurseProfileId, isActive: true },
    select: { patientId: true },
  })
  const patientIds = links.map(l => l.patientId)

  const [mine, open] = await Promise.all([
    prisma.shift.findMany({ where: { nurseId: session.nurseProfileId, status: { not: 'cancelled' } }, orderBy: { startTime: 'asc' } }),
    patientIds.length
      ? prisma.shift.findMany({ where: { patientId: { in: patientIds }, status: { in: ['open', 'coverage_needed'] } }, orderBy: { startTime: 'asc' } })
      : [],
  ])

  return NextResponse.json({ shifts: mine, openShifts: open })
}
