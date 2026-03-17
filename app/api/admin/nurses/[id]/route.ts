import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { encrypt, decrypt } from '../../../../../lib/encrypt'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const profile = await prisma.nurseProfile.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true } } }
  })

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const p = profile as any
  return NextResponse.json({
    ...profile,
    ssnEncrypted:         undefined,
    einEncrypted:         undefined,
    feinEncrypted:        undefined,
    bankRoutingEncrypted: undefined,
    bankAccountEncrypted: undefined,
    // send masked or decrypted versions
    ssn:         p.ssnEncrypted         ? decrypt(p.ssnEncrypted)         : '',
    ein:         p.einEncrypted         ? decrypt(p.einEncrypted)         : '',
    fein:        p.feinEncrypted        ? decrypt(p.feinEncrypted)        : '',
    bankRouting: p.bankRoutingEncrypted ? decrypt(p.bankRoutingEncrypted) : '',
    bankAccount: p.bankAccountEncrypted ? decrypt(p.bankAccountEncrypted) : '',
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const {
    // encrypted fields — handled separately
    ssn, ein, fein, bankRouting, bankAccount,
    ssnEncrypted, einEncrypted, feinEncrypted,
    bankRoutingEncrypted, bankAccountEncrypted,
    // read-only / relation fields — strip before passing to Prisma
    id: _id, userId, user, createdAt, updatedAt,
    ...rest
  } = body

  const data: Record<string, unknown> = { ...rest }

  if (ssn !== undefined)         data.ssnEncrypted         = ssn         ? encrypt(ssn)         : null
  if (ein !== undefined)         data.einEncrypted         = ein         ? encrypt(ein)         : null
  if (fein !== undefined)        data.feinEncrypted        = fein        ? encrypt(fein)        : null
  if (bankRouting !== undefined) data.bankRoutingEncrypted = bankRouting ? encrypt(bankRouting) : null
  if (bankAccount !== undefined) data.bankAccountEncrypted = bankAccount ? encrypt(bankAccount) : null

  try {
    await prisma.nurseProfile.update({ where: { id }, data })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Admin nurse PATCH error:', err)
    return NextResponse.json({ error: err.message || 'Save failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const profile = await prisma.nurseProfile.findUnique({ where: { id }, select: { userId: true } })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete in dependency order:
  // 1. TimeEntries (no cascade from NurseProfile)
  // 2. NurseProfile (cascades Claims + EnrollmentLogs)
  // 3. User
  await prisma.$transaction([
    prisma.timeEntry.deleteMany({ where: { nurseId: id } }),
    prisma.nurseProfile.delete({ where: { id } }),
    prisma.user.delete({ where: { id: profile.userId } }),
  ])

  return NextResponse.json({ ok: true })
}
