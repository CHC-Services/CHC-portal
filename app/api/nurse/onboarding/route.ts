import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { sendEnrollmentAlert } from '../../../../lib/sendEmail'
import { randomUUID } from 'crypto'

type TermType = 'short_term' | 'long_term'
type CarrierType = 'commercial' | 'medicaid' | 'dual'

function derivePlan(termType: TermType, carrierType: CarrierType): string {
  const prefix = termType === 'short_term' ? 'ST' : 'LT'
  const suffix = carrierType === 'commercial' ? 'COM' : carrierType === 'medicaid' ? 'MED' : 'DUAL'
  return `${prefix}-${suffix}`
}

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || !['nurse', 'provider'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { enrolledInBilling, termType, carrierType, billingDurationNote, signature, isReEnroll } = body

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const nurseName = session.displayName || session.name || 'Unknown Nurse'

  const data: Record<string, unknown> = {
    onboardingComplete: true,
    enrolledInBilling: !!enrolledInBilling,
  }

  let action: 'opted_out' | 'opted_in' | 're_enrolled' = 'opted_out'
  let logNote: string | undefined
  let emailDetails: string | undefined
  let insType = 'Single'

  if (enrolledInBilling) {
    const plan = derivePlan(termType as TermType, carrierType as CarrierType)
    action = isReEnroll ? 're_enrolled' : 'opted_in'
    data.billingDurationType = termType || 'long_term'
    data.billingDurationNote = billingDurationNote || null
    data.carrierCount        = carrierType === 'dual' ? 2 : 1
    data.billingPlan         = plan
    data.agreementSignature  = signature || null
    data.agreementSignedAt   = new Date()
    data.agreementIp         = ip

    const termLabel    = termType === 'short_term' ? 'Short-Term' : 'Long-Term'
    const carrierLabel = carrierType === 'commercial' ? 'Commercial' : carrierType === 'medicaid' ? 'Medicaid' : 'Dual'
    logNote      = `Plan: ${plan} (${termLabel} · ${carrierLabel})${billingDurationNote ? ` — ${billingDurationNote}` : ''}`
    emailDetails = logNote
    insType      = carrierType === 'dual' ? 'Dual' : 'Single'
  } else {
    action  = 'opted_out'
    logNote = 'Nurse opted out of billing services during onboarding.'
  }

  await prisma.nurseProfile.update({
    where: { id: session.nurseProfileId! },
    data,
  })

  const lastName = (session as any).lastName || nurseName.split(' ').slice(-1)[0] || nurseName
  const alertDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const emailSent = await sendEnrollmentAlert({ nurseName, action, details: emailDetails, lastName, insType, date: alertDate })

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
