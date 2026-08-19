import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Nurse-added terms only — the seed list (10k+ rows) isn't meant to be
// browsed/managed here, just the small set nurses have taught the checker.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const terms = await prisma.spellcheckTerm.findMany({
    where: { source: 'nurse-added' },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ terms })
}
