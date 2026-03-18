import { NextRequest, NextResponse } from 'next/server'
import { sendBillingInquiry } from '@/lib/sendEmail'

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, phone, insuranceCount, insuranceNames } = await req.json()

    if (!firstName || !lastName || !email || !insuranceNames?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sent = await sendBillingInquiry({
      firstName,
      lastName,
      email,
      phone,
      insuranceCount: parseInt(insuranceCount) || insuranceNames.length,
      insuranceNames,
    })

    if (!sent) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
