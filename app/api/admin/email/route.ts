import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { Resend } from 'resend'

const FROM = 'Coming Home Care <support@cominghomecare.com>'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { subject, body, recipientIds } = await req.json()
  if (!subject?.trim() || !body?.trim() || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return NextResponse.json({ error: 'subject, body, and at least one recipient are required' }, { status: 400 })
  }

  // Fetch nurse profiles + emails
  const nurses = await prisma.nurseProfile.findMany({
    where: recipientIds.includes('all')
      ? {}
      : { id: { in: recipientIds } },
    include: { user: { select: { email: true } } },
  })

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const PORTAL_URL = process.env.BASE_URL || 'https://portal.cominghomecare.com'

  const results = await Promise.allSettled(
    nurses.map(nurse =>
      resend.emails.send({
        from: FROM,
        replyTo: 'support@cominghomecare.com',
        to: nurse.user.email,
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:520px;padding:32px;color:#2F3E4E">
            <h2 style="margin:0 0 8px;color:#2F3E4E">Hi ${nurse.displayName},</h2>
            <div style="font-size:15px;color:#2F3E4E;line-height:1.7;white-space:pre-wrap">${body.replace(/\n/g, '<br/>')}</div>
            <hr style="border:none;border-top:1px solid #D9E1E8;margin:28px 0"/>
            <p style="font-size:11px;color:#aab">
              Coming Home Care Services, LLC · <a href="${PORTAL_URL}" style="color:#7A8F79">cominghomecare.com</a>
            </p>
          </div>
        `,
      })
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  const failed = results.length - sent

  return NextResponse.json({ sent, failed, total: nurses.length })
}
