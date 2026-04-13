import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const assignments = await prisma.caseAssignment.findMany({
    where: { nurseId: session.nurseProfileId },
    include: { homeCase: true },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({
    cases: assignments.map(a => ({
      id: a.homeCase.id,
      patientFirstName: a.homeCase.patientFirstName,
      active: a.homeCase.active,
      joinedAt: a.joinedAt,
    })),
  })
}
