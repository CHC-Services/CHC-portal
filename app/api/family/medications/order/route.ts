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

// PATCH — mark a refill as ordered (body: { medId, orderedDate }) — silences
// the reminder for this cycle so every viewer on the account sees "Ordered"
// instead of duplicate refill requests going out.
export async function PATCH(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { medId, orderedDate } = await req.json()
  if (!medId || !orderedDate) return NextResponse.json({ error: 'medId and orderedDate required' }, { status: 400 })

  const existing = await (prisma.patientMedication.findUnique as any)({
    where: { id: medId },
    select: { patientId: true },
  })
  if (!existing || !await verifyGuardianLinked(session.id, existing.patientId)) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 })
  }

  const medication = await (prisma.patientMedication.update as any)({
    where: { id: medId },
    data: {
      refillOrderedAt: new Date(orderedDate),
      refillOrderedByUserId: session.id,
      refillOrderedByRole: session.role,
      reminderSentAt: new Date(),
    },
    include: { pharmacy: true },
  })

  return NextResponse.json({ ok: true, medication: flattenMedication(medication) })
}
