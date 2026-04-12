import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

const KEYS = [
  'promptPay.reminderEnabled',
  'promptPay.triggerDays',
  'promptPay.fromEmail',
  'promptPay.toEmail',
  'promptPay.formUrl',
  'promptPay.formS3Key',
  'promptPay.formFileName',
  'promptPay.formLinkName',
  'promptPay.subjectTemplate',
  'promptPay.customNote',
]

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET — return all prompt pay settings as { key: value } map
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: KEYS } } })
  const map: Record<string, string> = {}
  for (const row of rows) map[row.key] = row.value
  return NextResponse.json(map)
}

// POST — upsert one or more settings { key, value } OR { settings: { key: value } }
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
  } else if (body.key && KEYS.includes(body.key)) {
    pairs.push({ key: body.key, value: String(body.value ?? '') })
  }

  if (pairs.length === 0) {
    return NextResponse.json({ error: 'No valid keys provided' }, { status: 400 })
  }

  await Promise.all(
    pairs.map(({ key, value }) =>
      prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  )

  return NextResponse.json({ ok: true })
}
