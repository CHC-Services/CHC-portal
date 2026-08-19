import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canEditShift } from '../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// A nurse editing their own shift — notes and marking it completed.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const shift = await prisma.shift.findUnique({ where: { id } })
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditShift(session, shift))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, any> = {}
  if ('notes' in body) data.notes = body.notes || null
  if ('status' in body && ['completed', 'cancelled'].includes(body.status)) data.status = body.status

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await prisma.shift.update({ where: { id }, data })
  return NextResponse.json({ shift: updated })
}
