import { prisma } from './prisma'
import { sendPromptPayReminder } from './sendEmail'
import { getPresignedDownloadUrl } from './s3'

export async function runClaimReminders(): Promise<{ sent: number; total: number; skipped?: string }> {
  // ── Load settings ────────────────────────────────────────────────────────────
  const settingRows = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          'promptPay.reminderEnabled',
          'promptPay.triggerDays',
          'promptPay.fromEmail',
          'promptPay.toEmail',
          'promptPay.formUrl',
          'promptPay.formS3Key',
          'promptPay.formLinkName',
          'promptPay.subjectTemplate',
          'promptPay.customNote',
        ],
      },
    },
  })

  const s: Record<string, string> = {}
  for (const row of settingRows) s[row.key] = row.value

  const enabled         = s['promptPay.reminderEnabled'] !== 'false'
  const triggerDays     = parseInt(s['promptPay.triggerDays'] || '28', 10)
  const fromEmail       = s['promptPay.fromEmail']       || 'alerts@cominghomecare.com'
  const toEmail         = s['promptPay.toEmail']         || 'support@cominghomecare.com'
  const formS3Key       = s['promptPay.formS3Key']       || null
  const formLinkName    = s['promptPay.formLinkName']    || 'Prompt Pay Interest Form'
  const subjectTemplate = s['promptPay.subjectTemplate'] || 'Prompt Pay Alert: Claim {claimId} — {provider} — Day 30 on {day30}'
  const customNote      = s['promptPay.customNote']      || ''
  const externalFormUrl = s['promptPay.formUrl']         || null

  if (!enabled) return { sent: 0, total: 0, skipped: 'reminders disabled' }

  // ── Find claims past triggerDays that haven't been alerted yet ───────────────
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - triggerDays)

  const claims = await prisma.claim.findMany({
    where: {
      submitDate: { not: null, lte: cutoff },
      submitDateReminderSentAt: null,
    },
    select: {
      id: true,
      claimId: true,
      providerName: true,
      submitDate: true,
      nurse: { select: { displayName: true } },
    },
  })

  if (claims.length === 0) return { sent: 0, total: 0 }

  // Resolve form URL once (S3 presigned URL valid 72 hours)
  let formUrl: string | null = externalFormUrl
  if (!formUrl && formS3Key) {
    try { formUrl = await getPresignedDownloadUrl(formS3Key, 72 * 3600) } catch { formUrl = null }
  }

  let sent = 0
  const sentIds: string[] = []

  for (const claim of claims) {
    if (!claim.submitDate) continue
    const providerName = claim.providerName || claim.nurse?.displayName || 'Unknown Provider'
    const claimRef     = claim.claimId || claim.id.slice(0, 8)

    const day30 = new Date(claim.submitDate)
    day30.setDate(day30.getDate() + 30)

    const ok = await sendPromptPayReminder({
      toEmail, fromEmail, providerName, claimId: claimRef,
      submitDate: claim.submitDate, day30,
      formLinkName, formUrl, subjectTemplate, customNote,
    })

    if (ok) { sentIds.push(claim.id); sent++ }
  }

  if (sentIds.length > 0) {
    await prisma.claim.updateMany({
      where: { id: { in: sentIds } },
      data: { submitDateReminderSentAt: new Date() },
    })
  }

  return { sent, total: claims.length }
}
