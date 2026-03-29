import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { sendNurseSharedDocumentAlert } from '../../../../../lib/sendEmail'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// POST /api/nurse/documents/confirm
// Body: { nurseId, title, storageKey, fileName, fileSize, mimeType, category, sharedWithAdmin }
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the nurseId matches the logged-in nurse
  const profile = await prisma.nurseProfile.findUnique({ where: { userId: session.id } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { nurseId, title, storageKey, fileName, fileSize, mimeType, category, sharedWithAdmin } = await req.json()

  if (!nurseId || !title || !storageKey || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (nurseId !== profile.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const doc = await prisma.nurseDocument.create({
    data: {
      nurseId: profile.id,
      title,
      fileName,
      storageKey,
      category: category || 'General',
      fileSize: fileSize ?? null,
      mimeType: mimeType ?? null,
      uploadedBy: session.id,
      nurseUploaded: true,
      visibleToNurse: true,
      sharedWithAdmin: sharedWithAdmin === true,
      adminReviewed: false,
    },
  })

  if (sharedWithAdmin) {
    sendNurseSharedDocumentAlert({
      nurseName: profile.displayName,
      documentTitle: title,
      category: category || 'General',
      uploadedAt: doc.createdAt,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, document: doc })
}
