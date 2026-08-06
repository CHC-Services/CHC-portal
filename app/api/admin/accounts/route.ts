import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — every account in the system, across all roles, for the adAccounts directory
export async function GET(req: Request) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = await (prisma.user.findMany as any)({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      nurseProfile: {
        select: { id: true, displayName: true, accountNumber: true, isDemo: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const accounts = users.map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    displayName: u.nurseProfile?.displayName ?? null,
    accountNumber: u.nurseProfile?.accountNumber ?? null,
    nurseProfileId: u.nurseProfile?.id ?? null,
    isDemo: u.nurseProfile?.isDemo ?? false,
  }))

  return NextResponse.json({ accounts })
}
