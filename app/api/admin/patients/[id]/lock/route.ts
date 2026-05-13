import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// POST → lock the patient record
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const patient = await (prisma.patient.update as any)({
    where: { id },
    data: { isLocked: true, lockedBy: session.name, lockedAt: new Date() },
  })

  return NextResponse.json({ ok: true, patient })
}

// DELETE → unlock the patient record
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const patient = await (prisma.patient.update as any)({
    where: { id },
    data: { isLocked: false, lockedBy: null, lockedAt: null },
  })

  return NextResponse.json({ ok: true, patient })
}
