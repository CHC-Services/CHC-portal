import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

const KEYS = [
  'weeklyReminder.enabled',
  'weeklyReminder.dayOfWeek',
  'weeklyReminder.subject',
  'weeklyReminder.body',
]

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rows = await (prisma.systemSetting.findMany as any)({ where: { key: { in: KEYS } } })
  const map: Record<string, string> = {}
  for (const row of rows) map[row.key] = row.value
  return NextResponse.json(map)
}

export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()

  const pairs: { key: string; value: string }[] = []
  if (body.settings && typeof body.settings === 'object') {
    for (const [k, v] of Object.entries(body.settings)) {
      if (KEYS.includes(k)) pairs.push({ key: k, value: String(v) })
    }
  }

  if (pairs.length === 0) {
    return NextResponse.json({ error: 'No valid keys provided' }, { status: 400 })
  }

  await Promise.all(
    pairs.map(({ key, value }) =>
      (prisma.systemSetting.upsert as any)({ where: { key }, update: { value }, create: { key, value } })
    )
  )

  return NextResponse.json({ ok: true })
}
