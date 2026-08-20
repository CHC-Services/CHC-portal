import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

// Lightweight endpoint — nurse profile basics.
export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profiles = await prisma.nurseProfile.findMany({
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      notifyNewClaim: true,
    },
  })

  return NextResponse.json(profiles)
}
