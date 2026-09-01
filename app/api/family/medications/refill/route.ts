import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { flattenMedication } from '../../../../../lib/pharmacyLookup'

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

// PATCH — confirm a refill (body: { medId, refillDate, daySupply?, skipCount? }).
// skipCount: true resets the due-date window the same way a normal refill
// does (new lastFillDate, cleared reminder/order state) but leaves
// refillsRemaining untouched — for "there's enough on hand, no need to
// reorder this cycle" instead of an actual pharmacy refill.
export async function PATCH(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { medId, refillDate, daySupply, skipCount } = await req.json()
  if (!medId || !refillDate) return NextResponse.json({ error: 'medId and refillDate required' }, { status: 400 })

  const existing = await (prisma.patientMedication.findUnique as any)({
    where: { id: medId },
    select: { patientId: true, refillsRemaining: true, daySupply: true },
  })
  if (!existing || !await verifyGuardianLinked(session.id, existing.patientId)) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
  }

  const medication = await (prisma.patientMedication.update as any)({
    where: { id: medId },
    data: {
      lastFillDate: new Date(refillDate),
      daySupply: daySupply ? parseInt(daySupply, 10) : existing.daySupply,
      reminderSentAt: null,
      refillsRemaining: skipCount || existing.refillsRemaining == null ? existing.refillsRemaining : Math.max(0, existing.refillsRemaining - 1),
      refillOrderedAt: null,
      refillOrderedByUserId: null,
      refillOrderedByRole: null,
    },
    include: { pharmacy: true },
  })

  return NextResponse.json({ ok: true, medication: flattenMedication(medication) })
}
