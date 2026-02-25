import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '../../../../lib/prisma'
import { signToken } from '../../../../lib/auth'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  const user = await prisma.user.findUnique({
    where: { email },
    include: { nurseProfile: true }
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)

  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = signToken({
    id: user.id,
    role: user.role,
    nurseProfileId: user.nurseProfile?.id
  })

  const res = NextResponse.json({ ok: true, role: user.role })

  res.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  })

  return res
}
