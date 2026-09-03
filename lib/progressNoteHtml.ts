// Canonical Progress Note packet HTML — this is the ONE template used for
// print/PDF export. Do not fork this markup elsewhere; add a caller instead.
// Mirrors lib/invoiceHtml.ts's conventions (inline styles throughout — no
// external/`<style>` CSS, since that's the safest path through Puppeteer's
// HTML-to-PDF renderer).

import { formatServiceDate } from './localDate'

const NAVY = '#2F3E4E'
const SAGE = '#7A8F79'
const BG = '#D9E1E8'
const OFFWHITE = '#F4F6F5'

export interface ProgressNoteHtmlVital {
  time: string | null
  temp: string | null
  hr: string | null
  rr: string | null
  skin: string | null
  o2Flow: string | null
  o2Route: string | null
  o2Percent: string | null
  lungSounds: string | null
  txNeeded: string | null
  suction: string | null
}

export interface ProgressNoteHtmlIO {
  time: string | null
  intakeType: string | null
  intakeAmt: string | null
  intakeRoute: string | null
  outputUrine: string | null
  outputBM: string | null
  outputEmesis: string | null
}

export interface ProgressNoteHtmlAddendum {
  authorDisplayName: string
  authorRole: string
  text: string
  signatureUrl: string
  signedAt: Date | string
}

export interface ProgressNoteHtmlData {
  patientName: string
  patientAccountNumber: string
  authorDisplayName: string
  authorRole: string
  serviceDate: Date | string
  shiftStartTime: string | null
  shiftEndTime: string | null
  totalHours: number | null
  location: string | null
  arrivalFindings: string | null
  shiftNotes: string | null
  // Optional so this template can also render a not-yet-signed draft preview
  // (see generateDraftProgressNotePdf in lib/progressNotePdf.ts) — every
  // existing signed-note caller still always passes both.
  signedAt?: Date | string | null
  signatureUrl?: string | null
  voidedAt: Date | string | null
  voidReason: string | null
  vitals: ProgressNoteHtmlVital[]
  intakeOutput: ProgressNoteHtmlIO[]
  addenda: ProgressNoteHtmlAddendum[]
  // Snapshotted from the canonical Patient record at export time — a
  // point-in-time read for the printed packet, not stored on the note itself.
  dxCode1: string | null
  dxCode2: string | null
  insuranceName: string | null
  insuranceId: string | null
  ins2Name: string | null
  ins2Id: string | null
  paNumber: string | null
}

const fmtDate = formatServiceDate
const fmtDateTime = (d: Date | string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cell = (v: string | null) => esc(v || '—')

// Puppeteer-driven running footer, repeated on every page (see
// lib/generateInvoicePdf.ts's displayHeaderFooter option) — this is what
// stands in for the paper form's repeated, page-numbered continuation
// pages, without needing to model "pages" as data. Page/total-page counts
// are Chrome's own print-pagination output (via the pageNumber/totalPages
// classes) — there's no way to compute or bake those into the main content
// HTML itself, since the content has no idea where Chrome will paginate it.
// No running header — the document's own header block (patientName/account,
// title) already covers page 1, and repeating it on a separate top strip
// was redundant; the patient identifier lives in this footer instead so
// continuation pages still carry it if ever separated from page 1.
export function buildProgressNoteFooterTemplate(patientName: string): string {
  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:8px;color:${SAGE};width:100%;padding:5px 0.25in 0;margin:0 0.1in;border-top:1px solid ${BG};display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:700;color:${NAVY}">${esc(patientName)}</span>
      <span style="letter-spacing:0.04em">Coming Home Care</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`
}

// Column widths as percentages of the table — Time/Temp/HR/RR/O2 Flow/O2 %
// only ever hold a short fixed-format value (a clock time, a 2-3 digit
// number), so they're kept narrow; Skin and Lung Sounds are the two
// genuinely free-text columns and get the room those short ones give up.
const VITALS_COL_WIDTHS = [7, 6, 5, 5, 17, 6, 9, 6, 19, 14, 6] // Time Temp HR RR Skin O2Flow O2Route O2% LungSounds TxNeeded Suction

function vitalsTable(rows: ProgressNoteHtmlVital[]): string {
  if (rows.length === 0) return `<p style="font-size:11px;color:${SAGE};font-style:italic">No vitals recorded.</p>`
  const colgroup = `<colgroup>${VITALS_COL_WIDTHS.map(w => `<col style="width:${w}%">`).join('')}</colgroup>`
  const th = (label: string) => `<th style="text-align:center;padding:4px 6px;font-size:8px;text-transform:uppercase;letter-spacing:0.03em;color:${SAGE};border-bottom:1px solid ${BG}">${label}</th>`
  const td = (v: string | null) => `<td style="padding:4px 6px;font-size:10px;color:${NAVY};text-align:center;border-bottom:1px solid ${OFFWHITE}">${cell(v)}</td>`
  return `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      ${colgroup}
      <thead><tr>
        ${th('Time')}${th('Temp')}${th('HR')}${th('RR')}${th('Skin')}${th('O2 Flow')}${th('O2 Route')}${th('O2 %')}${th('Lung Sounds')}${th('Tx Needed')}${th('Suction')}
      </tr></thead>
      <tbody>
        ${rows.map(v => `<tr>${td(v.time)}${td(v.temp)}${td(v.hr)}${td(v.rr)}${td(v.skin)}${td(v.o2Flow)}${td(v.o2Route)}${td(v.o2Percent)}${td(v.lungSounds)}${td(v.txNeeded)}${td(v.suction)}</tr>`).join('')}
      </tbody>
    </table>`
}

// Time and Intake Amt only ever hold a short fixed-format value (a clock
// time; a number with maybe a unit abbreviation like "30 mL") so they stay
// narrow — the freed-up room goes to Type/Route/the Output columns instead.
const IO_COL_WIDTHS = [10, 20, 12, 16, 14, 14, 14] // Time Type Amt Route Urine BM Emesis
// Divider between the Intake group and the Output group — applied to every
// row (both header rows and every body row) so it reads as one continuous
// rule down the table, not just a header underline.
const IO_DIVIDER = `border-left:2px solid ${BG}`

function ioTable(rows: ProgressNoteHtmlIO[]): string {
  if (rows.length === 0) return `<p style="font-size:11px;color:${SAGE};font-style:italic">No intake/output recorded.</p>`
  const colgroup = `<colgroup>${IO_COL_WIDTHS.map(w => `<col style="width:${w}%">`).join('')}</colgroup>`
  const groupTh = (label: string, divider?: boolean) =>
    `<th colspan="3" style="text-align:center;padding:3px 6px;font-size:8px;text-transform:uppercase;letter-spacing:0.05em;color:${NAVY};font-weight:700;border-bottom:1px solid ${BG};${divider ? IO_DIVIDER : ''}">${label}</th>`
  const th = (label: string, divider?: boolean) =>
    `<th style="text-align:center;padding:4px 6px;font-size:8px;text-transform:uppercase;letter-spacing:0.03em;color:${SAGE};border-bottom:1px solid ${BG};${divider ? IO_DIVIDER : ''}">${label}</th>`
  const td = (v: string | null, divider?: boolean) =>
    `<td style="padding:4px 6px;font-size:10px;color:${NAVY};text-align:center;border-bottom:1px solid ${OFFWHITE};${divider ? IO_DIVIDER : ''}">${cell(v)}</td>`
  return `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      ${colgroup}
      <thead>
        <tr>
          <th rowspan="2" style="text-align:center;padding:4px 6px;font-size:8px;text-transform:uppercase;letter-spacing:0.03em;color:${SAGE};border-bottom:1px solid ${BG}">Time</th>
          ${groupTh('Intake')}
          ${groupTh('Output', true)}
        </tr>
        <tr>
          ${th('Type')}${th('Amt')}${th('Route')}
          ${th('Urine', true)}${th('BM')}${th('Emesis')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `<tr>${td(r.time)}${td(r.intakeType)}${td(r.intakeAmt)}${td(r.intakeRoute)}${td(r.outputUrine, true)}${td(r.outputBM)}${td(r.outputEmesis)}</tr>`).join('')}
      </tbody>
    </table>`
}

function signatureBlock(name: string, role: string, signatureUrl: string, signedAt: Date | string): string {
  return `
    <div style="margin-top:8px">
      <img src="${signatureUrl}" alt="Signature" style="max-height:36px;max-width:160px;width:auto;height:auto;display:block" />
      <p style="margin:6px 0 0;font-size:10px;color:${SAGE}">
        Signed electronically by <strong style="color:${NAVY}">${esc(name)}${role === 'admin' ? ' (admin)' : ''}</strong> on ${fmtDateTime(signedAt)}
      </p>
    </div>`
}

export function buildProgressNoteHtml(data: ProgressNoteHtmlData): string {
  const section = (title: string, body: string) => `
    <div style="margin-bottom:16px;border:1px solid ${BG};border-radius:6px;padding:12px;break-inside:avoid">
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${NAVY}">${title}</p>
      ${body}
    </div>`

  // Same box styling as section() above, but two side by side — a 16px
  // gutter between them, matching the 16px margin-bottom/gap used everywhere
  // else in this template.
  const twoColumnSection = (leftTitle: string, leftBody: string, rightTitle: string, rightBody: string) => `
    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div style="flex:1;min-width:0;border:1px solid ${BG};border-radius:6px;padding:12px;break-inside:avoid">
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${NAVY}">${leftTitle}</p>
        ${leftBody}
      </div>
      <div style="flex:1;min-width:0;border:1px solid ${BG};border-radius:6px;padding:12px;break-inside:avoid">
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${NAVY}">${rightTitle}</p>
        ${rightBody}
      </div>
    </div>`

  // Only shown when present — a patient without a secondary insurance or
  // current PA shouldn't render a wall of "—" placeholders.
  const detailRow = (label: string, value: string | null) => value ? `
      <div style="margin-bottom:8px"><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">${label}</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${esc(value)}</p></div>` : ''

  const patientDetailRows = [
    detailRow('Dx 1', data.dxCode1),
    detailRow('Dx 2', data.dxCode2),
    detailRow('Primary Insurance', data.insuranceName),
    detailRow('Primary Insurance ID', data.insuranceId),
    detailRow('Secondary Insurance', data.ins2Name),
    detailRow('Secondary Insurance ID', data.ins2Id),
    detailRow('Current PA #', data.paNumber),
  ].join('')
  const patientDetailsBody = patientDetailRows || `<p style="font-size:11px;color:${SAGE};font-style:italic">No additional patient details on file.</p>`

  const voidedBanner = data.voidedAt ? `
    <div style="margin-bottom:16px;border:1px solid #fca5a5;background:#fef2f2;border-radius:6px;padding:12px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#b91c1c">Voided</p>
      <p style="margin:4px 0 0;font-size:10px;color:#dc2626">Voided ${fmtDateTime(data.voidedAt)}${data.voidReason ? ` — ${esc(data.voidReason)}` : ''}</p>
    </div>` : ''

  // Only a not-yet-signed preview render hits this — every real (signed)
  // export always has both signedAt and signatureUrl.
  const isSigned = !!(data.signedAt && data.signatureUrl)
  const draftBanner = !isSigned ? `
    <div style="margin-bottom:16px;border:1px solid #fcd34d;background:#fffbeb;border-radius:6px;padding:12px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#92400e">Draft — Not Yet Signed</p>
      <p style="margin:4px 0 0;font-size:10px;color:#b45309">This copy is for review only and is not a final clinical record until signed.</p>
    </div>` : ''
  const signatureSection = isSigned
    ? section('Signature', signatureBlock(data.authorDisplayName, data.authorRole, data.signatureUrl as string, data.signedAt as Date | string))
    : section('Signature', `<p style="margin:0;font-size:11px;color:${SAGE};font-style:italic">Not yet signed.</p>`)

  const addendaHtml = data.addenda.length > 0 ? `
    <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${NAVY}">Addenda</p>
    ${data.addenda.map(a => `
      <div style="margin-bottom:12px;border:1px solid ${BG};background:${OFFWHITE};border-radius:6px;padding:12px;break-inside:avoid">
        <p style="margin:0 0 6px;font-size:10px;color:${SAGE}">
          <strong style="color:${NAVY}">${esc(a.authorDisplayName)}${a.authorRole === 'admin' ? ' (admin)' : ''}</strong> — ${fmtDateTime(a.signedAt)}
        </p>
        <p style="margin:0 0 8px;font-size:11px;color:${NAVY};white-space:pre-wrap">${esc(a.text)}</p>
        <img src="${a.signatureUrl}" alt="Addendum signature" style="max-height:30px;max-width:130px;width:auto;height:auto;display:block" />
      </div>`).join('')}` : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0.15in 0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif">

  <div style="padding:0 0.1in">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <p style="margin:0;font-size:18px;font-weight:700;color:${NAVY}">Progress Note</p>
        <p style="margin:2px 0 0;font-size:11px;color:${SAGE}">Coming Home Care</p>
      </div>
      <div style="text-align:right">
        <p style="margin:0;font-size:13px;font-weight:700;color:${NAVY}">${esc(data.patientName)}</p>
        <p style="margin:2px 0 0;font-size:10px;font-family:monospace;color:${SAGE}">Account: ${esc(data.patientAccountNumber)}</p>
      </div>
    </div>

    ${draftBanner}
    ${voidedBanner}

    ${twoColumnSection('Shift Details', `
      <div style="display:flex;flex-wrap:wrap;gap:16px">
        <div><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">Service Date</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${fmtDate(data.serviceDate)}</p></div>
        <div><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">Shift Start</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${cell(data.shiftStartTime)}</p></div>
        <div><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">Shift End</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${cell(data.shiftEndTime)}</p></div>
        <div><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">Total Hours</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${data.totalHours ?? '—'}</p></div>
        <div><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">Location</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${cell(data.location)}</p></div>
      </div>
      <p style="margin:8px 0 0;font-size:10px;color:${SAGE}">Authored by ${esc(data.authorDisplayName)}${data.authorRole === 'admin' ? ' (admin)' : ''}</p>
    `, 'Patient Details', patientDetailsBody)}

    ${section('Vitals', vitalsTable(data.vitals))}
    ${section('Intake / Output', ioTable(data.intakeOutput))}

    ${section('Arrival Findings', `<p style="margin:0;font-size:11px;color:${NAVY};white-space:pre-wrap">${cell(data.arrivalFindings)}</p>`)}
    ${section('Shift Notes', `<p style="margin:0;font-size:11px;color:${NAVY};white-space:pre-wrap;line-height:1.5">${cell(data.shiftNotes)}</p>`)}

    ${signatureSection}

    ${addendaHtml}
  </div>

</body>
</html>`
}
