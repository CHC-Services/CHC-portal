import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'

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

// PATCH — confirm a refill (body: { medId, refillDate }) — resets the reminder
// cycle and decrements refillsRemaining if it's being tracked.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
