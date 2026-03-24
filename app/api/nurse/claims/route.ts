import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [claims, profile] = await Promise.all([
    prisma.claim.findMany({
      where: { nurseId: session.nurseProfileId },
      orderBy: { dosStart: 'desc' }
    }),
    prisma.nurseProfile.findUnique({
      where: { id: session.nurseProfileId },
      select: { enrolledInBilling: true }
    })
  ])

  return NextResponse.json({ claims, enrolledInBilling: profile?.enrolledInBilling ?? null })
}
