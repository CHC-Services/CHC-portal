import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET/PATCH — the admin's own "notify me when a nurse claims part of an open
// shift" preference (User.notifyPartialShiftClaim). Interim testing toggle
// per the feature's own long-term plan of nurse+family-only notification —
// see lib/notificationCatalog.ts's partial-shift-* entries.
export async function GET(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await (prisma.user.findUnique as any)({ where: { id: session.id }, select: { notifyPartialShiftClaim: true } })
  return NextResponse.json({ notifyPartialShiftClaim: user?.notifyPartialShiftClaim ?? true })
}

export async function PATCH(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { notifyPartialShiftClaim } = await req.json()
  await (prisma.user.update as any)({
    where: { id: session.id },
    data: { notifyPartialShiftClaim: !!notifyPartialShiftClaim },
  })

  return NextResponse.json({ ok: true })
}
