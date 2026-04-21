import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../../lib/auth'
import {
  sendWelcomeEmail,
  sendRegistrationConfirmation,
  sendPasswordResetByAdmin,
  sendInvoiceEmail,
  sendReceiptEmail,
  sendEnrollmentAlert,
  sendBillingInquiry,
  sendWeeklyHoursReminder,
  sendDocumentExpirationReminder,
  sendNewDocumentAlert,
  sendNewClaimAlert,
  sendNurseSharedDocumentAlert,
  sendBulkImportSummary,
  sendEdiSummaryEmail,
  sendPromptPayReminder,
} from '../../../../../lib/sendEmail'
import { prisma } from '../../../../../lib/prisma'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { template } = await req.json()

  // Resolve the admin's actual email for preview delivery
  const adminUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, name: true },
  })
  const to = adminUser?.email ?? 'support@cominghomecare.com'
  const adminName = adminUser?.name ?? 'Admin'

  const mockDate = new Date('2026-04-20T00:00:00Z')
  const mockDueDate = new Date('2026-05-20T00:00:00Z')

  let ok = false

  switch (template) {
    case 'welcome_admin': {
      ok = await sendWelcomeEmail({
        to,
        displayName: adminName,
        email: to,
        password: 'TempPass123!',
      })
      break
    }

    case 'welcome_self': {
      ok = await sendRegistrationConfirmation({ to, displayName: adminName })
      break
    }

    case 'password_reset_admin': {
      ok = await sendPasswordResetByAdmin({
        to,
        displayName: adminName,
        email: to,
        password: 'NewTemp456!',
      })
      break
    }

    case 'invoice': {
      ok = await sendInvoiceEmail({
        to,
        nurseName: adminName,
        nurseFirstName: 'Alex',
        nurseLastName: 'McGann',
        nurseAddress: '123 Sample Street',
        nurseCity: 'New York',
        nurseState: 'NY',
        nurseZip: '10001',
        invoiceNumber: 'CHC-2026-0042',
        totalAmount: 18.00,
        dueTerm: '30',
        dueDate: mockDueDate,
        entries: [
          { workDate: new Date('2026-04-01T00:00:00Z'), invoiceFeePlan: 'A1', invoiceFeeAmt: 2 },
          { workDate: new Date('2026-04-05T00:00:00Z'), invoiceFeePlan: 'B',  invoiceFeeAmt: 4 },
          { workDate: new Date('2026-04-10T00:00:00Z'), invoiceFeePlan: 'A2', invoiceFeeAmt: 3 },
          { workDate: new Date('2026-04-15T00:00:00Z'), invoiceFeePlan: 'C',  invoiceFeeAmt: 6 },
          { workDate: new Date('2026-04-18T00:00:00Z'), invoiceFeePlan: 'A1', invoiceFeeAmt: 2 },
          { workDate: new Date('2026-04-20T00:00:00Z'), invoiceFeePlan: 'A1', invoiceFeeAmt: 1 },
        ],
        notes: 'This is a preview invoice generated from the admin template tester.',
      })
      break
    }

    case 'receipt': {
      ok = await sendReceiptEmail({
        to,
        nurseName: adminName,
        nurseFirstName: 'Alex',
        nurseLastName: 'McGann',
        accountNumber: '26001',
        receiptNumber: 'RCP-2026-0007',
        invoiceNumber: 'CHC-2026-0042',
        paymentAmount: 10.00,
        paymentMethod: 'Venmo',
        paymentNote: 'Preview receipt — no real payment applied.',
        appliedAt: mockDate,
        invoiceTotal: 18.00,
        previouslyPaid: 0,
        newTotalPaid: 10.00,
        balance: 8.00,
        newStatus: 'Partial',
      })
      break
    }

    case 'enrollment_alert_in': {
      ok = await sendEnrollmentAlert({
        nurseName: adminName,
        action: 'opted_in',
        details: 'Carrier: BCBS, Medicaid · Plan: B (Dual Payer) · Start: April 2026',
      })
      break
    }

    case 'enrollment_alert_out': {
      ok = await sendEnrollmentAlert({ nurseName: adminName, action: 'opted_out' })
      break
    }

    case 'billing_inquiry': {
      ok = await sendBillingInquiry({
        firstName: 'Sample',
        lastName: 'Provider',
        email: to,
        phone: '(555) 867-5309',
        insuranceCount: 2,
        insuranceNames: ['Medicaid', 'BCBS'],
      })
      break
    }

    case 'weekly_reminder': {
      ok = await sendWeeklyHoursReminder({
        to,
        displayName: adminName,
        nurseProfileId: 'preview-id-0000',
      })
      break
    }

    case 'doc_expiring': {
      ok = await sendDocumentExpirationReminder({
        nurseEmail: to,
        nurseName: adminName,
        documentTitle: 'RN License — State of New York',
        expiresAt: new Date('2026-05-15T00:00:00Z'),
        daysUntilExpiry: 25,
      })
      break
    }

    case 'doc_expiring_urgent': {
      ok = await sendDocumentExpirationReminder({
        nurseEmail: to,
        nurseName: adminName,
        documentTitle: 'BCBS Credentialing Certificate',
        expiresAt: new Date('2026-04-24T00:00:00Z'),
        daysUntilExpiry: 4,
      })
      break
    }

    case 'new_document': {
      ok = await sendNewDocumentAlert({
        nurseEmail: to,
        nurseName: adminName,
        documentTitle: 'Explanation of Benefits — April 2026',
        category: 'EOB',
        uploadedAt: mockDate,
      })
      break
    }

    case 'new_claim': {
      ok = await sendNewClaimAlert({
        nurseEmail: to,
        nurseName: adminName,
        claimId: 'CLM-PREVIEW-001',
        dosStart: new Date('2026-04-01T00:00:00Z'),
        dosStop: new Date('2026-04-30T00:00:00Z'),
        totalBilled: 1250.00,
      })
      break
    }

    case 'nurse_shared_doc': {
      ok = await sendNurseSharedDocumentAlert({
        nurseName: adminName,
        documentTitle: 'Updated NPI Certificate',
        category: 'License',
        uploadedAt: mockDate,
      })
      break
    }

    case 'bulk_import': {
      ok = await sendBulkImportSummary({
        nurseEmail: to,
        nurseName: adminName,
        claims: [
          { claimId: 'CLM-0040', dosStart: new Date('2026-03-01T00:00:00Z'), dosStop: new Date('2026-03-31T00:00:00Z'), totalBilled: 850 },
          { claimId: 'CLM-0041', dosStart: new Date('2026-04-01T00:00:00Z'), dosStop: new Date('2026-04-15T00:00:00Z'), totalBilled: 425 },
        ],
        documents: [
          { documentTitle: 'EOB March 2026', category: 'EOB' },
          { documentTitle: 'Remittance Advice', category: 'Other' },
        ],
      })
      break
    }

    case 'edi_summary': {
      ok = await sendEdiSummaryEmail({
        unmatched: [
          { claimId: 'CLM-9999', submittedDate: '2026-04-01', status: 'rejected', payerName: 'BCBS' },
        ],
        matched: [
          { claimId: 'CLM-0040', changes: ['claimStage → Paid'], status: 'accepted', payerName: 'Medicaid', submittedDate: '2026-03-15', errorCode: null },
          { claimId: 'CLM-0041', changes: ['processingNotes updated'], status: 'rejected', payerName: 'BCBS', submittedDate: '2026-04-01', errorCode: 'CO-4' },
        ],
        summary: {
          filesUploaded: 1,
          filesParsed: 1,
          claimsFound: 3,
          claimsMatched: 2,
          claimsUnmatched: 1,
        },
        dryRun: false,
      })
      break
    }

    case 'prompt_pay': {
      ok = await sendPromptPayReminder({
        toEmail: to,
        fromEmail: 'alerts@cominghomecare.com',
        providerName: adminName,
        claimId: 'CLM-PREVIEW-042',
        submitDate: new Date('2026-03-23T00:00:00Z'),
        day30: new Date('2026-04-22T00:00:00Z'),
        formLinkName: 'Prompt Pay Interest Form',
        formUrl: null,
        subjectTemplate: 'Prompt Pay Alert: Claim {claimId} — {provider} — Day 30 on {day30}',
        customNote: 'This is a preview of the Prompt Pay Interest alert email.',
      })
      break
    }

    default:
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
  }

  if (ok) return NextResponse.json({ sent: true, to })
  return NextResponse.json({ error: 'Send failed — check RESEND_API_KEY and logs.' }, { status: 500 })
}
