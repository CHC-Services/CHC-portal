import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyToken } from '../../../lib/auth'

// Payer-specific claim status codes (F1, 3, F2, 483, A7, P0, 0, A3, 400, P4,
// ...) — NOT the X12 CARC/RARC standard (see CarcCode/carc-codes for that).
// This is a small, admin-curated list, so unlike the ~1,600-row CARC table
// there's no query/search here — just the full list, open to any
// authenticated nurse/admin since both work claims and need to resolve a
// code on Claim.remarkCodes into a human-readable description.
const DEFAULTS = [
  { code: 'F1',  description: 'Finalized/Payment-The claim/line has been paid.', active: true, outcome: 'Pay' },
  { code: '3',   description: 'Claim has been adjudicated and is awaiting payment cycle.', active: true, outcome: 'Neutral' },
  { code: 'F2',  description: 'Finalized/Denial-The claim/line has been denied.', active: true, outcome: 'Deny' },
  { code: '483', description: 'Maximum coverage amount met or exceeded for benefit period.', active: true, outcome: 'Deny' },
  { code: 'A7',  description: 'Rejected for Invalid Information - The claim has invalid information as specified in the Status details & has been rejected.', active: true, outcome: 'Deny' },
  { code: 'P0',  description: 'Pending Adjudication (Details: A pended claim is one in which the final outcome has not been determined and usually requires additional review).', active: true, outcome: 'Neutral' },
  { code: '0',   description: 'Cannot provide further status electronically. Contact payer to clarify further if needed.', active: true, outcome: 'Neutral' },
  { code: 'A3',  description: 'Claim Rejected from system as unprocessable. Review additional claim codes and resubmit.', active: true, outcome: 'Neutral' },
  { code: '400', description: 'Claim is out of balance.', active: true, outcome: 'Neutral' },
  { code: 'P4',  description: 'Other Insurance values not balances. Check claim line details and Other Payer tab.', active: true, outcome: 'Neutral' },
]

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || !['nurse', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Idempotent upsert-on-read: fills in any DEFAULT code that's missing and
  // never overwrites a code an admin has since edited or added themselves —
  // only touches rows that don't exist yet.
  await Promise.all(
    DEFAULTS.map(d => (prisma.medicaidStatusCode.upsert as any)({
      where: { code: d.code },
      update: {},
      create: d,
    }))
  )

  const codes = await (prisma.medicaidStatusCode.findMany as any)({ orderBy: { code: 'asc' } })
  return NextResponse.json(codes)
}
