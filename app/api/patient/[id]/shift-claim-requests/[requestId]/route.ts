import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canCreateShift } from '../../../../../../lib/permissions'
import { finalizeShiftClaim } from '../../../../../../lib/shiftSplit'
import { notifyShiftPortionClaimed, notifyShiftPortionRejected } from '../../../../../../lib/shiftClaimNotify'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Approve or deny a pending partial-shift-claim request — only reached when
// the patient has partialShiftClaimsRequireApproval on (see
// app/api/nurse/shifts/[id]/claim-portion/route.ts). Same admin/guardian
// authority as originating/assigning shifts.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: patientId, requestId } = await params

  const request = await (prisma.shiftClaimRequest.findUnique as any)({
    where: { id: requestId },
    include: {
      nurse: { select: { displayName: true, firstName: true, lastName: true, user: { select: { email: true, phone: true } } } },
    },
  })
  if (!request || request.patientId !== patientId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canCreateShift(session, patientId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.status !== 'pending') return NextResponse.json({ error: 'This request was already resolved.' }, { status: 409 })

  const body = await req.json()
  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true } })
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : ''
  const nurseName = request.nurse.lastName ? `${request.nurse.firstName} ${request.nurse.lastName}` : (request.nurse.displayName || 'A nurse')
  const nurseEmail = request.nurse.user?.email || null
  const nursePhone = request.nurse.user?.phone || null

  if (body.action === 'reject') {
    await (prisma.shiftClaimRequest.update as any)({
      where: { id: requestId },
      data: { status: 'rejected', resolvedAt: new Date(), resolvedByUserId: session.id },
    })
    await notifyShiftPortionRejected({
      nurseName, nurseEmail, nursePhone, patientName,
      requestedStart: request.requestedStart, requestedEnd: request.requestedEnd,
    })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  // Re-validate against the shift's *current* state — it may have changed
  // since the request was made (e.g. an overlapping request was approved
  // first), so this can still fail even though it passed at request time.
  const result = await finalizeShiftClaim(request.shiftId, request.requestedStart, request.requestedEnd, request.nurseId)
  if ('error' in result) {
    await (prisma.shiftClaimRequest.update as any)({
      where: { id: requestId },
      data: { status: 'rejected', resolvedAt: new Date(), resolvedByUserId: session.id },
    })
    await notifyShiftPortionRejected({
      nurseName, nurseEmail, nursePhone, patientName,
      requestedStart: request.requestedStart, requestedEnd: request.requestedEnd,
      reason: 'This time is no longer available — someone else already covered part or all of it.',
    })
    return NextResponse.json({ error: result.error }, { status: 409 })
  }

  await (prisma.shiftClaimRequest.update as any)({
    where: { id: requestId },
    data: { status: 'approved', resolvedAt: new Date(), resolvedByUserId: session.id },
  })
  await notifyShiftPortionClaimed({
    patientId, patientName, nurseName, nurseEmail, nursePhone,
    claimedStart: request.requestedStart,
    claimedEnd: request.requestedEnd,
    remainingOpenRanges: result.leftovers.map((l: any) => ({ start: l.startTime, end: l.endTime })),
  })

  return NextResponse.json({ ok: true, status: 'approved', shift: result.claimed, leftovers: result.leftovers })
}
