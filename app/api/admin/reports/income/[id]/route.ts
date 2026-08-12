import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { getPresignedDownloadUrl } from '../../../../../../lib/s3'

function adminAuth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// GET — presigned re-download URL for a previously generated report
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!adminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const report = await (prisma.adminReport.findUnique as any)({ where: { id } })
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const url = await getPresignedDownloadUrl(report.storageKey, 900, { contentType: 'application/pdf', fileName: report.fileName, inline: true })
  return NextResponse.json({ url })
}
