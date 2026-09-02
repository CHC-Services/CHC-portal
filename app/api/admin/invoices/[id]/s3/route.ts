import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../../lib/auth'
import { getOrCreateInvoicePdf, invalidateInvoicePdf } from '../../../../../../lib/invoicePdf'

// Puppeteer launching headless Chromium + rendering can run past Vercel's
// default serverless timeout — see the matching comment in
// app/api/admin/invoices/route.ts.
export const maxDuration = 30

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// A genuinely missing invoice reports 404; any other failure (Chromium
// timeout/crash, S3 hiccup) previously got flattened into the same "Not
// found" response, which reads as "this invoice doesn't exist" when it
// really does — misleading for what's usually a transient render failure.
function errorResponse(err: unknown) {
  if (err instanceof Error && err.message === 'Invoice not found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  console.error('Invoice PDF generation failed:', err)
  return NextResponse.json({ error: 'Failed to generate the invoice PDF. Please try again.' }, { status: 500 })
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
  } catch (err) {
    return errorResponse(err)
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
  } catch (err) {
    return errorResponse(err)
  }
}
