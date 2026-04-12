import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET — list all claim reminders (incomplete ones first, sorted by due date)
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const reminders = await prisma.claimReminder.findMany({
    orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }],
  })
  return NextResponse.json(reminders)
}

// POST — create a new claim reminder
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { claimDbId, claimRef, nurseId, dueDate, reason } = await req.json()
  if (!claimDbId || !dueDate || !reason?.trim()) {
    return NextResponse.json({ error: 'claimDbId, dueDate, and reason are required' }, { status: 400 })
  }
  const reminder = await prisma.claimReminder.create({
    data: {
      claimDbId,
      claimRef: claimRef || null,
      nurseId: nurseId || null,
      dueDate: new Date(dueDate),
      reason: reason.trim(),
    },
  })
  return NextResponse.json(reminder, { status: 201 })
}

// PATCH — mark a reminder complete/incomplete
export async function PATCH(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id, completed } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const reminder = await prisma.claimReminder.update({
    where: { id },
    data: { completed: !!completed },
  })
  return NextResponse.json(reminder)
}

// DELETE — remove a reminder
export async function DELETE(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.claimReminder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
