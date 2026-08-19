import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { canViewProgressNote } from '../../../../lib/permissions'
import { authorDisplayName } from '../../../../lib/progressNoteAuthor'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Signed, non-voided notes only — drafts are the author's private working copy.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'guardian') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patientId = new URL(req.url).searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

  if (!(await canViewProgressNote(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const notes = await prisma.progressNote.findMany({
    where: { patientId, signedAt: { not: null } },
    include: { authorUser: { select: { name: true, nurseProfile: { select: { displayName: true } } } } },
    orderBy: { serviceDate: 'desc' },
  })
  return NextResponse.json({ notes: notes.map(n => ({ ...n, authorDisplayName: authorDisplayName(n) })) })
}
