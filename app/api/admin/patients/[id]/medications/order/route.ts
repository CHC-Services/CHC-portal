import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'
import { flattenMedication } from '../../../../../../../lib/pharmacyLookup'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// PATCH — mark a refill as ordered (body: { medId, orderedDate }) — silences
// the reminder for this cycle so every viewer on the account sees "Ordered"
// instead of duplicate refill requests going out.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { medId, orderedDate } = await req.json()
  if (!medId || !orderedDate) return NextResponse.json({ error: 'medId and orderedDate required' }, { status: 400 })

  const existing = await (prisma.patientMedication.findUnique as any)({
    where: { id: medId },
    select: { patientId: true },
  })
  if (!existing || existing.patientId !== id) {
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
