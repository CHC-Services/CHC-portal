import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { uploadToS3, getPresignedDownloadUrl } from '../../../../../../lib/s3'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST — save invoice to S3, return presigned download URL
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const invoice = await (prisma.invoice.findUnique as any)({
    where: { id },
    include: {
      entries: { orderBy: { workDate: 'asc' } },
      payments: { orderBy: { appliedAt: 'asc' } },
      nurse: { select: { displayName: true, accountNumber: true, user: { select: { email: true } } } },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const s3Key = `invoices/${invoice.nurseId}/${invoice.invoiceNumber}.json`
  const payload = Buffer.from(JSON.stringify(invoice, null, 2), 'utf-8')

  await uploadToS3(s3Key, payload, 'application/json')

  await (prisma.invoice.update as any)({ where: { id }, data: { s3Key } })

  const url = await getPresignedDownloadUrl(s3Key, 900)

  return NextResponse.json({ ok: true, s3Key, url })
}

// GET — get presigned download URL for existing stored invoice
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const invoice = await (prisma.invoice.findUnique as any)({ where: { id }, select: { s3Key: true } })
  if (!invoice?.s3Key) return NextResponse.json({ error: 'Not stored in S3 yet' }, { status: 404 })

  const url = await getPresignedDownloadUrl(invoice.s3Key, 900)
  return NextResponse.json({ url })
}
