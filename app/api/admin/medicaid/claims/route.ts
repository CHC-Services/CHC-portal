import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { calcMedicaidCycleInfo } from '../../../../../lib/medicaidPayCycle'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function GET(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const nurseId = searchParams.get('nurseId') || undefined

  const claims = await (prisma.medicaidClaim.findMany as any)({
    where: nurseId ? { nurseId } : {},
    include: { nurse: { select: { displayName: true, isDemo: true } } },
    orderBy: { dosStart: 'desc' },
  })

  return NextResponse.json(claims)
}

export async function POST(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { nurseId, patientCtrlNum, payerCtrlNum, dosStart, dosStop, totalCharge, paidAmount, processedDate, statusCodes, notes } = body

  if (!nurseId || !patientCtrlNum || !dosStart || !dosStop || totalCharge == null) {
    return NextResponse.json({ error: 'nurseId, patientCtrlNum, dosStart, dosStop, and totalCharge are required.' }, { status: 400 })
  }

  // The pay cycle and deposit date are always derived from the processed date
  // via the pay-cycle schedule — never trusted from the client — so a claim
  // always lands in the cycle it actually belongs to, with no manual drift.
  const cycleInfo = processedDate ? calcMedicaidCycleInfo(processedDate) : null

  const claim = await (prisma.medicaidClaim.create as any)({
    data: {
      nurseId,
      patientCtrlNum: patientCtrlNum.trim(),
      payerCtrlNum:   payerCtrlNum?.trim() || null,
      dosStart:       new Date(dosStart),
      dosStop:        new Date(dosStop),
      totalCharge:    parseFloat(totalCharge),
      paidAmount:     paidAmount != null ? parseFloat(paidAmount) : null,
      processedDate:  processedDate ? new Date(processedDate) : null,
      estPayCycle:    cycleInfo?.cycle ?? null,
      depositDate:    cycleInfo ? new Date(cycleInfo.depositDateStr) : null,
      statusCodes:    Array.isArray(statusCodes) ? statusCodes : [],
      notes:          notes?.trim() || null,
    },
  })

  return NextResponse.json(claim, { status: 201 })
}
