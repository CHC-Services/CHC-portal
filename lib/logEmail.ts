import { prisma } from './prisma'
import { uploadToS3 } from './s3'

export type EmailCategory = 'invoice' | 'receipt' | 'reminder' | 'alert' | 'broadcast' | 'misc'

export async function logEmail(params: {
  recipientName: string | null
  recipientEmail: string
  category: EmailCategory
  subject: string
  bodyHtml: string
  status: 'sent' | 'failed'
}): Promise<void> {
  try {
    const { randomUUID } = await import('crypto')
    const id = randomUUID()
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const s3Key = `email-logs/${year}/${month}/${id}.html`

    await uploadToS3(s3Key, Buffer.from(params.bodyHtml, 'utf-8'), 'text/html; charset=utf-8')

    await (prisma.emailLog.create as any)({
      data: {
        id,
        recipientName: params.recipientName ?? null,
        recipientEmail: params.recipientEmail.toLowerCase(),
        category: params.category,
        subject: params.subject,
        bodyS3Key: s3Key,
        status: params.status,
      },
    })
  } catch (err) {
    // Never let logging failures surface to the caller
    console.error('[logEmail] Failed to log email:', err)
  }
}
