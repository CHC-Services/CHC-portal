import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'nurse') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.nurseProfile.update({
    where: { id: session.nurseProfileId! },
    data: { onboardingComplete: false }
  })

  return NextResponse.json({ ok: true })
}
