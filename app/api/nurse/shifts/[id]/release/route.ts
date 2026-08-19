import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canReleaseShift } from '../../../../../../lib/permissions'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// A nurse releasing a shift they can no longer work — returns it to
// coverage_needed for another linked nurse to claim.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const shift = await prisma.shift.findUnique({ where: { id } })
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canReleaseShift(session, shift))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.shift.update({
    where: { id },
    data: { nurseId: null, status: 'coverage_needed' },
  })
  return NextResponse.json({ shift: updated })
}
