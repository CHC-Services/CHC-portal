import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canClaimOpenShift } from '../../../../../../lib/permissions'
import { generatePendingHoursForShift } from '../../../../../../lib/pendingHours'
import { reconcileNewShift } from '../../../../../../lib/shiftReconciliation'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const shift = await prisma.shift.findUnique({ where: { id } })
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canClaimOpenShift(session, shift))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Guard the claim in the WHERE clause (not just the permission check above)
  // so two nurses racing to claim the same open shift can't both succeed.
  const result = await prisma.shift.updateMany({
    where: { id, status: { in: ['open', 'coverage_needed'] }, nurseId: null },
    data: { nurseId: session.nurseProfileId, status: 'assigned' },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: 'This shift was already claimed' }, { status: 409 })
  }

  const updated = await prisma.shift.findUnique({ where: { id } })
  if (updated) {
    await generatePendingHoursForShift(updated, session.nurseProfileId)
    await reconcileNewShift(updated)
  }
  return NextResponse.json({ shift: updated })
}
