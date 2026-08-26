import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'guardian') return null
  return session
}

// PATCH — approve or deny a pending guardian's request for access to a
// patient this guardian is themselves already approved on. body: { pendingUserId, approve }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const myLink = await (prisma.guardianPatient.findUnique as any)({
    where: { userId_patientId: { userId: session.id, patientId: id } },
  })
  if (!myLink?.approvedAt) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { pendingUserId, approve } = await req.json()
  if (!pendingUserId) return NextResponse.json({ error: 'pendingUserId required' }, { status: 400 })

  const pendingLink = await (prisma.guardianPatient.findUnique as any)({
    where: { userId_patientId: { userId: pendingUserId, patientId: id } },
  })
  if (!pendingLink || pendingLink.approvedAt) return NextResponse.json({ error: 'No pending request found' }, { status: 404 })

  if (approve) {
    await (prisma.guardianPatient.update as any)({
      where: { userId_patientId: { userId: pendingUserId, patientId: id } },
      data: { approvedAt: new Date(), approvedByUserId: session.id },
    })
  } else {
    await (prisma.guardianPatient.delete as any)({
      where: { userId_patientId: { userId: pendingUserId, patientId: id } },
    })
  }

  return NextResponse.json({ ok: true })
}
