import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { messagingAuth } from '../../../../lib/messaging'
import { formalName } from '../../../../lib/formatName'

// GET — every messageable user on the platform, name only (no email/phone).
// Billers are excluded — no biller portal exists to read a reply from.
export async function GET(req: Request) {
  const session = messagingAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = await prisma.user.findMany({
    where: { role: { not: 'biller' }, id: { not: session.id } },
    select: {
      id: true,
      name: true,
      role: true,
      nurseProfile: { select: { displayName: true, firstName: true, lastName: true } },
    },
    orderBy: { name: 'asc' },
  })

  const directory = users.map(u => ({
    id: u.id,
    role: u.role,
    name: u.nurseProfile ? (formalName(u.nurseProfile) || u.name) : u.name,
  }))

  return NextResponse.json({ directory })
}
