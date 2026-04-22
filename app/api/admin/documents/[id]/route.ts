import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { deleteFromS3, getPresignedDownloadUrl } from '../../../../../lib/s3'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/admin/documents/[id]/url — returns a 15-minute presigned download URL
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const doc = await prisma.nurseDocument.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = await getPresignedDownloadUrl(doc.storageKey, 900, {
    contentType: doc.mimeType || undefined,
    fileName: doc.fileName,
    inline: true,
  })
  return NextResponse.json({ url })
}

// PATCH /api/admin/documents/[id]
// Accepts any combination of: visibleToNurse, title, category, expiresAt, reminderDays, nurseId
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const data: Record<string, any> = {}
  if (body.visibleToNurse !== undefined) data.visibleToNurse = body.visibleToNurse === true
  if (body.title !== undefined) data.title = body.title
  if (body.category !== undefined) data.category = body.category
  if ('expiresAt' in body) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (body.reminderDays !== undefined) data.reminderDays = Array.isArray(body.reminderDays) ? body.reminderDays.map(Number).filter((n: number) => !isNaN(n)) : []
  if (body.nurseId !== undefined) data.nurseId = body.nurseId

  const doc = await prisma.nurseDocument.update({ where: { id }, data })
  return NextResponse.json({ ok: true, document: doc })
}

// DELETE /api/admin/documents/[id] — removes from S3 and DB
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const doc = await prisma.nurseDocument.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await deleteFromS3(doc.storageKey)
  await prisma.nurseDocument.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
