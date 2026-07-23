import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { sendWelcomeEmail } from '../../../../../../lib/sendEmail'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'nurse') return null
  return session
}

async function verifyLinked(nurseId: string, patientId: string) {
  const link = await (prisma.nursePatient.findUnique as any)({
    where: { nurseId_patientId: { nurseId, patientId } },
    select: { isActive: true },
  })
  return link?.isActive === true
}

// POST — invite a family member as a guardian for this patient (body: { name, email, phone })
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, email, phone } = await req.json()
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (existing) {
    if (existing.role !== 'guardian') {
      return NextResponse.json({ error: 'An account with this email already exists under a different role' }, { status: 409 })
    }
    await (prisma.guardianPatient.upsert as any)({
      where: { userId_patientId: { userId: existing.id, patientId: id } },
      create: { userId: existing.id, patientId: id },
      update: {},
    })
    return NextResponse.json({ ok: true, email: existing.email, linkedExisting: true })
  }

  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const hashed = await bcrypt.hash(tempPassword, 10)

  const user = await prisma.user.create({
    data: {
      email: email.trim().toLowerCase(),
      password: hashed,
      name: name.trim(),
      phone: phone || null,
      role: 'guardian',
    },
  })

  await (prisma.guardianPatient.create as any)({
    data: { userId: user.id, patientId: id },
  })

  const sent = await sendWelcomeEmail({
    to: user.email,
    displayName: name.trim(),
    email: user.email,
    password: tempPassword,
  })

  if (!sent) {
    return NextResponse.json({ error: 'Account created but email failed to send. Check Resend configuration.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email: user.email })
}
