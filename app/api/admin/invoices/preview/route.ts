import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { calcCampaignDiscount, campaignRuleLabel, campaignWindowLabel } from '../../../../../lib/campaignDiscount'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/admin/invoices/preview?nurseId=xxx
// Returns active campaign + auto-calculated discount for flagged entries
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const nurseId = url.searchParams.get('nurseId')
  if (!nurseId) return NextResponse.json({ error: 'nurseId required' }, { status: 400 })

  const entries = await prisma.timeEntry.findMany({
    where: { nurseId, readyToInvoice: true, invoiceId: null },
    orderBy: { workDate: 'asc' },
  })

  const enrollment = await prisma.campaignEnrollment.findFirst({
    where: { nurseId, active: true },
    include: { campaign: true },
  })

  const grossAmount = entries.reduce((s, e) => s + (e.invoiceFeeAmt ?? 0), 0)

  if (!enrollment) {
    return NextResponse.json({ grossAmount, discountAmt: 0, totalAmount: grossAmount, enrollment: null, weekBreakdown: [] })
  }

  const { campaign } = enrollment
  const result = calcCampaignDiscount(campaign, entries)

  return NextResponse.json({
    ...result,
    enrollment: {
      id: enrollment.id,
      campaignId: campaign.id,
      campaignName: campaign.name,
      ruleLabel: campaignRuleLabel(campaign),
      windowLabel: campaignWindowLabel(campaign),
    },
  })
}
