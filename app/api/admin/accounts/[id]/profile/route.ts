import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../../lib/auth'
import { getVisibleCards } from '../../../../../../lib/profileCards'
import { getOrCreateProfileByUserId, decryptProfileCardData, buildProfileUpdates } from '../../../../../../lib/profileCardData'
import { prisma } from '../../../../../../lib/prisma'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — admin viewing any account's profile cards (adAccounts click-through
// destination for admin/guardian/biller rows). Lazily creates a NurseProfile
// row for the target account on first visit, same as the self-service routes.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const targetUser = await (prisma.user.findUnique as any)({
    where: { id },
    select: { id: true, name: true, email: true, role: true, deactivatedAt: true },
  })
  if (!targetUser) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const profile = await getOrCreateProfileByUserId(id, targetUser.name || 'User')
  const visibleCards = await getVisibleCards(targetUser.role)

  return NextResponse.json({
    user: { id: targetUser.id, name: targetUser.name, email: targetUser.email, role: targetUser.role, deactivatedAt: targetUser.deactivatedAt },
    profile: decryptProfileCardData(profile),
    visibleCards,
  })
}

// PATCH — admin editing any account's profile card fields
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const targetUser = await (prisma.user.findUnique as any)({ where: { id }, select: { id: true, name: true } })
  if (!targetUser) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const body = await req.json()
  const updates = buildProfileUpdates(body)
  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  await getOrCreateProfileByUserId(id, targetUser.name || 'User')
  await (prisma.nurseProfile.update as any)({ where: { userId: id }, data: updates })

  return NextResponse.json({ ok: true })
}
