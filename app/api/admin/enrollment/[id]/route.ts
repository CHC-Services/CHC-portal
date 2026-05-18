import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { billingStatus, serviceStartDate, serviceEndDate, billingPlan, billingDurationType, onboardingComplete, enrolledInBilling } = body

  if (billingStatus !== undefined) {
    const allowed = ['Active', 'Termed', 'Seasonal', 'Pending', null]
    if (!allowed.includes(billingStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
  }

  const VALID_PLANS = ['ST-COM','ST-MED','ST-DUAL','LT-COM','LT-MED','LT-DUAL','custom',null,'']
  if (billingPlan !== undefined && !VALID_PLANS.includes(billingPlan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const VALID_DURATIONS = ['full_year', 'policy_specific', null, '']
  if (billingDurationType !== undefined && !VALID_DURATIONS.includes(billingDurationType)) {
    return NextResponse.json({ error: 'Invalid duration type' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (billingStatus !== undefined) data.billingStatus = billingStatus
  if (serviceStartDate !== undefined) data.serviceStartDate = serviceStartDate || null
  if (serviceEndDate !== undefined) data.serviceEndDate = serviceEndDate || null
  if (billingPlan !== undefined) data.billingPlan = billingPlan || null
  if (billingDurationType !== undefined) data.billingDurationType = billingDurationType || null
  if (onboardingComplete !== undefined) data.onboardingComplete = onboardingComplete
  if (enrolledInBilling !== undefined) data.enrolledInBilling = enrolledInBilling

  const updated = await (prisma.nurseProfile as any).update({
    where: { id },
    data,
  })

  return NextResponse.json(updated)
}
