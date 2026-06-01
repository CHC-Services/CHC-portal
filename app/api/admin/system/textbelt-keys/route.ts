import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

const SETTING_KEY = 'textbelt_api_keys'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

function maskKey(key: string) {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`
}

async function loadKeys(): Promise<{ key: string; label: string; addedAt: string }[]> {
  const row = await (prisma.systemSetting.findUnique as any)({ where: { key: SETTING_KEY } })
  if (!row) return []
  try { return JSON.parse(row.value) } catch { return [] }
}

async function saveKeys(keys: { key: string; label: string; addedAt: string }[]) {
  await (prisma.systemSetting.upsert as any)({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(keys) },
    create: { key: SETTING_KEY, value: JSON.stringify(keys) },
  })
}

// GET — return masked key list with live quota for each
export async function GET(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await loadKeys()

  const withQuota = await Promise.all(
    keys.map(async (entry) => {
      let quotaRemaining: number | null = null
      try {
        const res = await fetch(`https://textbelt.com/quota/${entry.key}`)
        const data = await res.json()
        if (data.success) quotaRemaining = data.quotaRemaining
      } catch {}
      return { label: entry.label, addedAt: entry.addedAt, masked: maskKey(entry.key), quotaRemaining }
    })
  )

  return NextResponse.json({ keys: withQuota })
}

// POST — add a new key
export async function POST(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { apiKey, label } = await req.json()
  if (!apiKey?.trim()) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

  // Verify the key works before saving
  try {
    const res = await fetch(`https://textbelt.com/quota/${apiKey.trim()}`)
    const data = await res.json()
    if (!data.success) return NextResponse.json({ error: 'TextBelt rejected that key — double-check it.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Could not reach TextBelt to verify the key.' }, { status: 502 })
  }

  const keys = await loadKeys()
  keys.push({ key: apiKey.trim(), label: label?.trim() || `Key added ${new Date().toLocaleDateString()}`, addedAt: new Date().toISOString() })
  await saveKeys(keys)

  return NextResponse.json({ ok: true })
}

// DELETE — remove key by index
export async function DELETE(req: Request) {
  if (!adminOnly(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { index } = await req.json()
  const keys = await loadKeys()
  if (index < 0 || index >= keys.length) return NextResponse.json({ error: 'Invalid index' }, { status: 400 })

  keys.splice(index, 1)
  await saveKeys(keys)

  return NextResponse.json({ ok: true })
}
