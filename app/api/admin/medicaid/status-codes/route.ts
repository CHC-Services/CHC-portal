import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// Listing (with default-seeding) moved to /api/medicaid-status-codes, which
// nurses can also read — this route is admin-only mutation now.
export async function POST(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code, description, active, outcome } = await req.json()
  if (!code?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'code and description required' }, { status: 400 })
  }

  try {
    const record = await (prisma.medicaidStatusCode.create as any)({
      data: {
        code: code.trim().toUpperCase(),
        description: description.trim(),
        active: active !== false,
        outcome: outcome || null,
      },
    })
    return NextResponse.json(record, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Code already exists.' }, { status: 409 })
  }
}
