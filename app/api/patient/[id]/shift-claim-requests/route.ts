import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canCreateShift } from '../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Pending partial-shift-claim requests for one patient — powers the "Pending
// Shift Requests" panel in PatientSchedule.tsx (admin/guardian only, same
// authority as originating shifts in the first place).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId } = await params

  if (!(await canCreateShift(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const requests = await (prisma.shiftClaimRequest.findMany as any)({
    where: { patientId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
    include: {
      nurse: { select: { id: true, displayName: true, firstName: true, lastName: true } },
      shift: { select: { startTime: true, endTime: true } },
    },
  })

  return NextResponse.json({ requests })
}
