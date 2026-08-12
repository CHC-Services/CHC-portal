import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { PROFILE_CARD_KEYS } from '../../../../lib/profileCards'

const ROLES = ['nurse', 'admin', 'biller', 'provider', 'guardian']

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — the full card × role matrix, for the "User Profile Data" settings page
export async function GET(req: Request) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await (prisma.profileCardConfig.findMany as any)({})
  const byCardRole = new Map(rows.map((r: any) => [`${r.cardKey}:${r.role}`, r.enabled]))

  // Always return every cell, defaulting to false for any (cardKey, role)
  // combo not yet seeded — keeps the UI matrix complete even as new cards
  // or roles are added later without a fresh migration.
  const matrix = PROFILE_CARD_KEYS.map(cardKey => ({
    cardKey,
    roles: Object.fromEntries(ROLES.map(role => [role, byCardRole.get(`${cardKey}:${role}`) ?? false])),
  }))

  return NextResponse.json({ matrix })
}

// PATCH — toggle one (cardKey, role) cell (body: { cardKey, role, enabled })
export async function PATCH(req: Request) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardKey, role, enabled } = await req.json()
  if (!PROFILE_CARD_KEYS.includes(cardKey)) return NextResponse.json({ error: 'Invalid card' }, { status: 400 })
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  await (prisma.profileCardConfig.upsert as any)({
    where: { cardKey_role: { cardKey, role } },
    create: { cardKey, role, enabled: !!enabled },
    update: { enabled: !!enabled },
  })

  return NextResponse.json({ ok: true })
}
