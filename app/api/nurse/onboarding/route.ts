import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { sendEnrollmentAlert } from '../../../../lib/sendEmail'
import { randomUUID } from 'crypto'

function derivePlan(carrierCount: number): string {
  if (carrierCount === 1) return 'A1/A2'
  if (carrierCount === 2) return 'B'
  return 'custom'
}

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || session.role !== 'nurse') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { enrolledInBilling, carrierCount, billingDurationType, billingDurationNote, signature, isReEnroll } = body

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const nurseName = session.displayName || session.name || 'Unknown Nurse'

  const data: Record<string, unknown> = {
    onboardingComplete: true,
    enrolledInBilling: !!enrolledInBilling,
  }

  let action: 'opted_out' | 'opted_in' | 're_enrolled' = 'opted_out'
  let logNote: string | undefined
  let emailDetails: string | undefined

  if (enrolledInBilling) {
    action = isReEnroll ? 're_enrolled' : 'opted_in'
    data.carrierCount        = carrierCount || 1
    data.billingDurationType = billingDurationType || 'full_year'
    data.billingDurationNote = billingDurationNote || null
    data.billingPlan         = derivePlan(carrierCount || 1)
    data.agreementSignature  = signature || null
    data.agreementSignedAt   = new Date()
    data.agreementIp         = ip
    logNote     = `Plan: ${derivePlan(carrierCount || 1)}, ${carrierCount} carrier(s), ${billingDurationType === 'full_year' ? 'full year' : billingDurationNote}`
    emailDetails = logNote
  } else {
    action  = 'opted_out'
    logNote = 'Nurse opted out of billing services during onboarding.'
  }

  await prisma.nurseProfile.update({
    where: { id: session.nurseProfileId! },
    data,
  })

  // Fire email alert (non-blocking)
  const emailSent = await sendEnrollmentAlert({ nurseName, action, details: emailDetails })

  // Log the event
  await prisma.enrollmentLog.create({
    data: {
      id:               randomUUID(),
      nurseId:          session.nurseProfileId!,
      nurseDisplayName: nurseName,
      action,
      note:             logNote,
      sentTo:           'enroll@cominghomecare.com',
      emailSent,
    }
  })

  return NextResponse.json({ ok: true })
}
