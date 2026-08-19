import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// The full custom medical-term dictionary, for lib/spellcheckClient.ts to
// merge into the base English Hunspell dictionary client-side. Open to any
// authenticated nurse/admin — non-PHI reference data, same gate as
// /api/carc-codes.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || !['nurse', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const terms = await prisma.spellcheckTerm.findMany({ select: { term: true } })
  return NextResponse.json({ terms: terms.map(t => t.term) })
}

// "Add to Dictionary" — a nurse teaching the checker a term it doesn't know.
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || !['nurse', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { term } = await req.json()
  const cleaned = typeof term === 'string' ? term.trim().toLowerCase() : ''
  if (!cleaned) return NextResponse.json({ error: 'term required' }, { status: 400 })

  await prisma.spellcheckTerm.upsert({
    where: { term: cleaned },
    update: {},
    create: { term: cleaned, source: 'nurse-added', addedByUserId: session.id },
  })

  return NextResponse.json({ ok: true })
}
