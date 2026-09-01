import { prisma } from './prisma'

export type SmsCategory = 'shift-claim' | 'reminder' | 'alert' | 'misc'

// Mirrors lib/logEmail.ts, minus the S3 body upload — SMS messages are short
// plain text, cheap to store directly on the row.
export async function logSms(params: {
  recipientName: string | null
  recipientPhone: string
  category: SmsCategory
  message: string
  status: 'sent' | 'failed'
}): Promise<void> {
  try {
    await (prisma.smsLog.create as any)({
      data: {
        recipientName: params.recipientName ?? null,
        recipientPhone: params.recipientPhone,
        category: params.category,
        message: params.message,
        status: params.status,
      },
    })
  } catch (err) {
    // Never let logging failures surface to the caller
    console.error('[logSms] Failed to log SMS:', err)
  }
}
