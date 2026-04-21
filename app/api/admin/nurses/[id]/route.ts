import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { encrypt, decrypt } from '../../../../../lib/encrypt'
import { sendAccessDeniedEmail } from '../../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Handles both encrypted (iv:tag:ciphertext) and legacy plain-text values
function safeDecrypt(val: string | null | undefined): string {
  if (!val) return ''
  const parts = val.split(':')
  if (parts.length === 3 && parts[0].length === 24) {
    try { return decrypt(val) } catch { return val }
  }
  return val
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const profile = await prisma.nurseProfile.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true, lastLoginAt: true } } }
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
    // send decrypted versions
    ssn:           p.ssnEncrypted         ? safeDecrypt(p.ssnEncrypted)         : '',
    ein:           p.einEncrypted         ? safeDecrypt(p.einEncrypted)         : '',
    fein:          p.feinEncrypted        ? safeDecrypt(p.feinEncrypted)        : '',
    bankRouting:   p.bankRoutingEncrypted ? safeDecrypt(p.bankRoutingEncrypted) : '',
    bankAccount:   p.bankAccountEncrypted ? safeDecrypt(p.bankAccountEncrypted) : '',
    dob:           safeDecrypt(p.dob),
    npiNumber:     safeDecrypt(p.npiNumber),
    medicaidNumber: safeDecrypt(p.medicaidNumber),
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
    dob, npiNumber, medicaidNumber,
    ssnEncrypted, einEncrypted, feinEncrypted,
    bankRoutingEncrypted, bankAccountEncrypted,
    // read-only / relation fields — strip before passing to Prisma
    id: _id, userId, user, createdAt, updatedAt,
    ...rest
  } = body

  // Extract user.email if the form sent it as a flat dot-notation key
  const userEmail: string | undefined = rest['user.email'] as string | undefined
  delete rest['user.email']

  // Strip any remaining dot-notation or relation keys Prisma doesn't know about
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (!key.includes('.')) data[key] = value
  }

  if (ssn !== undefined)           data.ssnEncrypted         = ssn         ? encrypt(ssn)         : null
  if (ein !== undefined)           data.einEncrypted         = ein         ? encrypt(ein)         : null
  if (fein !== undefined)          data.feinEncrypted        = fein        ? encrypt(fein)        : null
  if (bankRouting !== undefined)   data.bankRoutingEncrypted = bankRouting ? encrypt(bankRouting) : null
  if (bankAccount !== undefined)   data.bankAccountEncrypted = bankAccount ? encrypt(bankAccount) : null
  if (dob !== undefined)           data.dob                  = dob         ? encrypt(dob)         : null
  if (npiNumber !== undefined)     data.npiNumber            = npiNumber   ? encrypt(npiNumber)   : null
  if (medicaidNumber !== undefined) data.medicaidNumber      = medicaidNumber ? encrypt(medicaidNumber) : null

  try {
    const updated = await prisma.nurseProfile.update({
      where: { id },
      data,
      select: { userId: true },
    })

    // If the form sent a new email address, update it on the User record
    if (userEmail && userEmail.trim()) {
      await prisma.user.update({
        where: { id: updated.userId },
        data: { email: userEmail.trim() },
      })
    }

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

  const profile = await prisma.nurseProfile.findUnique({
    where: { id },
    select: { userId: true, displayName: true, user: { select: { email: true, role: true } } },
  })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Send denial email only for pending access requests (role === 'provider')
  if (profile.user?.role === 'provider' && profile.user.email) {
    await sendAccessDeniedEmail({
      to: profile.user.email,
      displayName: profile.displayName || profile.user.email,
    }).catch(() => {})
  }

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
