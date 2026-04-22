import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { getPresignedDownloadUrl } from '../../../../../../lib/s3'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — return presigned S3 URL for the message body
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const log = await (prisma.emailLog.findUnique as any)({
    where: { id },
    select: { bodyS3Key: true },
  })

  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!log.bodyS3Key) return NextResponse.json({ error: 'No body stored' }, { status: 404 })

  const url = await getPresignedDownloadUrl(log.bodyS3Key, 600, {
    contentType: 'text/html; charset=utf-8',
    inline: true,
  })
  return NextResponse.json({ url })
}
