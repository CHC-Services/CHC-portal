import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { sendEnrollmentAlert } from '../../../../../../lib/sendEmail'
import { randomUUID } from 'crypto'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const profile = await (prisma.nurseProfile.findUnique as any)({
    where: { id },
    select: { id: true, displayName: true, lastName: true },
  })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await (prisma.nurseProfile.update as any)({
    where: { id },
    data: {
      onboardingComplete:        false,
      enrolledInBilling:         null,
      carrierCount:              null,
      billingDurationType:       null,
      billingDurationNote:       null,
      billingPlan:               null,
      agreementSignedAt:         null,
      agreementSignature:        null,
      agreementIp:               null,
      billingAgreementSignedAt:  null,
      billingAgreementInitials:  null,
      billingStatus:             null,
    },
  })

  const nurseName  = profile.displayName
  const lastName   = profile.lastName || nurseName.split(' ').slice(-1)[0] || nurseName
  const alertDate  = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const emailSent = await sendEnrollmentAlert({
    nurseName,
    action: 'opted_out',
    details: `Enrollment reset by admin (${session.name ?? 'admin'}) — nurse will re-complete onboarding on next login`,
    lastName,
    date: alertDate,
  })

  await (prisma.enrollmentLog.create as any)({
    data: {
      id:               randomUUID(),
      nurseId:          id,
      nurseDisplayName: nurseName,
      action:           'opted_out',
      note:             `Enrollment reset by admin (${session.name ?? 'admin'})`,
      sentTo:           'enroll@cominghomecare.com',
      emailSent,
    },
  })

  return NextResponse.json({ ok: true })
}
