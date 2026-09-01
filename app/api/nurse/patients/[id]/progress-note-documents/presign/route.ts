import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'
import { isLinkedToPatient } from '../../../../../../../lib/permissions'
import { presignProgressNoteDocument } from '../../../../../../../lib/progressNoteDocument'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Nurse/provider-only, per the feature's design — admin and family never
// get an upload entry point for this. Requires a stored signature up front
// (same precondition the existing sign route enforces) since a
// document-based note is signed immediately at creation — no point handing
// out upload credentials for a note she can't attest to.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: patientId } = await params
  if (!(await isLinkedToPatient(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const profile = await prisma.nurseProfile.findUnique({
    where: { id: session.nurseProfileId },
    select: { signatureImageKey: true },
  })
  if (!profile?.signatureImageKey) {
    return NextResponse.json({ error: 'No stored signature on file — add one on your profile page first', requiresSignatureSetup: true }, { status: 400 })
  }

  const { fileName, contentType } = await req.json()
  if (!fileName) return NextResponse.json({ error: 'fileName is required' }, { status: 400 })

  const result = await presignProgressNoteDocument({ patientId, fileName, contentType: contentType || 'application/octet-stream' })
  return NextResponse.json(result)
}
