import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Every note this nurse has ever authored, across every patient, regardless
// of whether she's still linked to that patient's case — the personal
// archive that makes her own past documentation reachable for billing/
// record purposes even after being taken off a case. Deliberately does NOT
// grant access to a patient's other notes or full chart — see
// app/api/nurse/progress-notes/[id]/route.ts's own-authorship exception,
// which is what actually lets each of these links open.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const notes = await prisma.progressNote.findMany({
    where: { authorUserId: session.id },
    select: {
      id: true,
      serviceDate: true,
      signedAt: true,
      voidedAt: true,
      patientId: true,
      patient: { select: { firstName: true, lastName: true, accountNumber: true } },
    },
    orderBy: { serviceDate: 'desc' },
  })

  const patientIds = [...new Set(notes.map(n => n.patientId))]
  const activeLinks = await prisma.nursePatient.findMany({
    where: { nurseId: session.nurseProfileId, patientId: { in: patientIds }, isActive: true },
    select: { patientId: true },
  })
  const activePatientIds = new Set(activeLinks.map(l => l.patientId))

  return NextResponse.json({
    notes: notes.map(n => ({
      id: n.id,
      serviceDate: n.serviceDate,
      signedAt: n.signedAt,
      voidedAt: n.voidedAt,
      patientId: n.patientId,
      patientName: `${n.patient.firstName} ${n.patient.lastName}`,
      patientAccountNumber: n.patient.accountNumber,
      activeCase: activePatientIds.has(n.patientId),
    })),
  })
}
