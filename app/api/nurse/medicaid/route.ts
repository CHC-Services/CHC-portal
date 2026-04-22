import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || !['nurse'].includes(session.role) || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const claims = await (prisma.medicaidClaim.findMany as any)({
    where: { nurseId: session.nurseProfileId },
    orderBy: { dosStart: 'desc' },
  })

  return NextResponse.json(claims)
}
