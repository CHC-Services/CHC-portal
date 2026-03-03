import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyToken } from '../../../lib/auth'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'nurse') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workDate, hours, notes } = await req.json()

  const entry = await prisma.timeEntry.create({
    data: {
      nurseId: session.nurseProfileId!,
      workDate: new Date(workDate),
      hours: parseInt(hours, 10),
      notes
    }
  })

  return NextResponse.json(entry)
}
