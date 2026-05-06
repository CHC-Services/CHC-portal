import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { getEffectiveTier } from '../../../../lib/planPermissions'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await (prisma.nurseProfile.findUnique as any)({
    where: { id: session.nurseProfileId },
    select: { planTier: true, trialExpiresAt: true },
  })

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const effectiveTier = getEffectiveTier(profile.planTier, profile.trialExpiresAt)
  const isTrialing = profile.planTier === 'BASIC' && !!profile.trialExpiresAt && new Date() <= new Date(profile.trialExpiresAt)

  return NextResponse.json({ effectiveTier, isTrialing, trialExpiresAt: profile.trialExpiresAt })
}
