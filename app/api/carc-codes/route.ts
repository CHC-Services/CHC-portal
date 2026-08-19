import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyToken } from '../../../lib/auth'
import { sortByCarcCode } from '../../../lib/carcSort'

// GET — CARC (Claim Adjustment Reason Code) lookup, by exact code, code
// prefix, or description text. Open to any authenticated nurse/admin — both
// roles work claims/EOBs and need to look up what a code on a remittance means.
export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || !['nurse', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() || ''
  if (q.length < 1) return NextResponse.json([])

  const LIMIT = 50

  // Code matches (exact or prefix) take priority over description-text matches —
  // with ~1,600 codes in the reference table, a broad word like "claim" can match
  // hundreds of descriptions and would otherwise bury the specific code someone
  // actually searched for once a single result set got cut off at the limit.
  const codeMatches = await (prisma.carcCode.findMany as any)({
    where: {
      OR: [
        { code: { equals: q, mode: 'insensitive' } },
        { code: { startsWith: q, mode: 'insensitive' } },
      ],
    },
    take: LIMIT,
  })

  let codes = codeMatches
  if (codes.length < LIMIT) {
    const excludeIds = codes.map((c: any) => c.id)
    const descMatches = await (prisma.carcCode.findMany as any)({
      where: {
        id: { notIn: excludeIds },
        description: { contains: q, mode: 'insensitive' },
      },
      take: LIMIT - codes.length,
    })
    codes = [...codes, ...descMatches]
  }

  const active = sortByCarcCode(codes.filter((c: any) => c.active))
  const inactive = sortByCarcCode(codes.filter((c: any) => !c.active))
  return NextResponse.json([...active, ...inactive])
}
