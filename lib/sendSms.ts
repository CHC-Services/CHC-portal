export async function sendSms(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const phoneDigits = phone.replace(/\D/g, '')
  if (!phoneDigits) {
    return { ok: false, error: 'Invalid phone number' }
  }

  const apiKey = process.env.TEXTBELT_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'TEXTBELT_API_KEY is not configured' }
  }

  const body = new URLSearchParams()
  body.set('phone', phoneDigits)
  body.set('message', message)
  body.set('key', apiKey)

  const response = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const data = await response.json().catch(() => null)
  if (!data || !data.success) {
    return { ok: false, error: data?.error || 'SMS send failed' }
  }

  return { ok: true }
}
