import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { canCreateProgressNote, canViewProgressNote } from '../../../../lib/permissions'
import { authorDisplayName } from '../../../../lib/progressNoteAuthor'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

const AUTHOR_INCLUDE = { authorUser: { select: { name: true, nurseProfile: { select: { displayName: true } } } } } as const

// All notes (draft + signed, not voided) for a patient this nurse is linked to.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const patientId = new URL(req.url).searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

  if (!(await canViewProgressNote(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const notes = await prisma.progressNote.findMany({
    where: { patientId },
    include: AUTHOR_INCLUDE,
    orderBy: { serviceDate: 'desc' },
  })
  return NextResponse.json({ notes: notes.map(n => ({ ...n, authorDisplayName: authorDisplayName(n) })) })
}

// Start a new draft note, authored by the requesting nurse.
export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { patientId, shiftId, serviceDate } = await req.json()
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

  if (!(await canCreateProgressNote(session, patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const note = await prisma.progressNote.create({
    data: {
      patientId,
      authorUserId: session.id,
      authorRole: 'nurse',
      shiftId: shiftId || null,
      serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
    },
  })

  return NextResponse.json({ note })
}
