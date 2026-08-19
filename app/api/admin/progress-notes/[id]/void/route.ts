import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canVoidProgressNote } from '../../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Marks a signed note voided without altering its content — mirrors Claim's
// voidedAt convention. Only valid on a signed note; voiding a draft makes no
// sense (the nurse owns draft cleanup via DELETE).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || !(await canVoidProgressNote(session))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const { reason } = await req.json()

  const note = await prisma.progressNote.findUnique({ where: { id } })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!note.signedAt) return NextResponse.json({ error: 'Only signed notes can be voided' }, { status: 400 })

  const voided = await prisma.progressNote.update({
    where: { id },
    data: { voidedAt: new Date(), voidedByUserId: session.id, voidReason: reason || null },
  })

  return NextResponse.json({ note: voided })
}
