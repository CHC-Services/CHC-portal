import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { uploadToS3, getPresignedDownloadUrl } from '../../../../lib/s3'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

function sanitize(s: string) {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 40)
}

// POST — upload a generated prompt pay letter HTML to S3 and record the version
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { html, claimRef, claimDbId } = await req.json() as {
    html: string
    claimRef: string
    claimDbId?: string | null
  }

  if (!html || typeof html !== 'string') {
    return NextResponse.json({ error: 'html is required' }, { status: 400 })
  }

  const ref = (claimRef || 'DRAFT').trim()

  // Count existing versions for this claimRef to determine next version number
  const existingCount = await prisma.promptPayDocument.count({
    where: { claimRef: ref },
  })
  const version = existingCount + 1

  const safeName = sanitize(ref)
  const fileName  = `PPN-${safeName}-v${version}.html`
  const s3Key     = `billing-support/prompt-pay/${fileName}`

  await uploadToS3(s3Key, Buffer.from(html, 'utf-8'), 'text/html')

  await prisma.promptPayDocument.create({
    data: {
      claimRef: ref,
      claimDbId: claimDbId || null,
      s3Key,
      fileName,
      version,
    },
  })

  // Return a short-lived presigned URL so the UI can confirm the upload succeeded
  const previewUrl = await getPresignedDownloadUrl(s3Key, 3600)

  return NextResponse.json({ ok: true, fileName, version, s3Key, previewUrl })
}

// GET — list all versions for a given claimRef
// ?claimRef=CLM-0042
export async function GET(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const claimRef = url.searchParams.get('claimRef') || ''

  const docs = await prisma.promptPayDocument.findMany({
    where: { claimRef: claimRef || undefined },
    orderBy: { createdAt: 'desc' },
  })

  // Attach presigned URLs
  const withUrls = await Promise.all(
    docs.map(async doc => {
      let url: string | null = null
      try { url = await getPresignedDownloadUrl(doc.s3Key, 3600) } catch {}
      return { ...doc, url }
    })
  )

  return NextResponse.json(withUrls)
}
