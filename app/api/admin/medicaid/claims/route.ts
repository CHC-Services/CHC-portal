import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function GET(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const nurseId = searchParams.get('nurseId') || undefined

  const claims = await (prisma.medicaidClaim.findMany as any)({
    where: nurseId ? { nurseId } : {},
    include: { nurse: { select: { displayName: true, isDemo: true } } },
    orderBy: { dosStart: 'desc' },
  })

  return NextResponse.json(claims)
}

// POST intentionally removed — MedicaidClaim's own creation flow was
// superseded when Medicaid tracking was unified into the Claim model (see
// app/admin/claims/page.tsx's single "Add Claim" form). This route stayed
// live after that migration with no UI pointing at it, which is how a
// duplicate claim (LOGAN041326B, present in both tables) got created — a
// stale client hitting this endpoint directly. GET/PATCH/void on existing
// rows are preserved so the 4 legacy rows can still be reviewed and migrated;
// creating new ones here is no longer a supported path.
