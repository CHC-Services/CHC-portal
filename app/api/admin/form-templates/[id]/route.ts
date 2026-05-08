import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { getPresignedDownloadUrl, deleteFromS3 } from '../../../../../lib/s3'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/admin/form-templates/[id] — presigned download URL
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = await prisma.formTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = await getPresignedDownloadUrl(template.storageKey)
  return NextResponse.json({ url })
}

// DELETE /api/admin/form-templates/[id] — remove from S3 + DB
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = await prisma.formTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try { await deleteFromS3(template.storageKey) } catch {}
  await prisma.formTemplate.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
