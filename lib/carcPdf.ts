import { prisma } from './prisma'
import { generatePdfFromHtml } from './generateInvoicePdf'
import { uploadToS3, objectExists, getPresignedDownloadUrl } from './s3'
import { sortByCarcCode } from './carcSort'

const S3_KEY = 'resources/carc-adjustment-reason-codes.pdf'
const FILE_NAME = 'CHC-CARC-Adjustment-Reason-Codes.pdf'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(d: Date | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

async function buildCarcListHtml(): Promise<string> {
  const rawCodes = await (prisma.carcCode.findMany as any)({
    orderBy: { active: 'desc' },
  })
  // Group active-first (matches orderBy above), numerically sorted within each group.
  const active = sortByCarcCode(rawCodes.filter((c: any) => c.active))
  const inactive = sortByCarcCode(rawCodes.filter((c: any) => !c.active))
  const codes = [...active, ...inactive]

  const rows = codes.map((c: any) => `
    <tr>
      <td class="code">${escapeHtml(c.code)}</td>
      <td class="status ${c.active ? 'active' : 'inactive'}">${c.active ? 'Active' : 'Deactivated'}</td>
      <td class="desc">${escapeHtml(c.description)}${c.notes ? `<div class="notes">${escapeHtml(c.notes)}</div>` : ''}</td>
      <td class="dates">${fmtDate(c.startDate)}${c.stopDate ? ` &ndash; ${fmtDate(c.stopDate)}` : ''}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #2F3E4E; margin: 0; }
  .header { padding: 20px 24px 12px; border-bottom: 2px solid #2F3E4E; }
  .header h1 { font-size: 18px; margin: 0 0 4px; }
  .header p { font-size: 10px; color: #7A8F79; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  thead { display: table-header-group; }
  th { text-align: left; background: #F4F6F5; color: #7A8F79; text-transform: uppercase; letter-spacing: 0.5px; font-size: 8px; padding: 6px 8px; border-bottom: 1px solid #D9E1E8; }
  td { padding: 5px 8px; border-bottom: 1px solid #F4F6F5; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .code { font-family: Courier, monospace; font-weight: bold; white-space: nowrap; width: 40px; }
  .status { white-space: nowrap; width: 60px; }
  .status.inactive { color: #B91C1C; }
  .status.active { color: #7A8F79; }
  .desc { width: auto; }
  .notes { color: #7A8F79; font-style: italic; margin-top: 2px; }
  .dates { white-space: nowrap; width: 110px; color: #7A8F79; }
</style>
</head>
<body>
  <div class="header">
    <h1>Claim Adjustment Reason Codes (CARC)</h1>
    <p>Source: X12.org — https://x12.org/codes/claim-adjustment-reason-codes &middot; Generated ${fmtDate(new Date())} &middot; ${codes.length} codes</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>Status</th>
        <th>Description</th>
        <th>Effective Dates</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
`
}

// Generate-once, cache-by-fixed-key: the CARC list only changes when someone
// re-imports from X12, so unlike per-entity documents (invoices) there's no
// natural cache-busting event — objectExists() is the only check needed.
export async function getOrCreateCarcCodesPdf(opts: { forceRegenerate?: boolean } = {}): Promise<{ url: string; s3Key: string }> {
  if (!opts.forceRegenerate && (await objectExists(S3_KEY))) {
    const url = await getPresignedDownloadUrl(S3_KEY, 900, { contentType: 'application/pdf', fileName: FILE_NAME, inline: true })
    return { url, s3Key: S3_KEY }
  }

  const html = await buildCarcListHtml()
  const pdfBuffer = await generatePdfFromHtml(html)
  await uploadToS3(S3_KEY, pdfBuffer, 'application/pdf')

  const url = await getPresignedDownloadUrl(S3_KEY, 900, { contentType: 'application/pdf', fileName: FILE_NAME, inline: true })
  return { url, s3Key: S3_KEY }
}
