import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'guardian') return null
  return session
}

// GET — the guardian's linked patients, for the myPatients list
export async function GET(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const links = await (prisma.guardianPatient.findMany as any)({
    where: { userId: session.id },
    include: { patient: true },
  })

  const patients = links.map((l: any) => l.patient)
  return NextResponse.json({ patients })
}
