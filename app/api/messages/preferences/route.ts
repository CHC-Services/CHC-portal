import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { messagingAuth } from '../../../../lib/messaging'

// GET — the current user's own "email me on new message" preference.
export async function GET(req: Request) {
  const session = messagingAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { notifyNewMessage: true } })
  return NextResponse.json({ notifyNewMessage: user?.notifyNewMessage ?? true })
}

// PATCH — the current user's own "email me on new message" preference.
// Receiving messages themselves can't be opted out of — this only controls
// whether the nav badge shows a count (on) or a plain dot (off).
export async function PATCH(req: Request) {
  const session = messagingAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { notifyNewMessage } = await req.json()
  await prisma.user.update({
    where: { id: session.id },
    data: { notifyNewMessage: !!notifyNewMessage },
  })

  return NextResponse.json({ ok: true })
}
