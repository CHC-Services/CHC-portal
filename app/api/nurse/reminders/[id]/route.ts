import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// PATCH — toggle completed or update a reminder
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session?.nurseProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const reminder = await (prisma.nurseReminder as any).updateMany({
    where: { id, nurseId: session.nurseProfileId },
    data: body,
  })

  return NextResponse.json(reminder)
}

// DELETE — remove a reminder
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session?.nurseProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await (prisma.nurseReminder as any).deleteMany({
    where: { id, nurseId: session.nurseProfileId },
  })

  return NextResponse.json({ ok: true })
}
