import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { isMedicaidPayerName } from '../../../../lib/medicaidPayCycle'

// Real Medicaid claims live as commercial Claim rows with "Medicaid" as the
// primary or secondary payer — the old, separate MedicaidClaim table has been
// unused since the claims-entry form was unified in April 2026. This maps
// those commercial rows into the same shape the Pay Log UI already expects.
function toPayLogShape(c: any) {
  const primaryIsMedicaid = isMedicaidPayerName(c.primaryPayer)
  const secondaryIsMedicaid = !primaryIsMedicaid && isMedicaidPayerName(c.secondaryPayer)
  return {
    id: c.id,
    patientCtrlNum: c.claimId || c.id,
    payerCtrlNum: primaryIsMedicaid ? c.primaryCheckNum : (secondaryIsMedicaid ? c.secondaryCheckNum : null),
    dosStart: c.dosStart,
    dosStop: c.dosStop,
    totalCharge: c.totalBilled ?? 0,
    paidAmount: primaryIsMedicaid ? c.primaryPaidAmt : (secondaryIsMedicaid ? c.secondaryPaidAmt : null),
    processedDate: primaryIsMedicaid ? c.primaryPaidDate : (secondaryIsMedicaid ? c.secondaryPaidDate : null),
    estPayCycle: c.estPayCycle,
    depositDate: c.depositDate,
    statusCodes: c.claimStage ? [c.claimStage] : [],
    notes: c.processingNotes,
  }
}

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || !['nurse'].includes(session.role) || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const claims = await prisma.claim.findMany({
    where: {
      nurseId: session.nurseProfileId,
      OR: [{ primaryPayer: { contains: 'medicaid', mode: 'insensitive' } }, { secondaryPayer: { contains: 'medicaid', mode: 'insensitive' } }],
    },
    orderBy: { dosStart: 'desc' },
  })

  return NextResponse.json(claims.map(toPayLogShape))
}
