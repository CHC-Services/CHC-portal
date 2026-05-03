import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST — enroll a nurse in this campaign (body: { nurseId })
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: campaignId } = await params
  const { nurseId } = await req.json()
  if (!nurseId) return NextResponse.json({ error: 'nurseId required' }, { status: 400 })

  // Deactivate any existing active enrollment for this nurse in any campaign
  await prisma.campaignEnrollment.updateMany({
    where: { nurseId, active: true },
    data: { active: false },
  })

  // Upsert enrollment in this campaign
  const enrollment = await prisma.campaignEnrollment.upsert({
    where: { nurseId_campaignId: { nurseId, campaignId } },
    update: { active: true, enrolledAt: new Date() },
    create: { nurseId, campaignId, active: true },
    include: { campaign: true },
  })

  return NextResponse.json(enrollment)
}

// DELETE — unenroll a nurse from this campaign (body: { nurseId })
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: campaignId } = await params
  const { nurseId } = await req.json()
  if (!nurseId) return NextResponse.json({ error: 'nurseId required' }, { status: 400 })

  await prisma.campaignEnrollment.updateMany({
    where: { nurseId, campaignId, active: true },
    data: { active: false },
  })

  return NextResponse.json({ ok: true })
}
