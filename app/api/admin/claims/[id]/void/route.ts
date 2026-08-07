import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

const neg = (n: number | null | undefined) => (n == null ? n : -n)

// POST — void a claim: creates an offsetting reversal row (every dollar field
// negated) and marks the original with voidedAt, without touching any of the
// original's own field values. Never deletes anything.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const voidDate: Date = body.voidDate ? new Date(body.voidDate + 'T00:00:00Z') : new Date()

  const original = await prisma.claim.findUnique({ where: { id } })
  if (!original) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  if (original.voidedAt) return NextResponse.json({ error: 'This claim has already been voided' }, { status: 400 })
  if (original.voidReversalOf) return NextResponse.json({ error: 'A reversal entry cannot itself be voided' }, { status: 400 })

  const [reversal, updatedOriginal] = await prisma.$transaction([
    prisma.claim.create({
      data: {
        nurseId: original.nurseId,
        providerName: original.providerName,
        dosStart: original.dosStart,
        dosStop: original.dosStop,
        hours: original.hours,
        claimId: original.claimId ? `${original.claimId}-VOID` : null,
        claimStage: 'Voided',
        submitDate: original.submitDate,
        primaryPayer: original.primaryPayer,
        secondaryPayer: original.secondaryPayer,
        totalBilled: neg(original.totalBilled),
        primaryAllowedAmt: neg(original.primaryAllowedAmt),
        primaryCO: neg(original.primaryCO),
        primaryPaidAmt: neg(original.primaryPaidAmt),
        secondaryAllowedAmt: neg(original.secondaryAllowedAmt),
        secondaryCO: neg(original.secondaryCO),
        secondaryPaidAmt: neg(original.secondaryPaidAmt),
        totalReimbursed: neg(original.totalReimbursed),
        remainingBalance: neg(original.remainingBalance),
        voidReversalOf: original.id,
        // Points back at the original's claimId so groupClaims() collapses
        // the original underneath this reversal in the claims list, the same
        // way a resubmission collapses the claim it supersedes.
        resubmissionOf: original.claimId || null,
        processingNotes: `Reversal of claim ${original.claimId || original.id}`,
      },
    }),
    prisma.claim.update({
      where: { id },
      data: { voidedAt: voidDate },
    }),
  ])

  await (prisma.claimAuditLog.create as any)({
    data: { claimType: 'commercial', commercialId: updatedOriginal.id, snapshot: updatedOriginal as any, savedBy: session.id },
  })
  await (prisma.claimAuditLog.create as any)({
    data: { claimType: 'commercial', commercialId: reversal.id, snapshot: reversal as any, savedBy: session.id },
  })

  return NextResponse.json({ ok: true, original: updatedOriginal, reversal })
}
