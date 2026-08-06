import { prisma } from './prisma'
import { uploadToS3, objectExists, getPresignedDownloadUrl } from './s3'
import { generatePdfFromHtml } from './generateInvoicePdf'
import { buildInvoiceHtml } from './invoiceHtml'

const INVOICE_INCLUDE = {
  entries: { orderBy: { workDate: 'asc' as const } },
  payments: { orderBy: { appliedAt: 'asc' as const } },
  nurse: {
    select: {
      displayName: true, accountNumber: true, firstName: true, lastName: true,
      address: true, city: true, state: true, zip: true, phone: true,
      hasBusinessProvider: true, bizEntityName: true, bizServiceAddress: true,
      bizPhone: true, bizEmail: true, user: { select: { email: true } },
    },
  },
}

/**
 * Returns a presigned URL for the invoice's stored PDF, generating and
 * uploading it to S3 first if it doesn't exist yet (or was invalidated by
 * a later edit). This is the single reuse point every route/email should
 * call — the same rendered bytes are served everywhere instead of each
 * caller re-rendering its own copy.
 */
export async function getOrCreateInvoicePdf(invoiceId: string): Promise<{ url: string; s3Key: string }> {
  const invoice = await (prisma.invoice.findUnique as any)({
    where: { id: invoiceId },
    include: INVOICE_INCLUDE,
  })
  if (!invoice) throw new Error('Invoice not found')

  if (invoice.s3Key && (await objectExists(invoice.s3Key))) {
    const url = await getPresignedDownloadUrl(invoice.s3Key, 900, {
      contentType: 'application/pdf',
      fileName: `${invoice.invoiceNumber}.pdf`,
      inline: true,
    })
    return { url, s3Key: invoice.s3Key }
  }

  const html = buildInvoiceHtml({
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    nurseName: invoice.nurseName,
    nurseEmail: invoice.nurseEmail,
    nurse: invoice.nurse,
    grossAmount: invoice.grossAmount,
    discountAmt: invoice.discountAmt,
    discountNote: invoice.discountNote,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    dueTerm: invoice.dueTerm,
    dueDate: invoice.dueDate,
    sentAt: invoice.sentAt,
    paidAt: invoice.paidAt,
    entries: invoice.entries,
    payments: invoice.payments,
    notes: invoice.notes,
    lateFeePlan: invoice.lateFeePlan,
    lateFeeAmt: invoice.lateFeeAmt,
    lateFeePercent: invoice.lateFeePercent,
    promptPayCredit: invoice.promptPayCredit,
    promptPayDays: invoice.promptPayDays,
  })

  const pdfBuffer = await generatePdfFromHtml(html)
  const s3Key = `invoices/${invoice.nurseId}/${invoice.invoiceNumber}.pdf`
  await uploadToS3(s3Key, pdfBuffer, 'application/pdf')
  await (prisma.invoice.update as any)({ where: { id: invoiceId }, data: { s3Key } })

  const url = await getPresignedDownloadUrl(s3Key, 900, {
    contentType: 'application/pdf',
    fileName: `${invoice.invoiceNumber}.pdf`,
    inline: true,
  })
  return { url, s3Key }
}

/** Clears the stored PDF reference so the next view/print/email regenerates it. */
export async function invalidateInvoicePdf(invoiceId: string): Promise<void> {
  await (prisma.invoice.update as any)({ where: { id: invoiceId }, data: { s3Key: null } })
}
