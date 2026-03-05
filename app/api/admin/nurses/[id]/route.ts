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
    ssn, ein, fein, bankRouting, bankAccount,
    ssnEncrypted, einEncrypted, feinEncrypted,
    bankRoutingEncrypted, bankAccountEncrypted,
    ...rest
  } = body

  const data: Record<string, unknown> = { ...rest }

  if (ssn !== undefined)         data.ssnEncrypted         = ssn         ? encrypt(ssn)         : null
  if (ein !== undefined)         data.einEncrypted         = ein         ? encrypt(ein)         : null
  if (fein !== undefined)        data.feinEncrypted        = fein        ? encrypt(fein)        : null
  if (bankRouting !== undefined) data.bankRoutingEncrypted = bankRouting ? encrypt(bankRouting) : null
  if (bankAccount !== undefined) data.bankAccountEncrypted = bankAccount ? encrypt(bankAccount) : null

  const updated = await prisma.nurseProfile.update({ where: { id }, data })

  return NextResponse.json({ ok: true })
}
