import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { sendGuardianWelcomeEmail } from '../../../../../../lib/sendEmail'
import { GUARDIAN_RELATIONSHIPS } from '../../../../../../lib/guardianRelationship'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'guardian') return null
  return session
}

async function verifyGuardianLinked(userId: string, patientId: string) {
  const link = await (prisma.guardianPatient.findUnique as any)({
    where: { userId_patientId: { userId, patientId } },
  })
  return !!link
}

// POST — a guardian invites another family member as a guardian for a patient
// they're themselves already linked to (body: { name, email, phone, relationship, hipaaAcknowledged })
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyGuardianLinked(session.id, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, email, phone, relationship, hipaaAcknowledged } = await req.json()
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
  }
  if (!GUARDIAN_RELATIONSHIPS.includes(relationship)) {
    return NextResponse.json({ error: 'A valid relationship type is required' }, { status: 400 })
  }
  if (!hipaaAcknowledged) {
    return NextResponse.json({ error: 'HIPAA notice must be acknowledged before inviting a guardian' }, { status: 400 })
  }

  const hipaaAcknowledgedAt = new Date()

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (existing) {
    if (existing.role !== 'guardian') {
      return NextResponse.json({ error: 'An account with this email already exists under a different role' }, { status: 409 })
    }
    await (prisma.guardianPatient.upsert as any)({
      where: { userId_patientId: { userId: existing.id, patientId: id } },
      create: { userId: existing.id, patientId: id, relationship, invitedByUserId: session.id, hipaaAcknowledgedAt },
      update: { relationship, invitedByUserId: session.id, hipaaAcknowledgedAt },
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
    data: { userId: user.id, patientId: id, relationship, invitedByUserId: session.id, hipaaAcknowledgedAt },
  })

  const sent = await sendGuardianWelcomeEmail({
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
