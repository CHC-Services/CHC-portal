import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()

  // Global events — filter to those targeting this user's role (or visible to all)
  const globalEvents = await (prisma.globalEvent as any).findMany({
    where: { eventDate: { gte: now } },
    orderBy: { eventDate: 'asc' },
  })
  const visible = globalEvents.filter((e: any) =>
    e.targetRoles.length === 0 || e.targetRoles.includes(session.role)
  )

  // Personal reminders (nurses only)
  let personalReminders: any[] = []
  if (session.nurseProfileId) {
    personalReminders = await (prisma.nurseReminder as any).findMany({
      where: { nurseId: session.nurseProfileId, completed: false, dueDate: { gte: now } },
      orderBy: { dueDate: 'asc' },
    })
  }

  return NextResponse.json({ globalEvents: visible, personalReminders })
}
