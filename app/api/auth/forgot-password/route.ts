import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { email } = await req.json()

  // Always return the same response to prevent email enumeration
  const ok = NextResponse.json({ ok: true })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return ok

  const token = randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

  await (prisma.user.update as any)({
    where: { email },
    data: { passwordResetToken: token, passwordResetExpiry: expiry }
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  if (process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from: 'CHC Portal <notifications@cominghomecare.com>',
      to: email,
      subject: 'Reset your CHC Portal password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;padding:24px">
          <h2 style="color:#2F3E4E">Password Reset</h2>
          <p style="color:#555">You requested a password reset for your Coming Home Care portal account.</p>
          <p style="color:#555">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}"
            style="display:inline-block;margin:16px 0;background:#2F3E4E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Reset My Password
          </a>
          <p style="color:#7A8F79;font-size:12px;margin-top:16px">
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #D9E1E8;margin:16px 0"/>
          <p style="color:#7A8F79;font-size:11px">Coming Home Care Provider Portal</p>
        </div>
      `,
    })
  }

  return ok
}
