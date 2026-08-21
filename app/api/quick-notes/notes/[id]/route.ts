import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getQuickAccessIdentity } from '../../../../../lib/nurseQuickAccess'

// Draft-only, own-notes-only — a signed note 404s here even though it's
// fully visible/editable-as-signed through the real app. That's deliberate:
// this credential can create/edit/sign, never read back a completed note.
function isEditableDraft(note: { authorUserId: string | null; signedAt: Date | null }, userId: string) {
  return note.authorUserId === userId && !note.signedAt
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const note = await prisma.progressNote.findUnique({
    where: { id },
    include: {
      vitals: { orderBy: { sortOrder: 'asc' } },
      intakeOutput: { orderBy: { sortOrder: 'asc' } },
      voiceEntries: { orderBy: { recordedAt: 'asc' } },
      patient: { select: { firstName: true, lastName: true } },
    },
  })
  if (!note || !isEditableDraft(note, identity.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { patient, ...rest } = note
  return NextResponse.json({ note: { ...rest, patientLabel: `${patient.firstName[0]}. ${patient.lastName.slice(0, 5)}` } })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.progressNote.findUnique({ where: { id } })
  if (!existing || !isEditableDraft(existing, identity.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const data: Record<string, any> = {}
  if ('shiftStartTime' in body) data.shiftStartTime = body.shiftStartTime || null
  if ('shiftEndTime' in body) data.shiftEndTime = body.shiftEndTime || null
  if ('totalHours' in body) data.totalHours = body.totalHours === '' || body.totalHours === null ? null : Number(body.totalHours)
  if ('location' in body) data.location = body.location || null
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
      data: { progressNoteId: id, snapshot: full as any, savedBy: identity.userId },
    })

    return full
  })

  return NextResponse.json({ note })
}

// Abandon a draft started via quick-access.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await getQuickAccessIdentity(req)
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.progressNote.findUnique({ where: { id } })
  if (!existing || !isEditableDraft(existing, identity.userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.progressNote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
