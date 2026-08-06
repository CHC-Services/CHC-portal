import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// PATCH — edit a pharmacy's name/address/phone. Since medications join live to
// this record, the change is reflected everywhere it's referenced immediately.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { name, address, phone } = await req.json()
  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  }

  const pharmacy = await (prisma.pharmacy.update as any)({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(address !== undefined ? { address: address?.trim() || null } : {}),
      ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
    },
  })

  return NextResponse.json(pharmacy)
}

// DELETE — removes the pharmacy; linked medications keep their record with pharmacyId set to null
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  await (prisma.pharmacy.delete as any)({ where: { id } })

  return NextResponse.json({ ok: true })
}
