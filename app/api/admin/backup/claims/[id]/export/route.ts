import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../../lib/prisma'
import { verifyToken } from '../../../../../../../lib/auth'

function auth(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  return session?.role === 'admin' ? session : null
}

// Column order mirrors the Claim model in prisma/schema.prisma, grouped the
// same way (submission / prompt-pay / primary / secondary / summary / notes).
const COLUMNS: { header: string; field: string }[] = [
  { header: 'Claim ID',              field: 'claimId' },
  { header: 'Nurse',                 field: 'nurseName' },
  { header: 'Provider Name',         field: 'providerName' },
  { header: 'DOS Start',             field: 'dosStart' },
  { header: 'DOS Stop',              field: 'dosStop' },
  { header: 'Total Billed',          field: 'totalBilled' },
  { header: 'Hours',                 field: 'hours' },
  { header: 'Claim Stage',           field: 'claimStage' },
  { header: 'Submit Date',           field: 'submitDate' },
  { header: 'Primary Payer',         field: 'primaryPayer' },
  { header: 'Primary Allowed Amt',   field: 'primaryAllowedAmt' },
  { header: 'Primary CO',            field: 'primaryCO' },
  { header: 'Primary Paid Amt',      field: 'primaryPaidAmt' },
  { header: 'Primary Paid Date',     field: 'primaryPaidDate' },
  { header: 'Primary Paid To',       field: 'primaryPaidTo' },
  { header: 'Primary Check #',       field: 'primaryCheckNum' },
  { header: 'Secondary Payer',       field: 'secondaryPayer' },
  { header: 'Secondary Allowed Amt', field: 'secondaryAllowedAmt' },
  { header: 'Secondary CO',          field: 'secondaryCO' },
  { header: 'Secondary Paid Amt',    field: 'secondaryPaidAmt' },
  { header: 'Secondary Paid Date',   field: 'secondaryPaidDate' },
  { header: 'Secondary Paid To',     field: 'secondaryPaidTo' },
  { header: 'Secondary Check #',     field: 'secondaryCheckNum' },
  { header: 'Total Reimbursed',      field: 'totalReimbursed' },
  { header: 'Remaining Balance',     field: 'remainingBalance' },
  { header: 'Date Fully Finalized',  field: 'dateFullyFinalized' },
  { header: 'Check Received Date',   field: 'checkReceivedDate' },
  { header: 'Processing Notes',      field: 'processingNotes' },
  { header: 'Resubmission Of',       field: 'resubmissionOf' },
  { header: 'Voided At',             field: 'voidedAt' },
  { header: 'Void Reversal Of',      field: 'voidReversalOf' },
  { header: 'Created At',            field: 'createdAt' },
  { header: 'Updated At',            field: 'updatedAt' },
  { header: 'Claim Record ID',       field: 'id' },
]

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
    ? value.slice(0, 10) // dates come through the JSON snapshot as ISO strings — trim to YYYY-MM-DD
    : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const backup = await prisma.claimBackup.findUnique({ where: { id } })
  if (!backup) return NextResponse.json({ error: 'Backup not found.' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claims = backup.snapshot as any[]

  const nurseIds = Array.from(new Set(claims.map(c => c.nurseId).filter(Boolean)))
  const nurses = await (prisma.nurseProfile.findMany as any)({
    where: { id: { in: nurseIds } },
    select: { id: true, displayName: true, firstName: true, lastName: true },
  })
  const nurseNames = new Map(
    nurses.map((n: any) => [n.id, [n.firstName, n.lastName].filter(Boolean).join(' ') || n.displayName])
  )

  const rows = claims.map(c => {
    const row = { ...c, nurseName: nurseNames.get(c.nurseId) || c.nurseId || '' }
    return COLUMNS.map(col => csvCell(row[col.field])).join(',')
  })

  const csv = [COLUMNS.map(col => csvCell(col.header)).join(','), ...rows].join('\n')

  const dateStr = new Date(backup.createdAt).toISOString().slice(0, 10)
  const filename = `claim-backup-${dateStr}-${backup.label}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
