import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// PATCH — confirm a refill (body: { medId, refillDate })
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { medId, refillDate } = await req.json()
  if (!medId || !refillDate) return NextResponse.json({ error: 'medId and refillDate required' }, { status: 400 })

  const existing = await (prisma.patientMedication.findUnique as any)({
    where: { id: medId },
    select: { patientId: true, refillsRemaining: true },
  })
  if (!existing || existing.patientId !== id) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
  }

  const medication = await (prisma.patientMedication.update as any)({
    where: { id: medId },
    data: {
      lastFillDate: new Date(refillDate),
      reminderSentAt: null,
      refillsRemaining: existing.refillsRemaining != null ? Math.max(0, existing.refillsRemaining - 1) : null,
    },
  })

  return NextResponse.json({ ok: true, medication })
}
