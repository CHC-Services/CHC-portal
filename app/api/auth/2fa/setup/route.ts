import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await (prisma.user as any).findUnique({ where: { id: session.id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const secret = (speakeasy as any).generateSecret({
    name: `myProvider (${user.email})`,
    issuer: 'Coming Home Care',
    length: 20,
  })

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)

  // Return secret + QR — not saved yet, saved only after first successful verify
  return NextResponse.json({ secret: secret.base32, qrCodeUrl })
}
