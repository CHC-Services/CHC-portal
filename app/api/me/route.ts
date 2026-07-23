import { NextResponse } from 'next/server'
import { verifyToken } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session) return NextResponse.json(null, { status: 401 })

  const profile = session.nurseProfileId
    ? await (prisma.nurseProfile.findUnique as any)({
        where: { id: session.nurseProfileId },
        select: { displayName: true, firstName: true, lastName: true },
      })
    : null

  return NextResponse.json({
    id: session.id,
    role: session.role,
    name: session.name,
    displayName: profile?.displayName ?? session.displayName ?? session.name,
    firstName: profile?.firstName ?? session.firstName,
    lastName: profile?.lastName ?? session.lastName,
    isDemo: session.isDemo ?? false,
    email: (await prisma.user.findUnique({ where: { id: session.id }, select: { email: true } }))?.email,
  })
}
