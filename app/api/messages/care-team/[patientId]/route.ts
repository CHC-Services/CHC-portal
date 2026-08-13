import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { formalName } from '../../../../../lib/formatName'
import { messagingAuth } from '../../../../../lib/messaging'

// GET — recipient candidates for "message this patient's care team":
// everyone currently linked to the patient (active nurses/providers +
// guardians), excluding the requester. Admins have blanket access to every
// patient and are intentionally not listed here, mirroring PatientCareTeam.tsx.
export async function GET(req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const session = messagingAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { patientId } = await params

  if (session.role === 'nurse' || session.role === 'provider') {
    const link = await prisma.nursePatient.findUnique({
      where: { nurseId_patientId: { nurseId: session.nurseProfileId!, patientId } },
      select: { isActive: true },
    })
    if (!link?.isActive) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else if (session.role === 'guardian') {
    const link = await prisma.guardianPatient.findUnique({
      where: { userId_patientId: { userId: session.id, patientId } },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [nurseLinks, guardianLinks] = await Promise.all([
    prisma.nursePatient.findMany({
      where: { patientId, isActive: true },
      include: { nurse: { select: { userId: true, displayName: true, firstName: true, lastName: true } } },
    }),
    prisma.guardianPatient.findMany({
      where: { patientId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ])

  const recipients = [
    ...nurseLinks.map(l => ({ id: l.nurse.userId, name: formalName(l.nurse) || l.nurse.displayName })),
    ...guardianLinks.map(l => ({ id: l.user.id, name: l.user.name })),
  ].filter(r => r.id !== session.id)

  return NextResponse.json({ recipients })
}
