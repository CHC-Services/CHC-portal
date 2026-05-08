import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { getPresignedPost } from '../../../../lib/s3'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// GET /api/admin/form-templates — list all templates
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.formTemplate.findMany({ orderBy: { title: 'asc' } })
  return NextResponse.json({ templates })
}

// POST /api/admin/form-templates
// Phase 1 (presign=true): { title, fileName, contentType } → presigned POST + storageKey
// Phase 2: { title, storageKey, fileName, fileSize?, mimeType?, uploadedBy? } → upsert record
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.presign && body.fileName && body.title) {
    const safeName = (body.fileName as string).replace(/[^a-zA-Z0-9._-]/g, '_')
    const storageKey = `form-templates/${Date.now()}-${safeName}`
    const { url, fields } = await getPresignedPost(storageKey, body.contentType || 'application/octet-stream')
    return NextResponse.json({ url, fields, storageKey })
  }

  const { title, storageKey, fileName, fileSize, mimeType, uploadedBy } = body
  if (!title || !storageKey || !fileName) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const template = await prisma.formTemplate.upsert({
    where: { title },
    update: { storageKey, fileName, fileSize: fileSize ?? null, mimeType: mimeType ?? null, uploadedBy: uploadedBy || 'admin' },
    create: { title, storageKey, fileName, fileSize: fileSize ?? null, mimeType: mimeType ?? null, uploadedBy: uploadedBy || 'admin' },
  })

  return NextResponse.json({ ok: true, template })
}
