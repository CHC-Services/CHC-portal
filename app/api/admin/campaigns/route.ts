import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { enrollments: { where: { active: true } } } },
    },
  })

  return NextResponse.json(campaigns)
}

export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, description, type, flatAmtPerDos, weeklyMaxAmt, percentOff, startDate, weekCount, promoSlug } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
  }
  if (type === 'flat_per_dos' && !flatAmtPerDos) {
    return NextResponse.json({ error: 'flatAmtPerDos required for flat_per_dos type' }, { status: 400 })
  }
  if (type === 'percent_off' && !percentOff) {
    return NextResponse.json({ error: 'percentOff required for percent_off type' }, { status: 400 })
  }

  const campaign = await prisma.campaign.create({
    data: {
      name,
      description: description || null,
      type,
      flatAmtPerDos: flatAmtPerDos ?? null,
      weeklyMaxAmt: weeklyMaxAmt ?? null,
      percentOff: percentOff ?? null,
      startDate: startDate ? new Date(startDate) : null,
      weekCount: weekCount ?? null,
      promoSlug: promoSlug?.trim() || null,
      active: true,
    },
  })

  return NextResponse.json(campaign)
}
