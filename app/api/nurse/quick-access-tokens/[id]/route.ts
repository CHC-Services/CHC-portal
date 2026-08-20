import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Revoke one of this nurse's own shortcuts.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const existing = await prisma.nurseQuickAccessToken.findUnique({ where: { id } })
  if (!existing || existing.nurseId !== session.nurseProfileId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.nurseQuickAccessToken.update({ where: { id }, data: { revokedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
