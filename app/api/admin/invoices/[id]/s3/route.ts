import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../../lib/auth'
import { getOrCreateInvoicePdf, invalidateInvoicePdf } from '../../../../../../lib/invoicePdf'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST — force-regenerate the stored PDF (e.g. after noticing a rendering issue)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    await invalidateInvoicePdf(id)
    const { url, s3Key } = await getOrCreateInvoicePdf(id)
    return NextResponse.json({ ok: true, s3Key, url })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

// GET — presigned download URL for the stored invoice PDF (generates it if missing)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const { url } = await getOrCreateInvoicePdf(id)
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
