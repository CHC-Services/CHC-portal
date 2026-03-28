import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { sendNewDocumentAlert } from '../../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/admin/documents/confirm
// Called after the browser has PUT the file directly to S3 via a presigned URL.
// Body: { nurseId, title, storageKey, fileName, fileSize, mimeType, category, expiresAt?, reminderDays? }
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    nurseId,
    title,
    storageKey,
    fileName,
    fileSize,
    mimeType,
    category,
    expiresAt,
    reminderDays,
  } = await req.json()

  if (!nurseId || !title || !storageKey || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const doc = await prisma.nurseDocument.create({
    data: {
      nurseId,
      title,
      fileName,
      storageKey,
      category: category || 'General',
      fileSize: fileSize ?? null,
      mimeType: mimeType ?? null,
      uploadedBy: session.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      reminderDays: Array.isArray(reminderDays) ? reminderDays.map(Number).filter((n: number) => !isNaN(n)) : [],
    },
  })

  const nurseProfile = await prisma.nurseProfile.findUnique({
    where: { id: nurseId },
    include: { user: { select: { email: true } } },
  })
  if (nurseProfile?.notifyNewDocument && nurseProfile.user?.email) {
    sendNewDocumentAlert({
      nurseEmail: nurseProfile.user.email,
      nurseName: nurseProfile.displayName,
      documentTitle: title,
      category: category || 'General',
      uploadedAt: doc.createdAt,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, document: doc })
}
