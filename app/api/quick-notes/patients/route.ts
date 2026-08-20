import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../lib/nurseQuickAccess'

// This nurse's active patients — initials only, nothing else (no DOB,
// insurance, account number). Just enough to pick the right patient.
export async function GET(req: Request) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const links = await prisma.nursePatient.findMany({
    where: { nurseId: identity.nurseId, isActive: true },
    select: { patient: { select: { id: true, firstName: true, lastName: true } } },
  })

  const patients = links.map(l => ({
    id: l.patient.id,
    label: `${l.patient.firstName[0]}. ${l.patient.lastName.slice(0, 5)}`,
  }))

  return NextResponse.json({ patients })
}
