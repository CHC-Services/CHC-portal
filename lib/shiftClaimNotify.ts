import { prisma } from './prisma'
import { sendSms } from './sendSms'
import {
  sendShiftPortionClaimedEmail,
  sendShiftPortionRequestEmail,
  sendShiftPortionRejectedEmail,
} from './sendEmail'

type Recipient = { name: string; email: string | null; phone: string | null }

// Same join pattern as lib/runPatientDocumentReminders.ts — approved
// guardians only (an unapproved guardian can't see the patient's data yet,
// so they shouldn't be notified about it either), plus admins who currently
// have the interim testing toggle on (User.notifyPartialShiftClaim).
export async function resolvePatientNotifyRecipients(patientId: string): Promise<{ guardians: Recipient[]; admins: Recipient[] }> {
  const [guardianLinks, adminUsers] = await Promise.all([
    (prisma.guardianPatient.findMany as any)({
      where: { patientId, approvedAt: { not: null } },
      select: { userId: true },
    }),
    (prisma.user.findMany as any)({
      where: { role: 'admin', notifyPartialShiftClaim: true },
      select: { id: true },
    }),
  ])

  const guardianUserIds = guardianLinks.map((l: any) => l.userId)
  const adminUserIds = adminUsers.map((u: any) => u.id)

  const [guardianUsers, resolvedAdmins] = await Promise.all([
    guardianUserIds.length
      ? prisma.user.findMany({ where: { id: { in: guardianUserIds } }, select: { name: true, email: true, phone: true } })
      : Promise.resolve([]),
    adminUserIds.length
      ? prisma.user.findMany({ where: { id: { in: adminUserIds } }, select: { name: true, email: true, phone: true } })
      : Promise.resolve([]),
  ])

  return {
    guardians: guardianUsers.map((u: any) => ({ name: u.name || 'there', email: u.email, phone: u.phone })),
    admins: resolvedAdmins.map((u: any) => ({ name: u.name || 'there', email: u.email, phone: u.phone })),
  }
}

async function notifyRecipient(
  recipient: Recipient,
  audience: 'nurse' | 'family' | 'admin',
  kind: 'claimed' | 'requested' | 'rejected',
  params: Record<string, any>
) {
  if (recipient.email) {
    if (kind === 'claimed') {
      await sendShiftPortionClaimedEmail({ toEmail: recipient.email, recipientName: recipient.name, audience, ...params } as any)
    } else if (kind === 'requested') {
      await sendShiftPortionRequestEmail({ toEmail: recipient.email, recipientName: recipient.name, ...params } as any)
    } else {
      await sendShiftPortionRejectedEmail({ toEmail: recipient.email, recipientName: recipient.name, ...params } as any)
    }
  }
  if (recipient.phone && params.smsMessage) {
    await sendSms(recipient.phone, params.smsMessage, 'shift-claim', recipient.name)
  }
}

function fmtRangeShort(start: Date, end: Date): string {
  const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateStr}, ${startStr}-${endStr}`
}

// Notifies the claiming nurse + this patient's approved guardians + toggled-on
// admins that a partial shift claim has finalized (immediate path, or an
// approved request) — what was claimed and what's still open.
export async function notifyShiftPortionClaimed(params: {
  patientId: string
  patientName: string
  nurseName: string
  nurseEmail: string | null
  nursePhone: string | null
  claimedStart: Date
  claimedEnd: Date
  remainingOpenRanges: { start: Date; end: Date }[]
}) {
  const { guardians, admins } = await resolvePatientNotifyRecipients(params.patientId)
  const remainingCount = params.remainingOpenRanges.length
  const smsMessage = `myProvider: ${params.nurseName} picked up ${fmtRangeShort(params.claimedStart, params.claimedEnd)} of ${params.patientName}'s shift.${remainingCount ? ` ${remainingCount} portion${remainingCount > 1 ? 's' : ''} still open.` : ''}`

  const emailParams = {
    patientName: params.patientName,
    nurseName: params.nurseName,
    claimedStart: params.claimedStart,
    claimedEnd: params.claimedEnd,
    remainingOpenRanges: params.remainingOpenRanges,
    smsMessage,
  }

  const tasks: Promise<void>[] = []
  if (params.nurseEmail || params.nursePhone) {
    tasks.push(notifyRecipient({ name: params.nurseName, email: params.nurseEmail, phone: params.nursePhone }, 'nurse', 'claimed', emailParams))
  }
  for (const g of guardians) tasks.push(notifyRecipient(g, 'family', 'claimed', emailParams))
  for (const a of admins) tasks.push(notifyRecipient(a, 'admin', 'claimed', emailParams))
  await Promise.allSettled(tasks)
}

// Notifies this patient's approved guardians + toggled-on admins that a
// nurse has requested a partial claim needing approval.
export async function notifyShiftPortionRequested(params: {
  patientId: string
  patientName: string
  nurseName: string
  requestedStart: Date
  requestedEnd: Date
}) {
  const { guardians, admins } = await resolvePatientNotifyRecipients(params.patientId)
  const smsMessage = `myProvider: ${params.nurseName} wants to cover ${fmtRangeShort(params.requestedStart, params.requestedEnd)} of ${params.patientName}'s open shift. Review on the schedule page.`

  const emailParams = {
    patientName: params.patientName,
    nurseName: params.nurseName,
    requestedStart: params.requestedStart,
    requestedEnd: params.requestedEnd,
    patientId: params.patientId,
    smsMessage,
  }

  const tasks: Promise<void>[] = []
  for (const g of guardians) tasks.push(notifyRecipient(g, 'family', 'requested', emailParams))
  for (const a of admins) tasks.push(notifyRecipient(a, 'admin', 'requested', emailParams))
  await Promise.allSettled(tasks)
}

// Notifies the requesting nurse only that her partial-claim request was
// denied (explicitly, or auto-rejected because the time's no longer available).
export async function notifyShiftPortionRejected(params: {
  nurseName: string
  nurseEmail: string | null
  nursePhone: string | null
  patientName: string
  requestedStart: Date
  requestedEnd: Date
  reason?: string
}) {
  const smsMessage = `myProvider: your request to cover ${fmtRangeShort(params.requestedStart, params.requestedEnd)} of ${params.patientName}'s shift wasn't approved.`
  await notifyRecipient(
    { name: params.nurseName, email: params.nurseEmail, phone: params.nursePhone },
    'nurse',
    'rejected',
    { patientName: params.patientName, requestedStart: params.requestedStart, requestedEnd: params.requestedEnd, reason: params.reason, smsMessage }
  )
}
