import { prisma } from './prisma'
import { verifyToken } from './auth'
import { formalName } from './formatName'
import { sendNewMessageNotification } from './sendEmail'

// Peer-to-peer messaging is role-agnostic — every user has identical rights
// over their own mailbox, so unlike the patient module there's no per-role
// route triplication. Billers are excluded: there's no biller portal today,
// so there'd be nowhere for one to read a reply.
export function messagingAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role === 'biller') return null
  return session
}

// Nurses/providers show their chosen displayName (falling back to
// formalName's "Last, First"); everyone else only has User.name.
export async function resolveUserNames(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {}
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      nurseProfile: { select: { displayName: true, firstName: true, lastName: true } },
    },
  })
  const map: Record<string, string> = {}
  for (const u of users) {
    map[u.id] = u.nurseProfile ? (formalName(u.nurseProfile) || u.name) : u.name
  }
  return map
}

function messagingPathFor(role: string) {
  if (role === 'admin') return '/admin/email'
  if (role === 'guardian') return '/family/messaging'
  return '/nurse/messaging' // nurse + provider share the nurse portal
}

// Fire-and-forget email alert to each recipient who has notifyNewMessage on.
// Nobody can opt out of receiving the message itself — this only gates the
// email nudge, per the recipient's own preference.
export async function notifyNewMessageRecipients(
  message: { senderName: string; subject: string | null; body: string },
  recipientIds: string[]
) {
  if (recipientIds.length === 0) return
  const users = await prisma.user.findMany({
    where: { id: { in: recipientIds }, notifyNewMessage: true },
    select: {
      email: true,
      name: true,
      role: true,
      nurseProfile: { select: { displayName: true, firstName: true, lastName: true } },
    },
  })
  if (users.length === 0) return

  const base = process.env.BASE_URL || 'https://portal.cominghomecare.com'
  const preview = message.body.slice(0, 140)

  await Promise.all(users.map(u => sendNewMessageNotification({
    recipientEmail: u.email,
    recipientName: u.nurseProfile ? (formalName(u.nurseProfile) || u.name) : u.name,
    senderName: message.senderName,
    subject: message.subject || '',
    preview,
    messageUrl: `${base}${messagingPathFor(u.role)}`,
  }).catch(() => false)))
}
