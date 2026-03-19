import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import bcrypt from 'bcrypt'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { password } = await req.json()
  if (!password || password.trim().length < 1) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  const nurse = await prisma.nurseProfile.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!nurse) return NextResponse.json({ error: 'Nurse not found' }, { status: 404 })

  const hashed = await bcrypt.hash(password, 10)

  await prisma.user.update({
    where: { id: nurse.userId },
    data: { password: hashed },
  })

  return NextResponse.json({ ok: true })
}
