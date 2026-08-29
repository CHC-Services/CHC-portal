import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Every TimeEntry not yet attached to an invoice, across every nurse — the
// cross-nurse "what's outstanding" view the per-nurse-profile invoice screen
// (app/admin/nurse/[id]/page.tsx) never offered, since it only ever showed
// one nurse at a time. Includes entries that aren't billed yet too (no claim
// submitted) so admin can see the full gap, not just what's invoiceable right
// now — the UI distinguishes them via each row's `billed` flag.
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const entries = await prisma.timeEntry.findMany({
    where: { invoiceId: null },
    orderBy: { workDate: 'asc' },
    include: {
      nurse: { select: { id: true, firstName: true, lastName: true, displayName: true, accountNumber: true } },
      patient: { select: { firstName: true, lastName: true, accountNumber: true } },
    },
  })

  return NextResponse.json(entries)
}
