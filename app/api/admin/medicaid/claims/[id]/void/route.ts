import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'
import { calcMedicaidCycleInfo } from '../../../../../../../lib/medicaidPayCycle'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

const neg = (n: number | null | undefined) => (n == null ? n : -n)

// POST — void a Medicaid claim: creates an offsetting reversal row (dollar
// fields negated) and marks the original with voidedAt, without touching any
// of the original's own field values. Never deletes anything.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const original = await (prisma.medicaidClaim.findUnique as any)({ where: { id } })
  if (!original) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  if (original.voidedAt) return NextResponse.json({ error: 'This claim has already been voided' }, { status: 400 })
  if (original.voidReversalOf) return NextResponse.json({ error: 'A reversal entry cannot itself be voided' }, { status: 400 })

  // The reversal inherits the original's processed date so it nets out against
  // the same pay cycle it's offsetting, instead of falling into "unscheduled."
  const procDateStr = original.processedDate ? new Date(original.processedDate).toISOString().slice(0, 10) : null
  const cycleInfo = procDateStr ? calcMedicaidCycleInfo(procDateStr) : null

  const [reversal, updatedOriginal] = await (prisma.$transaction as any)([
    (prisma.medicaidClaim.create as any)({
      data: {
        nurseId: original.nurseId,
        patientCtrlNum: `${original.patientCtrlNum}-VOID`,
        dosStart: original.dosStart,
        dosStop: original.dosStop,
        totalCharge: neg(original.totalCharge),
        paidAmount: neg(original.paidAmount),
        processedDate: original.processedDate,
        estPayCycle: cycleInfo?.cycle ?? null,
        depositDate: cycleInfo ? new Date(cycleInfo.depositDateStr) : null,
        voidReversalOf: original.id,
        notes: `Reversal of claim ${original.patientCtrlNum}`,
      },
    }),
    (prisma.medicaidClaim.update as any)({
      where: { id },
      data: { voidedAt: new Date() },
    }),
  ])

  await (prisma.claimAuditLog.create as any)({
    data: { claimType: 'medicaid', medicaidId: updatedOriginal.id, snapshot: updatedOriginal as any, savedBy: session.id },
  })
  await (prisma.claimAuditLog.create as any)({
    data: { claimType: 'medicaid', medicaidId: reversal.id, snapshot: reversal as any, savedBy: session.id },
  })

  return NextResponse.json({ ok: true, original: updatedOriginal, reversal })
}
