import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { messagingAuth } from '../../../../lib/messaging'

// GET — unread count for the current user's Inbox. The client decides
// whether to render this as a number or a plain dot based on the user's
// own notifyNewMessage preference — this endpoint always returns the true
// count regardless of that preference.
export async function GET(req: Request) {
  const session = messagingAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unreadCount = await prisma.messageRecipient.count({
    where: { userId: session.id, readAt: null, trashedAt: null },
  })

  return NextResponse.json({ unreadCount })
}
