import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET — list all reminders for the logged-in nurse
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session?.nurseProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reminders = await (prisma.nurseReminder as any).findMany({
    where: { nurseId: session.nurseProfileId },
    orderBy: { dueDate: 'asc' },
  })

  return NextResponse.json(reminders)
}

// POST — create a new reminder
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session?.nurseProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, category, dueDate, notes } = await req.json()
  if (!title || !dueDate) return NextResponse.json({ error: 'Title and due date are required' }, { status: 400 })

  const reminder = await (prisma.nurseReminder as any).create({
    data: {
      nurseId: session.nurseProfileId,
      title,
      category: category || 'general',
      dueDate: new Date(dueDate),
      notes: notes || null,
    },
  })

  return NextResponse.json(reminder)
}
