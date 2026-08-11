import { NextResponse } from 'next/server'
import { verifyToken, signToken, INACTIVITY_MS } from '../../../../lib/auth'

// Pinged by InactivityGuard while the user is actively interacting with a page
// but not navigating/making other API calls, so the server-side idle clock
// doesn't drift out of sync with real engagement (e.g. reading a long document).
export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lastActivityAt = (session as any).lastActivityAt
  if (typeof lastActivityAt !== 'number' || Date.now() - lastActivityAt > INACTIVITY_MS) {
    const res = NextResponse.json({ error: 'Session expired' }, { status: 401 })
    res.cookies.set('auth_token', '', { path: '/', maxAge: 0 })
    return res
  }

  const res = NextResponse.json({ ok: true })
  const freshToken = signToken(session)
  res.cookies.set('auth_token', freshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  return res
}
