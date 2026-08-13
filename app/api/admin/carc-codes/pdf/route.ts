import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'
import { getOrCreateCarcCodesPdf } from '../../../../../lib/carcPdf'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST — admin: force-regenerate the CARC list PDF (e.g. after re-importing
// codes from X12) and return the stable public link to paste into an FAQ item.
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await getOrCreateCarcCodesPdf({ forceRegenerate: true })
  return NextResponse.json({ ok: true, link: '/api/faq/resources/carc-codes' })
}

// GET — admin: same stable link, without forcing a regenerate (for the "copy
// this into your FAQ item" UI to just display the link).
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ link: '/api/faq/resources/carc-codes' })
}
