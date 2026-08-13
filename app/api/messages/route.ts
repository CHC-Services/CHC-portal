import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { formalName } from '../../../lib/formatName'
import { messagingAuth, notifyNewMessageRecipients } from '../../../lib/messaging'

type ListRow = {
  id: string
  subject: string | null
  preview: string
  senderName: string
  sentAt: Date | null
  updatedAt: Date
  isDraft: boolean
  read: boolean
  recipientCount: number
  patientId: string | null
}

function toRow(m: { id: string; subject: string | null; body: string; senderName: string; sentAt: Date | null; updatedAt: Date; isDraft: boolean; patientId: string | null; recipients?: { id: string }[] }, read: boolean): ListRow {
  return {
    id: m.id,
    subject: m.subject,
    preview: m.body.slice(0, 140),
    senderName: m.senderName,
    sentAt: m.sentAt,
    updatedAt: m.updatedAt,
    isDraft: m.isDraft,
    read,
    recipientCount: m.recipients?.length ?? 0,
    patientId: m.patientId,
  }
}

// GET — list messages in a folder for the current user.
// Folder membership is derived at query time, not stored as an enum.
export async function GET(req: Request) {
  const session = messagingAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const me = session.id

  const url = new URL(req.url)
  const folder = url.searchParams.get('folder') || 'inbox'
  const TAKE = 100

  let rows: ListRow[] = []

  if (folder === 'drafts') {
    const drafts = await prisma.message.findMany({
      where: { isDraft: true, senderId: me },
      orderBy: { updatedAt: 'desc' },
      take: TAKE,
    })
    rows = drafts.map(m => toRow(m, true))
  } else if (folder === 'sent') {
    const sent = await prisma.message.findMany({
      where: { isDraft: false, senderId: me, senderTrashedAt: null },
      include: { recipients: { select: { id: true } } },
      orderBy: { sentAt: 'desc' },
      take: TAKE,
    })
    rows = sent.map(m => toRow(m, true))
  } else if (folder === 'saved') {
    const [sentSaved, recvSaved] = await Promise.all([
      prisma.message.findMany({
        where: { isDraft: false, senderId: me, senderSavedAt: { not: null }, senderTrashedAt: null },
        include: { recipients: { select: { id: true } } },
      }),
      prisma.messageRecipient.findMany({
        where: { userId: me, savedAt: { not: null }, trashedAt: null },
        include: { message: { include: { recipients: { select: { id: true } } } } },
      }),
    ])
    rows = [
      ...sentSaved.map(m => toRow(m, true)),
      ...recvSaved.map(r => toRow(r.message, !!r.readAt)),
    ].sort((a, b) => new Date(b.sentAt || b.updatedAt).getTime() - new Date(a.sentAt || a.updatedAt).getTime()).slice(0, TAKE)
  } else if (folder === 'trash') {
    const [sentTrashed, recvTrashed] = await Promise.all([
      prisma.message.findMany({
        where: { senderId: me, senderTrashedAt: { not: null } },
        include: { recipients: { select: { id: true } } },
      }),
      prisma.messageRecipient.findMany({
        where: { userId: me, trashedAt: { not: null } },
        include: { message: { include: { recipients: { select: { id: true } } } } },
      }),
    ])
    rows = [
      ...sentTrashed.map(m => toRow(m, true)),
      ...recvTrashed.map(r => toRow(r.message, !!r.readAt)),
    ].sort((a, b) => new Date(b.sentAt || b.updatedAt).getTime() - new Date(a.sentAt || a.updatedAt).getTime()).slice(0, TAKE)
  } else {
    // inbox (default)
    const recv = await prisma.messageRecipient.findMany({
      where: { userId: me, trashedAt: null },
      include: { message: { include: { recipients: { select: { id: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: TAKE,
    })
    rows = recv.map(r => toRow(r.message, !!r.readAt))
  }

  return NextResponse.json({ messages: rows })
}

// POST — send a new message, or save/update a draft.
// Body: { recipientIds[], subject?, body, patientId?, isDraft, draftId?, inReplyToId? }
export async function POST(req: Request) {
  const session = messagingAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recipientIds, subject, body, patientId, isDraft, draftId, inReplyToId } = await req.json()
  const senderName = formalName(session) || session.name

  if (draftId) {
    const existing = await prisma.message.findUnique({ where: { id: draftId }, select: { senderId: true, isDraft: true } })
    if (!existing || existing.senderId !== session.id || !existing.isDraft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }
  }

  if (isDraft) {
    const data = {
      senderId: session.id,
      senderName,
      subject: subject || null,
      body: body || '',
      isDraft: true,
      draftRecipientIds: Array.isArray(recipientIds) ? recipientIds : [],
      patientId: patientId || null,
      inReplyToId: inReplyToId || null,
    }
    const msg = draftId
      ? await prisma.message.update({ where: { id: draftId }, data })
      : await prisma.message.create({ data })
    return NextResponse.json({ ok: true, id: msg.id })
  }

  if (!body || !body.trim()) {
    return NextResponse.json({ error: 'Message body is required.' }, { status: 400 })
  }
  const uniqueRecipientIds: string[] = [...new Set((Array.isArray(recipientIds) ? recipientIds : []).filter((rid: string) => rid !== session.id))]
  if (uniqueRecipientIds.length === 0) {
    return NextResponse.json({ error: 'At least one recipient is required.' }, { status: 400 })
  }

  const message = draftId
    ? await prisma.message.update({
        where: { id: draftId },
        data: {
          senderName, subject: subject || null, body, isDraft: false, sentAt: new Date(),
          draftRecipientIds: [], patientId: patientId || null, inReplyToId: inReplyToId || null,
        },
      })
    : await prisma.message.create({
        data: {
          senderId: session.id, senderName, subject: subject || null, body, isDraft: false, sentAt: new Date(),
          patientId: patientId || null, inReplyToId: inReplyToId || null,
        },
      })

  await prisma.messageRecipient.createMany({
    data: uniqueRecipientIds.map(userId => ({ messageId: message.id, userId })),
    skipDuplicates: true,
  })

  notifyNewMessageRecipients(message, uniqueRecipientIds).catch(() => {})

  return NextResponse.json({ ok: true, id: message.id })
}
