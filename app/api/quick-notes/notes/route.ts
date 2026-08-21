import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../lib/nurseQuickAccess'

// Start a new draft, authored by the token's nurse. patientId must be one of
// their own actively-linked patients — re-verified server-side, not trusted
// from the client picker.
export async function POST(req: Request) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patientId, serviceDate } = await req.json()
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

  const link = await prisma.nursePatient.findUnique({
    where: { nurseId_patientId: { nurseId: identity.nurseId, patientId } },
  })
  if (!link || !link.isActive) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const note = await prisma.progressNote.create({
    data: {
      patientId,
      authorUserId: identity.userId,
      authorRole: 'nurse',
      serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
    },
  })

  return NextResponse.json({ note })
}
