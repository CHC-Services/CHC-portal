import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth'
import { getDrugFacts, resolveRxcuiByName } from '../../../../lib/drugFacts'

// GET — patient-friendly drug facts (MedlinePlus Connect), same auth as /api/drugs/search.
export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || !['nurse', 'admin', 'guardian'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URL(req.url).searchParams
  let rxcui = params.get('rxcui')?.trim() || ''
  const name = params.get('name')?.trim() || ''

  if (!rxcui && name) {
    rxcui = (await resolveRxcuiByName(name)) || ''
  }
  if (!rxcui) return NextResponse.json({ facts: null })

  const facts = await getDrugFacts(rxcui)
  return NextResponse.json({ facts })
}
