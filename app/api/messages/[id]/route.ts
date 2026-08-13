import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { messagingAuth, resolveUserNames } from '../../../../lib/messaging'

// GET — message detail. Marks the current user's recipient copy read on
// first view. 403s if the current user is neither the sender nor a
// recipient of this message.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = messagingAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const me = session.id

  const message = await prisma.message.findUnique({
    where: { id },
    include: { recipients: true },
  })
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isSender = message.senderId === me
  const myRecipientRow = message.recipients.find(r => r.userId === me)
  if (!isSender && !myRecipientRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (myRecipientRow && !myRecipientRow.readAt) {
    await prisma.messageRecipient.update({ where: { id: myRecipientRow.id }, data: { readAt: new Date() } })
    myRecipientRow.readAt = new Date()
  }

  const nameMap = await resolveUserNames(message.recipients.map(r => r.userId))

  let patient: { id: string; firstName: string; lastName: string } | null = null
  if (message.patientId) {
    patient = await prisma.patient.findUnique({ where: { id: message.patientId }, select: { id: true, firstName: true, lastName: true } })
  }

  let inReplyTo: { id: string; subject: string | null; senderName: string } | null = null
  if (message.inReplyToId) {
    inReplyTo = await prisma.message.findUnique({ where: { id: message.inReplyToId }, select: { id: true, subject: true, senderName: true } })
  }

  return NextResponse.json({
    message: {
      id: message.id,
      subject: message.subject,
      body: message.body,
      isDraft: message.isDraft,
      sentAt: message.sentAt,
      createdAt: message.createdAt,
      senderId: message.senderId,
      senderName: message.senderName,
      isSender,
      saved: isSender ? !!message.senderSavedAt : !!myRecipientRow?.savedAt,
      trashed: isSender ? !!message.senderTrashedAt : !!myRecipientRow?.trashedAt,
      recipients: message.recipients.map(r => ({ id: r.userId, name: nameMap[r.userId] || 'Unknown User', read: !!r.readAt })),
      patient,
      inReplyTo,
    },
  })
}

// PATCH — save/unsave/trash/restore the CURRENT USER's own copy of this
// message (branches on whether they're the sender or a recipient).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = messagingAuth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const me = session.id

  const { action } = await req.json()
  if (!['save', 'unsave', 'trash', 'restore'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const message = await prisma.message.findUnique({ where: { id }, select: { senderId: true } })
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (message.senderId === me) {
    const data: Record<string, Date | null> = {}
    if (action === 'save') data.senderSavedAt = new Date()
    if (action === 'unsave') data.senderSavedAt = null
    if (action === 'trash') data.senderTrashedAt = new Date()
    if (action === 'restore') data.senderTrashedAt = null
    await prisma.message.update({ where: { id }, data })
    return NextResponse.json({ ok: true })
  }

  const recipientRow = await prisma.messageRecipient.findUnique({ where: { messageId_userId: { messageId: id, userId: me } } })
  if (!recipientRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, Date | null> = {}
  if (action === 'save') data.savedAt = new Date()
  if (action === 'unsave') data.savedAt = null
  if (action === 'trash') data.trashedAt = new Date()
  if (action === 'restore') data.trashedAt = null
  await prisma.messageRecipient.update({ where: { id: recipientRow.id }, data })
  return NextResponse.json({ ok: true })
}
