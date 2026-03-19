import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { sendWelcomeEmail } from '../../../../../../lib/sendEmail'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Load nurse profile + user
  const profile = await (prisma.nurseProfile as any).findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true } } },
  })

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Generate new temp password
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

  // Hash and update
  const hashed = await bcrypt.hash(tempPassword, 10)
  await prisma.user.update({
    where: { id: profile.user.id },
    data: { password: hashed },
  })

  // Send welcome email
  const sent = await sendWelcomeEmail({
    to: profile.user.email,
    displayName: profile.displayName,
    email: profile.user.email,
    password: tempPassword,
  })

  if (!sent) {
    return NextResponse.json({ error: 'Password reset but email failed to send. Check Resend configuration.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email: profile.user.email })
}
