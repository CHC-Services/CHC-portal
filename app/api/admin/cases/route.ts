import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cases = await prisma.homeCase.findMany({
    orderBy: { patientFirstName: 'asc' },
    include: {
      assignments: {
        include: { nurse: { select: { id: true, displayName: true, firstName: true, lastName: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })
  return NextResponse.json({ cases })
}

export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patientFirstName, notes } = await req.json()
  if (!patientFirstName?.trim()) return NextResponse.json({ error: 'patientFirstName is required' }, { status: 400 })

  const homeCase = await prisma.homeCase.create({
    data: { patientFirstName: patientFirstName.trim(), notes: notes || null },
  })
  return NextResponse.json({ ok: true, homeCase })
}
