import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      enrollments: {
        where: { active: true },
        include: { nurse: { select: { id: true, displayName: true } } },
      },
    },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { name, description, type, flatAmtPerDos, weeklyMaxAmt, percentOff, startDate, weekCount, promoSlug, active } = body

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(type !== undefined && { type }),
      ...(flatAmtPerDos !== undefined && { flatAmtPerDos }),
      ...(weeklyMaxAmt !== undefined && { weeklyMaxAmt }),
      ...(percentOff !== undefined && { percentOff }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(weekCount !== undefined && { weekCount }),
      ...(promoSlug !== undefined && { promoSlug: promoSlug?.trim() || null }),
      ...(active !== undefined && { active }),
    },
  })

  return NextResponse.json(campaign)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  await prisma.campaign.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
