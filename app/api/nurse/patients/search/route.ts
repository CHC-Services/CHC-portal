import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'nurse') {
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

  return NextResponse.json({ matches })
}
