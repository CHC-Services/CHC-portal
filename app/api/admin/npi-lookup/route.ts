import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth'

function adminOrNurse(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/admin/npi-lookup?npi=1234567890
// Proxies NPPES NPI Registry (public API) and returns normalized fields.
export async function GET(req: Request) {
  const session = adminOrNurse(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const npi = url.searchParams.get('npi')?.trim().replace(/\D/g, '')

  if (!npi || npi.length !== 10) {
    return NextResponse.json({ error: 'A 10-digit NPI is required' }, { status: 400 })
  }

  try {
    const npesRes = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } }
    )

    if (!npesRes.ok) {
      return NextResponse.json({ error: 'NPPES registry unreachable' }, { status: 502 })
    }

    const data = await npesRes.json()
    const results: any[] = data.results || []

    if (results.length === 0) {
      return NextResponse.json({ found: false, message: 'No NPI record found' })
    }

    const r = results[0]
    const enumType: string = r.enumeration_type || '' // 'NPI-1' | 'NPI-2'
    const npiType = enumType === 'NPI-2' ? 'Type2' : enumType === 'NPI-1' ? 'Type1' : null

    // Entity / provider name
    let entityName: string | null = null
    if (enumType === 'NPI-2') {
      entityName = r.basic?.organization_name || null
    } else if (enumType === 'NPI-1') {
      const first = r.basic?.first_name || ''
      const last  = r.basic?.last_name  || ''
      entityName  = [first, last].filter(Boolean).join(' ') || null
    }

    // Prefer the practice/location address; fall back to mailing
    const addresses: any[] = r.addresses || []
    const locationAddr = addresses.find((a: any) => a.address_purpose === 'LOCATION')
      ?? addresses.find((a: any) => a.address_purpose === 'MAILING')
      ?? addresses[0]
      ?? null

    let address: string | null = null
    let city: string | null = null
    let state: string | null = null
    let zip: string | null = null

    if (locationAddr) {
      const parts = [locationAddr.address_1, locationAddr.address_2].filter(Boolean)
      address = parts.join(', ') || null
      city    = locationAddr.city        || null
      state   = locationAddr.state       || null
      zip     = (locationAddr.postal_code || '').slice(0, 5) || null
    }

    return NextResponse.json({
      found: true,
      npiType,
      entityName,
      address,
      city,
      state,
      zip,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach NPPES registry' }, { status: 502 })
  }
}
