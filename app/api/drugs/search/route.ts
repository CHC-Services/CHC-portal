import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth'
import { searchLocalDrugNames, searchLiveDrugNames, searchApproximateDrugNames, cacheDrugNames } from '../../../../lib/drugNameLookup'

// GET — drug-name typeahead. Open to any authenticated nurse/admin/guardian,
// same reasoning as /api/pharmacies: not sensitive data, all three roles enter medications.
export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || !['nurse', 'admin', 'guardian'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() || ''
  if (q.length < 2) return NextResponse.json({ exact: [], suggested: [] })

  const local = await searchLocalDrugNames(q)

  let exact = local
  if (local.length < 5 && q.length >= 3) {
    const live = await searchLiveDrugNames(q)
    exact = [...new Set([...local, ...live])].slice(0, 8)
    cacheDrugNames(live).catch(() => {})
  }

  let suggested: string[] = []
  if (exact.length === 0 && q.length >= 4) {
    suggested = await searchApproximateDrugNames(q)
  }

  return NextResponse.json({ exact, suggested })
}
