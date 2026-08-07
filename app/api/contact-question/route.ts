import { NextRequest, NextResponse } from 'next/server'
import { sendContactQuestion } from '@/lib/sendEmail'

export async function POST(req: NextRequest) {
  try {
    const { name, email, question } = await req.json()

    if (!name || !email || !question) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sent = await sendContactQuestion({ name, email, question })

    if (!sent) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
