import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'
import { flushNurseNotifications } from '../../../../../lib/flushNurseNotifications'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/admin/notifications/flush
// Manual release — called when Bulk Mode is toggled off. Sends whatever is
// currently queued regardless of age (unlike the cron route, which only
// releases nurses whose batch window has actually elapsed).
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const filterNurseIds: string[] | undefined = Array.isArray(body.nurseIds) ? body.nurseIds : undefined
  const trigger: string = body.trigger || 'manual'

  const { sent, skipped } = await flushNurseNotifications({ nurseIds: filterNurseIds, trigger })

  if (sent === 0 && skipped === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, message: 'No pending notifications' })
  }

  return NextResponse.json({ ok: true, sent, skipped })
}
