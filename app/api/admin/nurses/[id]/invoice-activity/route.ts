import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

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

  const { id: nurseId } = await params

  const activities = await (prisma.invoiceActivity.findMany as any)({
    where: { nurseId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ activities })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: nurseId } = await params
  const { action, documentType, reference, invoiceId, note } = await req.json()

  if (!action || !documentType) {
    return NextResponse.json({ error: 'action and documentType are required' }, { status: 400 })
  }

  const activity = await (prisma.invoiceActivity.create as any)({
    data: {
      nurseId,
      invoiceId: invoiceId || null,
      action,
      documentType,
      reference: reference || null,
      note: note || null,
    },
  })

  return NextResponse.json({ activity })
}
