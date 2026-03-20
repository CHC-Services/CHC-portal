import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get nurse profile for enrolledInBilling check
  let enrolledInBilling: boolean | null = null
  const nurseProfileId = session.nurseProfileId ?? null

  if (nurseProfileId) {
    try {
      const profile = await (prisma.nurseProfile as any).findUnique({
        where: { id: nurseProfileId },
        select: { enrolledInBilling: true },
      })
      enrolledInBilling = profile?.enrolledInBilling ?? null
    } catch {
      // ignore
    }
  }

  const allMessages = await prisma.portalMessage.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const visible = allMessages.filter(msg => {
    const a = msg.audiences
    if (a.includes('All Users')) return true
    if (a.includes('All Nurses') && session.role === 'nurse') return true
    if (a.includes('Active Billing') && enrolledInBilling === true) return true
    if (a.includes('Non-Provider') && session.role === 'nurse' && !enrolledInBilling) return true
    if (a.includes('Admins') && session.role === 'admin') return true
    if (nurseProfileId && a.includes(`user:${nurseProfileId}`)) return true
    return false
  })

  return NextResponse.json(visible)
}
