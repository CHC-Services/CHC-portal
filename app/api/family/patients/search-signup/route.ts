import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken, signPatientMatchToken } from '../../../../../lib/auth'

// POST — a guardian's self-service exact-match patient search, used during
// signup to find a patient before creating a duplicate record. Same 3-factor
// exact-match rules as the nurse search (no autocomplete, no partial
// matches — a submitted exact match or nothing) so this can't be used to
// probe for other patients' existence.
export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'guardian') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { lastName, dob, insuranceId } = await req.json()
  if (!lastName || !dob || !insuranceId) {
    return NextResponse.json({ error: 'lastName, dob, and insuranceId are required' }, { status: 400 })
  }

  const matches = await (prisma.patient.findMany as any)({
    where: {
      lastName:    { equals: lastName.trim(),    mode: 'insensitive' },
      dob:         dob.trim(),
      insuranceId: { equals: insuranceId.trim(), mode: 'insensitive' },
    },
  })

  const matchesWithToken = matches.map((m: any) => ({
    ...m,
    matchToken: signPatientMatchToken(session.id, m.id),
  }))

  return NextResponse.json({ matches: matchesWithToken })
}
