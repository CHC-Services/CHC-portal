import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nurses = await prisma.nurseProfile.findMany({
    include: {
      user: { select: { email: true, name: true } },
      timeEntries: {
        orderBy: { workDate: 'desc' }
      }
    },
    orderBy: { displayName: 'asc' }
  })

  return NextResponse.json(nurses)
}
