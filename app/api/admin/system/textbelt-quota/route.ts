import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // This route is now superseded by /api/admin/system/textbelt-keys (GET)
  // Kept for backwards compatibility — checks env var key only
  const apiKey = process.env.TEXTBELT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'No env var key configured — use the key manager instead.' }, { status: 404 })
  }

  try {
    const res = await fetch(`https://textbelt.com/quota/${apiKey}`)
    const data = await res.json()
    return NextResponse.json({ quotaRemaining: data.quotaRemaining ?? 0, success: data.success })
  } catch {
    return NextResponse.json({ error: 'Failed to reach TextBelt' }, { status: 502 })
  }
}
