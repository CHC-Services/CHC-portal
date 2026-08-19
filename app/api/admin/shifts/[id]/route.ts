import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const data: Record<string, any> = {}
  if ('nurseId' in body) data.nurseId = body.nurseId || null
  if ('startTime' in body) data.startTime = new Date(body.startTime)
  if ('endTime' in body) data.endTime = new Date(body.endTime)
  if ('status' in body) data.status = body.status
  if ('notes' in body) data.notes = body.notes || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Integrity check, not an authorization check: whoever is being assigned
  // must actually be an authorized (active) nurse for this patient.
  if (data.nurseId) {
    const existing = await prisma.shift.findUnique({ where: { id }, select: { patientId: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const link = await prisma.nursePatient.findUnique({
      where: { nurseId_patientId: { nurseId: data.nurseId, patientId: existing.patientId } },
    })
    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'That nurse is not authorized for this patient' }, { status: 400 })
    }
  }

  const shift = await prisma.shift.update({ where: { id }, data }).catch(() => null)
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ shift })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const shift = await prisma.shift.update({ where: { id }, data: { status: 'cancelled' } }).catch(() => null)
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
