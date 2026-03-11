import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

async function generateAccountNumber(): Promise<string> {
  while (true) {
    const num = 'CHC-' + String(Math.floor(10000 + Math.random() * 90000))
    const existing = await (prisma.nurseProfile.findUnique as any)({ where: { accountNumber: num } })
    if (!existing) return num
  }
}

export async function POST(req: Request) {
  const { email, password, role, name, displayName } = await req.json()

  const userCount = await prisma.user.count()

  if (userCount > 0) {
    const cookie = req.headers.get('cookie') || ''
    const token = cookie.split('auth_token=').pop()?.split(';')[0]
    const session = token ? verifyToken(token) : null

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const hashed = await bcrypt.hash(password, 10)

  const user = await (prisma.user.create as any)({
    data: {
      email,
      password: hashed,
      name: name || email,
      role: role === 'admin' ? 'admin' : 'nurse',
      nurseProfile:
        role === 'nurse'
          ? { create: { displayName: displayName || email, accountNumber: await generateAccountNumber() } }
          : undefined
    },
    select: { id: true, email: true, role: true, nurseProfile: { select: { id: true } } }
  })

  return NextResponse.json(user)
}
