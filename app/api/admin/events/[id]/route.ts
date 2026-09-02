import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { easternMidnightUtc, easternTimeOfDayUtc } from '../../../../../lib/easternTime'

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function resolveEventDate(dateKeyStr: string, allDay: boolean, eventTime: string | undefined | null): Date | null {
  if (!DATE_KEY_RE.test(dateKeyStr)) return null
  if (allDay) return easternMidnightUtc(dateKeyStr)
  const match = eventTime ? TIME_RE.exec(eventTime) : null
  if (!match) return null
  return easternTimeOfDayUtc(dateKeyStr, Number(match[1]), Number(match[2]))
}

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// PATCH — edit an existing global event (body: { title, description, eventDate, allDay, eventTime, category, targetRoles, recurrence })
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await (prisma.globalEvent as any).findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { title, description, eventDate, allDay, eventTime, category, targetRoles, recurrence } = await req.json()
  if (!title || !eventDate) return NextResponse.json({ error: 'Title and date required' }, { status: 400 })

  const resolvedDate = resolveEventDate(eventDate, allDay !== false, eventTime)
  if (!resolvedDate) {
    return NextResponse.json({ error: allDay === false ? 'A valid time is required for a timed event' : 'A valid date is required' }, { status: 400 })
  }

  const event = await (prisma.globalEvent as any).update({
    where: { id },
    data: {
      title,
      description: description || null,
      eventDate: resolvedDate,
      allDay: allDay !== false,
      category: category || 'general',
      targetRoles: targetRoles || [],
      recurrence: recurrence || null,
    },
  })

  return NextResponse.json(event)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await (prisma.globalEvent as any).delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
