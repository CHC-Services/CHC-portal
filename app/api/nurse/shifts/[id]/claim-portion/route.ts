import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canClaimOpenShift } from '../../../../../../lib/permissions'
import { computeShiftSplit, finalizeShiftClaim } from '../../../../../../lib/shiftSplit'
import { notifyShiftPortionClaimed, notifyShiftPortionRequested } from '../../../../../../lib/shiftClaimNotify'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Covering only part of an open shift — sibling to claim/release. Whether
// this finalizes immediately or sits pending depends entirely on the
// patient's own Patient.partialShiftClaimsRequireApproval flag; covering
// the *entire* shift (claim/route.ts) is unaffected either way.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: shiftId } = await params
  const { start, end } = await req.json()
  if (!start || !end) return NextResponse.json({ error: 'start and end are required' }, { status: 400 })

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canClaimOpenShift(session, shift))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const claimedStart = new Date(start)
  const claimedEnd = new Date(end)
  const split = computeShiftSplit(shift, claimedStart, claimedEnd)
  if ('error' in split) return NextResponse.json({ error: split.error }, { status: 400 })

  const [patient, nurse] = await Promise.all([
    prisma.patient.findUnique({ where: { id: shift.patientId }, select: { firstName: true, lastName: true, partialShiftClaimsRequireApproval: true } }),
    (prisma.nurseProfile.findUnique as any)({
      where: { id: session.nurseProfileId },
      select: { displayName: true, firstName: true, lastName: true, user: { select: { email: true, phone: true } } },
    }),
  ])
  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patientName = `${patient.firstName} ${patient.lastName}`.trim()
  const nurseName = nurse?.lastName ? `${nurse.firstName} ${nurse.lastName}` : (nurse?.displayName || 'A nurse')

  if (patient.partialShiftClaimsRequireApproval) {
    const request = await (prisma.shiftClaimRequest.create as any)({
      data: {
        id: crypto.randomUUID(),
        shiftId,
        nurseId: session.nurseProfileId,
        patientId: shift.patientId,
        requestedStart: claimedStart,
        requestedEnd: claimedEnd,
      },
    })
    await notifyShiftPortionRequested({
      patientId: shift.patientId,
      patientName,
      nurseName,
      requestedStart: claimedStart,
      requestedEnd: claimedEnd,
    })
    return NextResponse.json({ pending: true, request })
  }

  const result = await finalizeShiftClaim(shiftId, claimedStart, claimedEnd, session.nurseProfileId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 })

  await notifyShiftPortionClaimed({
    patientId: shift.patientId,
    patientName,
    nurseName,
    nurseEmail: nurse?.user?.email || null,
    nursePhone: nurse?.user?.phone || null,
    claimedStart,
    claimedEnd,
    remainingOpenRanges: result.leftovers.map((l: any) => ({ start: l.startTime, end: l.endTime })),
  })

  return NextResponse.json({ pending: false, shift: result.claimed, leftovers: result.leftovers })
}
