import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { uploadToS3 } from '../../../../lib/s3'
import { sendNewDocumentAlert } from '../../../../lib/sendEmail'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/admin/documents — upload a document for a nurse
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const nurseId = formData.get('nurseId') as string | null
  const title = formData.get('title') as string | null
  const expiresAt = formData.get('expiresAt') as string | null
  const reminderDaysRaw = formData.get('reminderDays') as string | null
  const category = (formData.get('category') as string | null)?.trim() || 'General'

  if (!file || !nurseId || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const reminderDays: number[] = reminderDaysRaw
    ? JSON.parse(reminderDaysRaw).map(Number).filter((n: number) => !isNaN(n))
    : []

  // S3 key uses category as a subfolder — all docs live in one private bucket
  const safeCategory = category.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const storageKey = `nurse-documents/${nurseId}/${safeCategory}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadToS3(storageKey, buffer, file.type || 'application/octet-stream')

  const doc = await prisma.nurseDocument.create({
    data: {
      nurseId,
      title,
      fileName: file.name,
      storageKey,
      category,
      fileSize: file.size,
      mimeType: file.type || null,
      uploadedBy: session.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      reminderDays,
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
