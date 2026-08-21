import { prisma } from './prisma'
import { uploadToS3, objectExists, getPresignedDownloadUrl } from './s3'
import { generatePdfFromHtml } from './generateInvoicePdf'
import { buildProgressNoteHtml, buildProgressNoteHeaderTemplate, buildProgressNoteFooterTemplate } from './progressNoteHtml'
import { authorDisplayName } from './progressNoteAuthor'

const AUTHOR_SELECT = { select: { name: true, nurseProfile: { select: { firstName: true, lastName: true, displayName: true, credentials: true } } } } as const

/**
 * Returns a presigned URL for a signed note's stored PDF packet, generating
 * and uploading it to S3 first if it doesn't exist yet (or was invalidated
 * by a later sign/addendum/void). Mirrors lib/invoicePdf.ts's
 * getOrCreateInvoicePdf exactly — same reuse-point, same cache shape.
 */
export async function getOrCreateProgressNotePdf(noteId: string): Promise<{ url: string; s3Key: string }> {
  const note = await prisma.progressNote.findUnique({
    where: { id: noteId },
    include: {
      patient: { select: { firstName: true, lastName: true, accountNumber: true } },
      authorUser: AUTHOR_SELECT,
      vitals: { orderBy: { sortOrder: 'asc' } },
      intakeOutput: { orderBy: { sortOrder: 'asc' } },
      addenda: { include: { authorUser: AUTHOR_SELECT }, orderBy: { signedAt: 'asc' } },
    },
  })
  if (!note) throw new Error('Progress note not found')
  if (!note.signedAt || !note.signatureImageKey) throw new Error('Only signed notes can be exported')

  if (note.pdfS3Key && (await objectExists(note.pdfS3Key))) {
    const url = await getPresignedDownloadUrl(note.pdfS3Key, 900, {
      contentType: 'application/pdf',
      fileName: `progress-note-${note.serviceDate.toISOString().slice(0, 10)}.pdf`,
      inline: true,
    })
    return { url, s3Key: note.pdfS3Key }
  }

  const patientName = `${note.patient.firstName} ${note.patient.lastName}`

  const [signatureUrl, addenda] = await Promise.all([
    getPresignedDownloadUrl(note.signatureImageKey, 900, { inline: true, contentType: 'image/png' }),
    Promise.all(note.addenda.map(async a => ({
      authorDisplayName: authorDisplayName(a),
      authorRole: a.authorRole,
      text: a.text,
      signedAt: a.signedAt,
      signatureUrl: await getPresignedDownloadUrl(a.signatureImageKey, 900, { inline: true, contentType: 'image/png' }),
    }))),
  ])

  const html = buildProgressNoteHtml({
    patientName,
    patientAccountNumber: note.patient.accountNumber || '—',
    authorDisplayName: authorDisplayName(note),
    authorRole: note.authorRole,
    serviceDate: note.serviceDate,
    shiftStartTime: note.shiftStartTime,
    shiftEndTime: note.shiftEndTime,
    totalHours: note.totalHours,
    arrivalFindings: note.arrivalFindings,
    shiftNotes: note.shiftNotes,
    signedAt: note.signedAt,
    signatureUrl,
    voidedAt: note.voidedAt,
    voidReason: note.voidReason,
    vitals: note.vitals,
    intakeOutput: note.intakeOutput,
    addenda,
  })

  const pdfBuffer = await generatePdfFromHtml(html, {
    displayHeaderFooter: true,
    headerTemplate: buildProgressNoteHeaderTemplate(patientName, note.serviceDate),
    footerTemplate: buildProgressNoteFooterTemplate(),
    // Extra left clearance on every page — these get 3-hole-punched into a
    // binder. With standard long-edge duplex printing the binding edge
    // stays the same physical side front-and-back, so a uniform left margin
    // (not alternating odd/even) is correct here.
    margin: { left: '0.75in' },
  })

  const s3Key = `progress-notes/${noteId}/packet.pdf`
  await uploadToS3(s3Key, pdfBuffer, 'application/pdf')
  await prisma.progressNote.update({ where: { id: noteId }, data: { pdfS3Key: s3Key } })

  const url = await getPresignedDownloadUrl(s3Key, 900, {
    contentType: 'application/pdf',
    fileName: `progress-note-${note.serviceDate.toISOString().slice(0, 10)}.pdf`,
    inline: true,
  })
  return { url, s3Key }
}

/** Clears the stored PDF reference so the next print/download regenerates it. */
export async function invalidateProgressNotePdf(noteId: string): Promise<void> {
  await prisma.progressNote.update({ where: { id: noteId }, data: { pdfS3Key: null } }).catch(() => {})
}
