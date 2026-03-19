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
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const events = await (prisma.globalEvent as any).findMany({ orderBy: { eventDate: 'asc' } })
  return NextResponse.json(events)
}

export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description, eventDate, category, targetRoles, recurrence } = await req.json()
  if (!title || !eventDate) return NextResponse.json({ error: 'Title and date required' }, { status: 400 })

  const event = await (prisma.globalEvent as any).create({
    data: {
      title,
      description: description || null,
      eventDate: new Date(eventDate),
      category: category || 'general',
      targetRoles: targetRoles || [],
      recurrence: recurrence || null,
      createdBy: session.id,
    },
  })

  return NextResponse.json(event)
}
