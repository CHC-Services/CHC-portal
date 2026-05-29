import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const setting = await (prisma.systemSetting.findUnique as any)({ where: { key: 'twofa_enabled' } })
  return NextResponse.json({ twofaEnabled: setting?.value === 'true' })
}

export async function PATCH(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { twofaEnabled } = await req.json()
  await (prisma.systemSetting.upsert as any)({
    where: { key: 'twofa_enabled' },
    update: { value: twofaEnabled ? 'true' : 'false' },
    create: { key: 'twofa_enabled', value: twofaEnabled ? 'true' : 'false' },
  })

  return NextResponse.json({ ok: true, twofaEnabled })
}
