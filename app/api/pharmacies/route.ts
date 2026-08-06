import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyToken } from '../../../lib/auth'

// GET — full pharmacy list for client-side autocomplete filtering.
// Open to any authenticated nurse/admin/guardian — pharmacy contact info
// isn't sensitive, and all three roles enter/view medications.
export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || !['nurse', 'admin', 'guardian'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pharmacies = await (prisma.pharmacy.findMany as any)({
    select: { id: true, name: true, address: true, phone: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(pharmacies)
}
