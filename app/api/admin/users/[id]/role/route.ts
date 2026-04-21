import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { sendAccessApprovedEmail } from '../../../../../../lib/sendEmail'

const VALID_ROLES = ['nurse', 'admin', 'biller', 'provider', 'guardian']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { role } = await req.json()

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { email: true, role: true, nurseProfile: { select: { displayName: true } } },
  })

  // Send approval email only when promoting a pending request to an active role
  if (role === 'nurse' && user.email) {
    const displayName = user.nurseProfile?.displayName || user.email
    sendAccessApprovedEmail({ to: user.email, displayName }).catch(() => {})
  }

  return NextResponse.json({ ok: true, role })
}
