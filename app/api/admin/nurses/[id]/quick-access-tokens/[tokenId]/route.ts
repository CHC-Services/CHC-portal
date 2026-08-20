import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Lost/stolen-device support — admin can revoke a nurse's shortcut without
// needing the nurse's own login.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; tokenId: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: nurseId, tokenId } = await params

  const existing = await prisma.nurseQuickAccessToken.findUnique({ where: { id: tokenId } })
  if (!existing || existing.nurseId !== nurseId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.nurseQuickAccessToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
