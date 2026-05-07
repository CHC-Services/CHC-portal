import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function nurseSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/nurse/routed-forms — nurse's routed forms (all statuses)
export async function GET(req: Request) {
  const session = nurseSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nurse = await prisma.nurseProfile.findFirst({ where: { userId: session.id } })
  if (!nurse) return NextResponse.json({ forms: [] })

  const forms = await prisma.routedForm.findMany({
    where: { nurseId: nurse.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ forms })
}
