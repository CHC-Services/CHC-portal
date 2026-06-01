import { prisma } from './prisma'

async function getActiveKey(): Promise<string | null> {
  // 1. Try DB keys first — iterate in order, use first one with quota remaining
  try {
    const row = await (prisma.systemSetting.findUnique as any)({ where: { key: 'textbelt_api_keys' } })
    if (row) {
      const keys: { key: string }[] = JSON.parse(row.value)
      for (const entry of keys) {
        try {
          const res = await fetch(`https://textbelt.com/quota/${entry.key}`)
          const data = await res.json()
          if (data.success && data.quotaRemaining > 0) return entry.key
        } catch {}
      }
    }
  } catch {}

  // 2. Fall back to env var (backwards compatibility)
  return process.env.TEXTBELT_API_KEY || null
}

export async function sendSms(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const phoneDigits = phone.replace(/\D/g, '')
  if (!phoneDigits) return { ok: false, error: 'Invalid phone number' }

  const apiKey = await getActiveKey()
  if (!apiKey) return { ok: false, error: 'No TextBelt API key configured' }

  const body = new URLSearchParams()
  body.set('phone', phoneDigits)
  body.set('message', message)
  body.set('key', apiKey)

  try {
    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await response.json().catch(() => null)
    if (!data?.success) return { ok: false, error: data?.error || 'SMS send failed' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Network error sending SMS' }
  }
}
