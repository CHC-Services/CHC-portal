import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../lib/auth'
import { canViewProgressNote } from '../../../../../../lib/permissions'
import { getOrCreateProgressNotePdf } from '../../../../../../lib/progressNotePdf'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Presigned download URL for a signed note's PDF packet — guardians can
// save/print their own copy of a linked patient's note (generates it if missing).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({ where: { id }, select: { patientId: true, signedAt: true } })
  if (!note || !note.signedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canViewProgressNote(session, note.patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { url } = await getOrCreateProgressNotePdf(id)
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
