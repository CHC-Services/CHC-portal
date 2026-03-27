import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { sendNewDocumentAlert } from '../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/admin/documents — save document metadata after a presigned S3 upload
// Body (JSON): { nurseId, title, fileName, storageKey, category, fileSize, mimeType, expiresAt, reminderDays }
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    nurseId,
    title,
    fileName,
    storageKey,
    category = 'General',
    fileSize,
    mimeType,
    expiresAt,
    reminderDays = [],
  } = body

  if (!nurseId || !title || !fileName || !storageKey) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const doc = await prisma.nurseDocument.create({
    data: {
      nurseId,
      title,
      fileName,
      storageKey,
      category,
      fileSize: fileSize ?? null,
      mimeType: mimeType ?? null,
      uploadedBy: session.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      reminderDays: Array.isArray(reminderDays) ? reminderDays.map(Number).filter((n: number) => !isNaN(n)) : [],
    },
  })

  // Fire new-document alert if the nurse has that preference enabled
  const nurseProfile = await prisma.nurseProfile.findUnique({
    where: { id: nurseId },
    include: { user: { select: { email: true } } },
  })
  if (nurseProfile?.notifyNewDocument && nurseProfile.user?.email) {
    sendNewDocumentAlert({
      nurseEmail: nurseProfile.user.email,
      nurseName: nurseProfile.displayName,
      documentTitle: title,
      category,
      uploadedAt: doc.createdAt,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, document: doc })
}

// GET /api/admin/documents?nurseId=X — list documents for a nurse (no URLs returned — fetch via /[id]/url)
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const nurseId = searchParams.get('nurseId')
  if (!nurseId) return NextResponse.json({ error: 'nurseId required' }, { status: 400 })

  const documents = await prisma.nurseDocument.findMany({
    where: { nurseId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      fileName: true,
      category: true,
      fileSize: true,
      mimeType: true,
      expiresAt: true,
      reminderDays: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ documents })
}
