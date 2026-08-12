import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth'
import { getVisibleCards } from '../../../../lib/profileCards'
import { getOrCreateProfileByUserId, decryptProfileCardData, buildProfileUpdates } from '../../../../lib/profileCardData'
import { prisma } from '../../../../lib/prisma'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'guardian' ? session : null
}

// GET — the signed-in guardian's Demographics card (self-service). Lazily
// creates a NurseProfile row on first visit — guardians never got one at
// invite time (see app/api/nurse/patients/[id]/guardians/route.ts).
export async function GET(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await (prisma.user.findUnique as any)({ where: { id: session.id }, select: { name: true } })
  const profile = await getOrCreateProfileByUserId(session.id, user?.name || 'Family Member')
  const visibleCards = await getVisibleCards('guardian')

  return NextResponse.json({ profile: decryptProfileCardData(profile), visibleCards })
}

// PATCH — update the guardian's own profile card fields
export async function PATCH(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates = buildProfileUpdates(body)
  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  const user = await (prisma.user.findUnique as any)({ where: { id: session.id }, select: { name: true } })
  await getOrCreateProfileByUserId(session.id, user?.name || 'Family Member')
  await (prisma.nurseProfile.update as any)({ where: { userId: session.id }, data: updates })

  return NextResponse.json({ ok: true })
}
