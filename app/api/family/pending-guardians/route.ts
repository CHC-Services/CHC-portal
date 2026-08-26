import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'guardian') return null
  return session
}

// GET — pending guardian access requests for every patient this guardian is
// themselves already approved on. Powers the "Someone is requesting access…"
// card on the /family dashboard.
export async function GET(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const myApprovedLinks = await (prisma.guardianPatient.findMany as any)({
    where: { userId: session.id, approvedAt: { not: null } },
    select: { patientId: true },
  })
  const patientIds = myApprovedLinks.map((l: any) => l.patientId)
  if (patientIds.length === 0) return NextResponse.json({ requests: [] })

  const pending = await (prisma.guardianPatient.findMany as any)({
    where: { patientId: { in: patientIds }, approvedAt: null },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const requests = pending.map((l: any) => ({
    patientId: l.patient.id,
    patientName: `${l.patient.firstName} ${l.patient.lastName}`,
    pendingUserId: l.user.id,
    pendingUserName: l.user.name,
    pendingUserEmail: l.user.email,
    relationship: l.relationship,
    createdAt: l.createdAt,
  }))

  return NextResponse.json({ requests })
}
