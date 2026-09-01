import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { isLinkedToPatient } from '../../../../../../lib/permissions'
import { createProgressNoteDocument } from '../../../../../../lib/progressNoteDocument'
import { copyS3Object } from '../../../../../../lib/s3'
import { signedName } from '../../../../../../lib/formatName'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Confirm step, called after the browser's direct S3 upload (via the
// presign route's credentials) succeeds. Creates the ProgressNote row
// signed immediately — same signature-snapshot mechanic as the existing
// [id]/sign route, just at creation time instead of on an existing draft.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: patientId } = await params
  if (!(await isLinkedToPatient(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { storageKey, fileName, mimeType, fileSize, serviceDate, shiftNotes } = await req.json()
  if (!storageKey || !fileName || !serviceDate) {
    return NextResponse.json({ error: 'storageKey, fileName, and serviceDate are required' }, { status: 400 })
  }

  const profile = await prisma.nurseProfile.findUnique({
    where: { id: session.nurseProfileId },
    select: { signatureImageKey: true, firstName: true, lastName: true, displayName: true, credentials: true },
  })
  if (!profile?.signatureImageKey) {
    return NextResponse.json({ error: 'No stored signature on file — add one on your profile page first', requiresSignatureSetup: true }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const signatureImageKey = `progress-notes/${id}/signature.png`
  await copyS3Object(profile.signatureImageKey, signatureImageKey)

  const note = await createProgressNoteDocument({
    id,
    patientId,
    serviceDate: new Date(serviceDate),
    storageKey,
    fileName,
    mimeType: mimeType || null,
    fileSize: fileSize ?? null,
    shiftNotes: shiftNotes || null,
    authorUserId: session.id,
    signatureImageKey,
    authorDisplayNameSnapshot: signedName(profile),
  })

  return NextResponse.json({ note })
}
