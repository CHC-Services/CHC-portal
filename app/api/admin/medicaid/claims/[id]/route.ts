import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.patientCtrlNum !== undefined) data.patientCtrlNum = body.patientCtrlNum?.trim() || null
  if (body.payerCtrlNum   !== undefined) data.payerCtrlNum   = body.payerCtrlNum?.trim() || null
  if (body.dosStart       !== undefined) data.dosStart       = new Date(body.dosStart)
  if (body.dosStop        !== undefined) data.dosStop        = new Date(body.dosStop)
  if (body.totalCharge    !== undefined) data.totalCharge    = parseFloat(body.totalCharge)
  if (body.paidAmount     !== undefined) data.paidAmount     = body.paidAmount != null && body.paidAmount !== '' ? parseFloat(body.paidAmount) : null
  if (body.processedDate  !== undefined) data.processedDate  = body.processedDate ? new Date(body.processedDate) : null
  if (body.statusCodes    !== undefined) data.statusCodes    = body.statusCodes
  if (body.estPayCycle    !== undefined) data.estPayCycle    = body.estPayCycle ? parseInt(body.estPayCycle) : null
  if (body.notes          !== undefined) data.notes          = body.notes?.trim() || null

  const claim = await (prisma.medicaidClaim.update as any)({ where: { id }, data })

  await (prisma.claimAuditLog.create as any)({
    data: {
      claimType: 'medicaid',
      medicaidId: id,
      snapshot: claim as any,
      savedBy: session.id,
    },
  })

  return NextResponse.json(claim)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await (prisma.medicaidClaim.delete as any)({ where: { id } })
  return NextResponse.json({ ok: true })
}
