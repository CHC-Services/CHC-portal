import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { canEditProgressNote, canViewProgressNote } from '../../../../../lib/permissions'
import { getPresignedDownloadUrl } from '../../../../../lib/s3'
import { authorDisplayName } from '../../../../../lib/progressNoteAuthor'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

const AUTHOR_SELECT = { select: { name: true, nurseProfile: { select: { displayName: true } } } } as const

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const note = await prisma.progressNote.findUnique({
    where: { id },
    include: {
      vitals: { orderBy: { sortOrder: 'asc' } },
      intakeOutput: { orderBy: { sortOrder: 'asc' } },
      authorUser: AUTHOR_SELECT,
      addenda: { include: { authorUser: AUTHOR_SELECT }, orderBy: { signedAt: 'asc' } },
    },
  })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Own-authorship is a standing exception to the usual link requirement —
  // otherwise a nurse loses access to notes she personally wrote the moment
  // she's unassigned from a case, even though the record still exists. See
  // /nurse/my-notes for the archive this makes reachable.
  const isOwnNote = note.authorUserId === session.id
  if (!isOwnNote && !(await canViewProgressNote(session, note.patientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const signatureUrl = note.signatureImageKey
    ? await getPresignedDownloadUrl(note.signatureImageKey, 900, { inline: true, contentType: 'image/png' })
    : null

  const addenda = await Promise.all(note.addenda.map(async a => ({
    ...a,
    authorDisplayName: authorDisplayName(a),
    signatureUrl: await getPresignedDownloadUrl(a.signatureImageKey, 900, { inline: true, contentType: 'image/png' }),
  })))

  return NextResponse.json({
    note: { ...note, authorDisplayName: authorDisplayName(note), addenda },
    isAuthor: isOwnNote,
    signatureUrl,
  })
}

// Draft-only, author-only. Replaces header fields and fully replaces the
// vitals/intakeOutput child rows (delete-and-recreate — the simplest correct
// way to sync a client-edited table back to rows with a sortOrder), then
// appends a ProgressNoteRevision snapshot of the saved state.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const existing = await prisma.progressNote.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditProgressNote(session, existing))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const data: Record<string, any> = {}
  if ('serviceDate' in body) data.serviceDate = new Date(body.serviceDate)
  if ('shiftStartTime' in body) data.shiftStartTime = body.shiftStartTime || null
  if ('shiftEndTime' in body) data.shiftEndTime = body.shiftEndTime || null
  if ('totalHours' in body) data.totalHours = body.totalHours === '' || body.totalHours === null ? null : Number(body.totalHours)
  if ('arrivalFindings' in body) data.arrivalFindings = body.arrivalFindings || null
  if ('shiftNotes' in body) data.shiftNotes = body.shiftNotes || null

  const vitals = Array.isArray(body.vitals) ? body.vitals : null
  const intakeOutput = Array.isArray(body.intakeOutput) ? body.intakeOutput : null

  const note = await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.progressNote.update({ where: { id }, data })
    }

    if (vitals) {
      await tx.progressNoteVital.deleteMany({ where: { progressNoteId: id } })
      if (vitals.length > 0) {
        await tx.progressNoteVital.createMany({
          data: vitals.map((v: any, i: number) => ({
            progressNoteId: id,
            sortOrder: i,
            time: v.time || null,
            temp: v.temp || null,
            hr: v.hr || null,
            rr: v.rr || null,
            skin: v.skin || null,
            o2Flow: v.o2Flow || null,
            o2Route: v.o2Route || null,
            o2Percent: v.o2Percent || null,
            lungSounds: v.lungSounds || null,
            txNeeded: v.txNeeded || null,
            suction: v.suction || null,
          })),
        })
      }
    }

    if (intakeOutput) {
      await tx.progressNoteIntakeOutput.deleteMany({ where: { progressNoteId: id } })
      if (intakeOutput.length > 0) {
        await tx.progressNoteIntakeOutput.createMany({
          data: intakeOutput.map((r: any, i: number) => ({
            progressNoteId: id,
            sortOrder: i,
            time: r.time || null,
            intakeType: r.intakeType || null,
            intakeAmt: r.intakeAmt || null,
            intakeRoute: r.intakeRoute || null,
            outputUrine: r.outputUrine || null,
            outputBM: r.outputBM || null,
            outputEmesis: r.outputEmesis || null,
          })),
        })
      }
    }

    const full = await tx.progressNote.findUnique({
      where: { id },
      include: {
        vitals: { orderBy: { sortOrder: 'asc' } },
        intakeOutput: { orderBy: { sortOrder: 'asc' } },
      },
    })

    await tx.progressNoteRevision.create({
      data: {
        progressNoteId: id,
        snapshot: full as any,
        savedBy: session.id,
      },
    })

    return full
  })

  return NextResponse.json({ note })
}

// Draft-only cleanup for an abandoned note.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const existing = await prisma.progressNote.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditProgressNote(session, existing))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.progressNote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
