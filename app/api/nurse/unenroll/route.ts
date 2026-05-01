import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { sendEnrollmentAlert } from '../../../../lib/sendEmail'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await (prisma.nurseProfile.update as any)({
    where: { id: session.nurseProfileId },
    data: { enrolledInBilling: false }
  })

  await (prisma.enrollmentLog.create as any)({
    data: {
      nurseId: session.nurseProfileId,
      nurseDisplayName: profile.displayName,
      action: 'opted_out',
      note: 'Nurse requested unenrollment from myProfile page',
      sentTo: 'enroll@cominghomecare.com',
    }
  })

  const lastName  = profile.lastName || profile.displayName.split(' ').slice(-1)[0] || profile.displayName
  const alertDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  sendEnrollmentAlert({
    nurseName: profile.displayName,
    action: 'opted_out',
    details: 'Requested via myProfile > myBilling unenrollment button',
    lastName,
    date: alertDate,
  })

  return NextResponse.json({ ok: true })
}
