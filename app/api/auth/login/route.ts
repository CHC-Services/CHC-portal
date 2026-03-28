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

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

 const token = signToken({
  id: user.id,
  role: user.role,
  nurseProfileId: user.nurseProfile?.id,
  // user.name is not present in the generated client until after running
  // a migration, so cast to any to satisfy TS for now.
  name: (user as any).name,
  displayName: user.nurseProfile?.displayName
})

  const res = NextResponse.json({ ok: true, role: user.role })

  // use a consistent cookie name that the middleware already expects
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24-hour inactivity window — refreshed on every page visit
  })

  return res
}
