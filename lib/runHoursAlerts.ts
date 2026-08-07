import { prisma } from './prisma'
import { sendSms } from './sendSms'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

async function adminPhones(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', phone: { not: null } },
    select: { phone: true },
  })
  return admins.map(a => a.phone!).filter(Boolean)
}

// Texts the admin(s) when a provider adds a brand-new billable hours entry.
// Capped at once per provider per calendar day via NurseProfile.hoursAlertSentDate —
// additional entries from the same nurse later the same day are silently skipped.
export async function notifyNewHoursAdded(nurseId: string): Promise<void> {
  const nurse = await (prisma.nurseProfile.findUnique as any)({
    where: { id: nurseId },
    select: { firstName: true, displayName: true, isDemo: true, hoursAlertSentDate: true },
  })
  if (!nurse || nurse.isDemo) return

  const today = todayStr()
  if (nurse.hoursAlertSentDate === today) return

  const phones = await adminPhones()
  if (phones.length === 0) return

  const firstName = nurse.firstName || nurse.displayName?.split(' ')[0] || nurse.displayName || 'a provider'
  const message = `Coming Homecare: New hours added for ${firstName}.`

  await Promise.allSettled(phones.map(p => sendSms(p, message)))

  await (prisma.nurseProfile.update as any)({
    where: { id: nurseId },
    data: { hoursAlertSentDate: today },
  })
}

// Weekly summary (Wednesday noon EST via cron) of every provider with billable
// hours not yet billed — brand-new entries and older unchecked/unbilled ones alike.
export async function runHoursSummary(): Promise<{ sent: number; providerCount: number }> {
  const phones = await adminPhones()
  if (phones.length === 0) return { sent: 0, providerCount: 0 }

  const entries = await (prisma.timeEntry.findMany as any)({
    where: { billed: false, nurse: { isDemo: false } },
    select: {
      hours: true,
      nurse: { select: { id: true, firstName: true, lastName: true, displayName: true } },
    },
  })

  const byNurse = new Map<string, { name: string; count: number; hours: number }>()
  for (const e of entries) {
    const n = e.nurse
    const name = n.firstName && n.lastName ? `${n.firstName} ${n.lastName}` : n.displayName
    const existing = byNurse.get(n.id)
    if (existing) {
      existing.count += 1
      existing.hours += e.hours
    } else {
      byNurse.set(n.id, { name, count: 1, hours: e.hours })
    }
  }

  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

  let message: string
  if (byNurse.size === 0) {
    message = 'No billable hours have been recorded on the Coming Homecare myProvider Portal at this time.'
  } else {
    const lines = [...byNurse.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => `${p.name} - ${p.count} (${p.hours}hrs)`)
    message = `Provider hours needing to be submitted by ${todayLabel} @ 12AM: \n${lines.join('\n')}\n\nSee the Coming Homecare portal for details.`
  }

  const results = await Promise.allSettled(phones.map(p => sendSms(p, message)))
  const sent = results.filter(r => r.status === 'fulfilled' && r.value.ok).length

  return { sent, providerCount: byNurse.size }
}
