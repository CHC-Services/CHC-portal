import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'
import { getPresignedPost } from '../../../../../lib/s3'
import { prisma } from '../../../../../lib/prisma'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/nurse/documents/presign
// Body: { fileName, contentType, category }
// Returns: { url, fields, storageKey }
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.nurseProfile.findUnique({ where: { userId: session.id }, select: { id: true } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { fileName, contentType, category } = await req.json()
  if (!fileName) return NextResponse.json({ error: 'Missing fileName' }, { status: 400 })

  const safeCategory = (category || 'general').toLowerCase().replace(/[^a-z0-9]/g, '-')
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storageKey = `nurse-documents/${profile.id}/${safeCategory}/${Date.now()}-${safeName}`

  try {
    const { url, fields } = await getPresignedPost(storageKey, contentType || 'application/octet-stream')
    return NextResponse.json({ url, fields, storageKey, nurseId: profile.id })
  } catch (err: any) {
    return NextResponse.json({ error: `Could not generate upload URL: ${err?.message || 'unknown'}` }, { status: 500 })
  }
}
