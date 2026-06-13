import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'nurse') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { checkReceivedDate } = await req.json()

  if (!checkReceivedDate) {
    return NextResponse.json({ error: 'checkReceivedDate is required' }, { status: 400 })
  }

  const existing = await (prisma.claim.findUnique as any)({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  if (existing.nurseId !== session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (existing.claimStage !== 'Check Wait') {
    return NextResponse.json({ error: 'Claim is not in Check Wait status' }, { status: 400 })
  }

  const receivedDate = new Date(checkReceivedDate)
  if (isNaN(receivedDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const updated = await (prisma.claim.update as any)({
    where: { id },
    data: {
      checkReceivedDate: receivedDate,
      claimStage: 'Paid',
    },
  })

  return NextResponse.json({ ok: true, claim: updated })
}
