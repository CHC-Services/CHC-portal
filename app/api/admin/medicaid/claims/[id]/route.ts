import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { calcMedicaidCycleInfo } from '../../../../../../lib/medicaidPayCycle'

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

  const existing = await (prisma.medicaidClaim.findUnique as any)({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.patientCtrlNum !== undefined) data.patientCtrlNum = body.patientCtrlNum?.trim() || null
  if (body.payerCtrlNum   !== undefined) data.payerCtrlNum   = body.payerCtrlNum?.trim() || null
  if (body.dosStart       !== undefined) data.dosStart       = new Date(body.dosStart)
  if (body.dosStop        !== undefined) data.dosStop        = new Date(body.dosStop)
  if (body.totalCharge    !== undefined) data.totalCharge    = parseFloat(body.totalCharge)
  if (body.paidAmount     !== undefined) data.paidAmount     = body.paidAmount != null && body.paidAmount !== '' ? parseFloat(body.paidAmount) : null
  if (body.processedDate  !== undefined) data.processedDate  = body.processedDate ? new Date(body.processedDate) : null
  if (body.statusCodes    !== undefined) data.statusCodes    = body.statusCodes
  if (body.notes          !== undefined) data.notes          = body.notes?.trim() || null

  // Pay cycle / deposit date are re-derived from whatever the processed date
  // ends up being after this edit — never taken from the client — so any edit
  // that touches the processed date (or any other field) always leaves the
  // claim filed under the correct pay cycle instead of a stale/typed-in one.
  const effectiveProcessedDate = body.processedDate !== undefined ? body.processedDate : existing.processedDate
  const procDateStr = effectiveProcessedDate
    ? (typeof effectiveProcessedDate === 'string' ? effectiveProcessedDate : new Date(effectiveProcessedDate).toISOString()).slice(0, 10)
    : null
  const cycleInfo = procDateStr ? calcMedicaidCycleInfo(procDateStr) : null
  data.estPayCycle = cycleInfo?.cycle ?? null
  data.depositDate = cycleInfo ? new Date(cycleInfo.depositDateStr) : null

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
