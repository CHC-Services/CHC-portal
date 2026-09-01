import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'
import { flattenMedication } from '../../../../../../../lib/pharmacyLookup'

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

// PATCH — confirm a refill (body: { medId, refillDate, daySupply?, skipCount? })
// — resets the reminder cycle and decrements refillsRemaining if it's being
// tracked. skipCount: true resets the window the same way but leaves
// refillsRemaining untouched — for "enough on hand, no need to reorder this
// cycle" instead of an actual pharmacy refill.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await verifyLinked(session.nurseProfileId!, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { medId, refillDate, daySupply, skipCount } = await req.json()
  if (!medId || !refillDate) return NextResponse.json({ error: 'medId and refillDate required' }, { status: 400 })

  const existing = await (prisma.patientMedication.findUnique as any)({
    where: { id: medId },
    select: { patientId: true, refillsRemaining: true, daySupply: true },
  })
  if (!existing || existing.patientId !== id) {
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
