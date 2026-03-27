import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'
import { getPresignedUploadUrl } from '../../../../../lib/s3'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/admin/documents/presign
// Body: { fileName, contentType, nurseId, category }
// Returns: { uploadUrl, storageKey }
export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { fileName, contentType, nurseId, category } = await req.json()
  if (!fileName || !nurseId) {
    return NextResponse.json({ error: 'Missing fileName or nurseId' }, { status: 400 })
  }

  const safeCategory = (category || 'general').toLowerCase().replace(/[^a-z0-9]/g, '-')
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storageKey = `nurse-documents/${nurseId}/${safeCategory}/${Date.now()}-${safeName}`

  try {
    const uploadUrl = await getPresignedUploadUrl(
      storageKey,
      contentType || 'application/octet-stream',
    )
    return NextResponse.json({ uploadUrl, storageKey })
  } catch (err: any) {
    console.error('[S3 presign error]', err)
    return NextResponse.json(
      { error: `Could not generate upload URL: ${err?.message || err?.Code || 'unknown'}` },
      { status: 500 },
    )
  }
}
