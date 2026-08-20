import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../lib/nurseQuickAccess'

// This nurse's own DRAFT notes only — signed notes never appear here, that's
// the hard boundary that keeps this token from being able to read back a
// completed clinical record.
export async function GET(req: Request) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const drafts = await prisma.progressNote.findMany({
    where: { authorUserId: identity.userId, signedAt: null },
    select: {
      id: true,
      serviceDate: true,
      patient: { select: { firstName: true, lastName: true } },
    },
    orderBy: { serviceDate: 'desc' },
  })

  return NextResponse.json({
    drafts: drafts.map(d => ({
      id: d.id,
      serviceDate: d.serviceDate,
      patientLabel: `${d.patient.firstName[0]}. ${d.patient.lastName.slice(0, 5)}`,
    })),
  })
}
