// Canonical Progress Note packet HTML — this is the ONE template used for
// print/PDF export. Do not fork this markup elsewhere; add a caller instead.
// Mirrors lib/invoiceHtml.ts's conventions (inline styles throughout — no
// external/`<style>` CSS, since that's the safest path through Puppeteer's
// HTML-to-PDF renderer).

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
  arrivalFindings: string | null
  shiftNotes: string | null
  signedAt: Date | string
  signatureUrl: string
  voidedAt: Date | string | null
  voidReason: string | null
  vitals: ProgressNoteHtmlVital[]
  intakeOutput: ProgressNoteHtmlIO[]
  addenda: ProgressNoteHtmlAddendum[]
}

const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const fmtDateTime = (d: Date | string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cell = (v: string | null) => esc(v || '—')

// Small running strip repeated on every page by Puppeteer's own pagination
// (see lib/generateInvoicePdf.ts's displayHeaderFooter option) — this is
// what stands in for the paper form's repeated, page-numbered continuation
// pages, without needing to model "pages" as data.
export function buildProgressNoteHeaderTemplate(patientName: string, serviceDate: Date | string): string {
  return `
    <div style="font-family:Arial,sans-serif;font-size:8px;color:${SAGE};width:100%;padding:0 0.25in;display:flex;justify-content:space-between">
      <span>${esc(patientName)} — Progress Note</span>
      <span>${fmtDate(serviceDate)}</span>
    </div>`
}

export function buildProgressNoteFooterTemplate(): string {
  return `
    <div style="font-family:Arial,sans-serif;font-size:8px;color:${SAGE};width:100%;padding:0 0.25in;text-align:center">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>`
}

function vitalsTable(rows: ProgressNoteHtmlVital[]): string {
  if (rows.length === 0) return `<p style="font-size:11px;color:${SAGE};font-style:italic">No vitals recorded.</p>`
  const th = (label: string) => `<th style="text-align:left;padding:4px 6px;font-size:8px;text-transform:uppercase;letter-spacing:0.03em;color:${SAGE};border-bottom:1px solid ${BG}">${label}</th>`
  const td = (v: string | null) => `<td style="padding:4px 6px;font-size:10px;color:${NAVY};border-bottom:1px solid ${OFFWHITE}">${cell(v)}</td>`
  return `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        ${th('Time')}${th('Temp')}${th('HR')}${th('RR')}${th('Skin')}${th('O2 Flow')}${th('O2 Route')}${th('O2 %')}${th('Lung Sounds')}${th('Tx Needed')}${th('Suction')}
      </tr></thead>
      <tbody>
        ${rows.map(v => `<tr>${td(v.time)}${td(v.temp)}${td(v.hr)}${td(v.rr)}${td(v.skin)}${td(v.o2Flow)}${td(v.o2Route)}${td(v.o2Percent)}${td(v.lungSounds)}${td(v.txNeeded)}${td(v.suction)}</tr>`).join('')}
      </tbody>
    </table>`
}

function ioTable(rows: ProgressNoteHtmlIO[]): string {
  if (rows.length === 0) return `<p style="font-size:11px;color:${SAGE};font-style:italic">No intake/output recorded.</p>`
  const th = (label: string) => `<th style="text-align:left;padding:4px 6px;font-size:8px;text-transform:uppercase;letter-spacing:0.03em;color:${SAGE};border-bottom:1px solid ${BG}">${label}</th>`
  const td = (v: string | null) => `<td style="padding:4px 6px;font-size:10px;color:${NAVY};border-bottom:1px solid ${OFFWHITE}">${cell(v)}</td>`
  return `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        ${th('Time')}${th('Intake Type')}${th('Intake Amt')}${th('Intake Route')}${th('Output Urine')}${th('Output BM')}${th('Output Emesis')}
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>${td(r.time)}${td(r.intakeType)}${td(r.intakeAmt)}${td(r.intakeRoute)}${td(r.outputUrine)}${td(r.outputBM)}${td(r.outputEmesis)}</tr>`).join('')}
      </tbody>
    </table>`
}

function signatureBlock(name: string, role: string, signatureUrl: string, signedAt: Date | string): string {
  return `
    <div style="margin-top:8px">
      <img src="${signatureUrl}" alt="Signature" style="max-height:70px;display:block" />
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

  const voidedBanner = data.voidedAt ? `
    <div style="margin-bottom:16px;border:1px solid #fca5a5;background:#fef2f2;border-radius:6px;padding:12px">
      <p style="margin:0;font-size:11px;font-weight:700;color:#b91c1c">Voided</p>
      <p style="margin:4px 0 0;font-size:10px;color:#dc2626">Voided ${fmtDateTime(data.voidedAt)}${data.voidReason ? ` — ${esc(data.voidReason)}` : ''}</p>
    </div>` : ''

  const addendaHtml = data.addenda.length > 0 ? `
    <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${NAVY}">Addenda</p>
    ${data.addenda.map(a => `
      <div style="margin-bottom:12px;border:1px solid ${BG};background:${OFFWHITE};border-radius:6px;padding:12px;break-inside:avoid">
        <p style="margin:0 0 6px;font-size:10px;color:${SAGE}">
          <strong style="color:${NAVY}">${esc(a.authorDisplayName)}${a.authorRole === 'admin' ? ' (admin)' : ''}</strong> — ${fmtDateTime(a.signedAt)}
        </p>
        <p style="margin:0 0 8px;font-size:11px;color:${NAVY};white-space:pre-wrap">${esc(a.text)}</p>
        <img src="${a.signatureUrl}" alt="Addendum signature" style="max-height:56px;display:block" />
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

    ${voidedBanner}

    ${section('Shift Details', `
      <div style="display:flex;flex-wrap:wrap;gap:16px">
        <div><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">Service Date</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${fmtDate(data.serviceDate)}</p></div>
        <div><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">Shift Start</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${cell(data.shiftStartTime)}</p></div>
        <div><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">Shift End</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${cell(data.shiftEndTime)}</p></div>
        <div><p style="margin:0;font-size:8px;text-transform:uppercase;color:${SAGE}">Total Hours</p><p style="margin:2px 0 0;font-size:11px;color:${NAVY}">${data.totalHours ?? '—'}</p></div>
      </div>
      <p style="margin:8px 0 0;font-size:10px;color:${SAGE}">Authored by ${esc(data.authorDisplayName)}${data.authorRole === 'admin' ? ' (admin)' : ''}</p>
    `)}

    ${section('Vitals', vitalsTable(data.vitals))}
    ${section('Intake / Output', ioTable(data.intakeOutput))}

    ${section('Arrival Findings', `<p style="margin:0;font-size:11px;color:${NAVY};white-space:pre-wrap">${cell(data.arrivalFindings)}</p>`)}
    ${section('Shift Notes', `<p style="margin:0;font-size:11px;color:${NAVY};white-space:pre-wrap;line-height:1.5">${cell(data.shiftNotes)}</p>`)}

    ${section('Signature', signatureBlock(data.authorDisplayName, data.authorRole, data.signatureUrl, data.signedAt))}

    ${addendaHtml}
  </div>

</body>
</html>`
}
