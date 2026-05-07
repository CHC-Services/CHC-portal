import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { getPresignedDownloadUrl, getPresignedPost } from '../../../../../lib/s3'
import { sendFormReturnedAlert } from '../../../../../lib/sendEmail'

function nurseSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/nurse/routed-forms/[id] — presigned view URL for the routed form
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = nurseSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await prisma.routedForm.findUnique({ where: { id: params.id } })
  if (!form || !form.storageKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const nurse = await prisma.nurseProfile.findFirst({ where: { userId: session.id } })
  if (!nurse || nurse.id !== form.nurseId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = await getPresignedDownloadUrl(form.storageKey)
  return NextResponse.json({ url })
}

// POST /api/nurse/routed-forms/[id] — sign & return
// Phase 1 (presign=true): return S3 presigned POST for signed file upload
// Phase 2 (storageKey provided): finalize — update record, save doc, send email
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = nurseSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nurse = await prisma.nurseProfile.findFirst({ where: { userId: session.id } })
  if (!nurse) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await prisma.routedForm.findUnique({ where: { id: params.id } })
  if (!form || form.nurseId !== nurse.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Phase 1 — get presigned URL for the signed file upload
  if (body.presign && body.fileName) {
    const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storageKey = `routed-forms/signed/${nurse.id}/${Date.now()}-${safeName}`
    const { url, fields } = await getPresignedPost(storageKey, body.contentType || 'application/octet-stream')
    return NextResponse.json({ url, fields, storageKey })
  }

  // Phase 2 — finalize after upload
  const { storageKey, fileName, fileSize, mimeType } = body
  if (!storageKey || !fileName) return NextResponse.json({ error: 'Missing storageKey or fileName' }, { status: 400 })

  await prisma.routedForm.update({
    where: { id: form.id },
    data: { status: 'signed', signedKey: storageKey, signedFileName: fileName, signedAt: new Date() },
  })

  // Save a copy to the nurse's document library (visible to nurse + admin)
  await prisma.nurseDocument.create({
    data: {
      nurseId: nurse.id,
      title: `${form.title} — Signed`,
      fileName,
      storageKey,
      category: form.category,
      fileSize: fileSize ?? null,
      mimeType: mimeType ?? null,
      uploadedBy: nurse.id,
      nurseUploaded: true,
      visibleToNurse: true,
      sharedWithAdmin: true,
    },
  })

  // Email support
  const userEmail = await prisma.user.findUnique({ where: { id: session.id }, select: { email: true } })
  sendFormReturnedAlert({
    nurseName: nurse.displayName,
    nurseEmail: userEmail?.email || '',
    formTitle: form.title,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
