import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { isPaidSubscriber } from '../../../../lib/planPermissions'
import { aggregateClaimIncome, aggregateNurseInvoiceExpense } from '../../../../lib/incomeReporting'

async function requirePaidNurse(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || !['nurse', 'provider'].includes(session.role) || !session.nurseProfileId) return null

  const profile = await (prisma.nurseProfile.findUnique as any)({
    where: { id: session.nurseProfileId },
    select: { planTier: true, trialExpiresAt: true, displayName: true },
  })
  if (!profile || !isPaidSubscriber(profile.planTier, profile.trialExpiresAt)) return null

  return { session, profile }
}

// GET — on-screen tax report data for a given year (?year=)
export async function GET(req: Request) {
  const ctx = await requirePaidNurse(req)
  if (!ctx) return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || '', 10) || new Date().getFullYear()

  const [claimIncome, expense] = await Promise.all([
    aggregateClaimIncome({ nurseId: ctx.session.nurseProfileId!, year }),
    aggregateNurseInvoiceExpense({ nurseId: ctx.session.nurseProfileId!, year }),
  ])

  return NextResponse.json({ year, claimIncome, expense, nurseName: ctx.profile.displayName })
}
