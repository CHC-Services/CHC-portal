import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) return null
  return session
}

// GET — returns all paylog entries for this nurse (map of depositDate → receivedAt)
export async function GET(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logs = await (prisma.medicaidPayWeekLog.findMany as any)({
    where: { nurseId: session.nurseProfileId },
    select: { depositDate: true, receivedAt: true },
  })

  const result: Record<string, string | null> = {}
  for (const log of logs) {
    result[log.depositDate] = log.receivedAt ? log.receivedAt.toISOString() : null
  }
  return NextResponse.json(result)
}

// PATCH — toggle received state for a deposit date
// body: { depositDate: "YYYY-MM-DD", received: boolean }
export async function PATCH(req: Request) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { depositDate, received } = await req.json()
  if (!depositDate || typeof received !== 'boolean') {
    return NextResponse.json({ error: 'depositDate and received required' }, { status: 400 })
  }

  const receivedAt = received ? new Date() : null

  await (prisma.medicaidPayWeekLog.upsert as any)({
    where: { nurseId_depositDate: { nurseId: session.nurseProfileId, depositDate } },
    update: { receivedAt, updatedAt: new Date() },
    create: { id: crypto.randomUUID(), nurseId: session.nurseProfileId, depositDate, receivedAt },
  })

  return NextResponse.json({ ok: true, depositDate, receivedAt: receivedAt?.toISOString() ?? null })
}
