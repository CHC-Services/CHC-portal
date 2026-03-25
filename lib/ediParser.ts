// ─── EDI / Availity Clearinghouse File Parser ────────────────────────────────
// Handles Availity's pipe-delimited EBR, DPR, and IBR formats.
// Deliberately skips all PHI fields (patient name, member ID, payer claim #).
// Only extracts: your internal claim ID, payer name, date, status, error info.

export type EdiClaimResult = {
  claimId: string
  payerName: string | null
  submittedDate: string | null     // YYYY-MM-DD
  status: 'accepted' | 'warning' | 'rejected' | 'unknown'
  errorCode: string | null
  errorMessage: string | null
  billedAmount: number | null
  sourceFile: string
  fileType: 'EBR' | 'DPR' | 'IBR' | 'UNKNOWN'
}

export type EdiParseResult = {
  claims: EdiClaimResult[]
  skipped: boolean   // true if file type is not parseable (IBT, EBT, DPT, 99T, etc.)
  fileType: string
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function parseEdiFile(filename: string, content: string): EdiParseResult {
  const base = filename.split('/').pop() || filename
  const ext = base.split('.').pop()?.toLowerCase() || ''

  // Human-readable text reports — skip, same data as machine-readable counterparts
  if (['ibt', 'ebt', 'dpt', 'ibtp'].includes(ext)) {
    return { claims: [], skipped: true, fileType: ext.toUpperCase() }
  }

  // Functional acknowledgments — no claim data
  if (ext === '99t') {
    return { claims: [], skipped: true, fileType: '99T' }
  }

  // 277 X12 EDI format — same data as IBR/EBR in simpler formats, skip for now
  if (['277ibr', '277dpr', '277ebr', '277ibrp', 'ibrp'].includes(ext)) {
    return { claims: [], skipped: true, fileType: '277' }
  }

  if (ext === 'ebr' || base.startsWith('EBR-')) {
    return { claims: parseEBR(content, base), skipped: false, fileType: 'EBR' }
  }

  if (ext === 'dpr' || base.startsWith('DPR-')) {
    return { claims: parseDPR(content, base), skipped: false, fileType: 'DPR' }
  }

  if (ext === 'ibr' || base.startsWith('IBR-')) {
    return { claims: parseIBR(content, base), skipped: false, fileType: 'IBR' }
  }

  return { claims: [], skipped: true, fileType: ext.toUpperCase() }
}

// ─── EBR Parser ───────────────────────────────────────────────────────────────
// Row 1: file header  (pos 1 = date YYYY-MM-DD)
// Row 2: payer block  (pos 1 = payer name)
// Row 3: claim line   (pos 4 = claimId, pos 5 = billedAmt)  ← skip pos 1 (patient)
// Row 3c: status      (pos 2 = status code, pos 3 = error code, pos 4 = error msg)

function parseEBR(content: string, filename: string): EdiClaimResult[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const results: EdiClaimResult[] = []

  let payerName: string | null = null
  let submittedDate: string | null = null
  let current: Partial<EdiClaimResult> | null = null

  for (const line of lines) {
    const p = line.split('|')

    if (p[0] === '1') {
      submittedDate = p[1] || null  // "2026-03-24"

    } else if (p[0] === '2') {
      payerName = p[1] || null

      // Flush previous claim when payer block resets (multi-payer files)
      if (current?.claimId) {
        results.push(current as EdiClaimResult)
        current = null
      }

    } else if (p[0] === '3') {
      // Flush previous claim
      if (current?.claimId) results.push(current as EdiClaimResult)

      const claimId = p[4]
      if (!claimId || claimId === 'NA' || claimId === '') continue

      current = {
        claimId,
        payerName,
        submittedDate,
        status: 'accepted',  // default; overridden by 3c row
        errorCode: null,
        errorMessage: null,
        billedAmount: p[5] ? parseFloat(p[5]) : null,
        sourceFile: filename,
        fileType: 'EBR',
      }

    } else if (p[0] === '3c' && current) {
      const code = p[2]?.trim()
      const errCode = p[3] !== 'NA' && p[3] ? p[3] : null
      const errMsg  = p[4] !== 'NA' && p[4] ? p[4].replace(/\|.*$/, '').trim() : null

      current.errorCode = errCode
      current.errorMessage = errMsg

      if (code === 'A') current.status = 'accepted'
      else if (code === 'W') current.status = 'warning'
      else if (code === 'R') current.status = 'rejected'
      else current.status = 'unknown'
    }
  }

  if (current?.claimId) results.push(current as EdiClaimResult)
  return results
}

// ─── DPR Parser ───────────────────────────────────────────────────────────────
// Row DPR: file header
// Row CST: claim status transaction
//   pos 2 = claimId, pos 7 = billedAmt, pos 8 = date YYYYMMDD
//   pos 9 = status message (^-delimited; first segment is status code A/W/R)
//   pos 11 = ACK/NACK, pos 15 = payer name
//   Skipped: pos 5 = patient name, pos 12 = payer claim #

function parseDPR(content: string, filename: string): EdiClaimResult[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const results: EdiClaimResult[] = []

  for (const line of lines) {
    const p = line.split('|')
    if (p[0] !== 'CST') continue

    const claimId = p[2]
    if (!claimId || claimId === 'NA') continue

    // Date at pos 8 is YYYYMMDD → convert to YYYY-MM-DD
    const rawDate = p[8] || ''
    const submittedDate = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate || null

    // Status code is first '^'-delimited segment in pos 9
    const statusParts = (p[9] || '').split('^')
    const statusCode = statusParts[0]?.trim()
    const ackType    = p[11]?.trim()  // ACK / NACK

    let status: EdiClaimResult['status'] = 'unknown'
    if (statusCode === 'A' || ackType === 'ACK') status = 'accepted'
    else if (statusCode === 'W') status = 'warning'
    else if (statusCode === 'R' || ackType === 'NACK') status = 'rejected'

    // Extract a readable message from the status block (strip Category: boilerplate)
    const msgBlock = statusParts.find(s => s.includes('Status:'))
    const errorMessage = msgBlock
      ? msgBlock.replace('Status:', '').trim()
      : (statusParts[2]?.trim() || null)

    results.push({
      claimId,
      payerName: p[15] || null,
      submittedDate,
      status,
      errorCode: null,
      errorMessage: status !== 'accepted' ? errorMessage : null,
      billedAmount: p[7] ? parseFloat(p[7]) : null,
      sourceFile: filename,
      fileType: 'DPR',
    })
  }

  return results
}

// ─── IBR Parser ───────────────────────────────────────────────────────────────
// Row 1: header   (pos 1 = date YYYY-MM-DD)
// Row 2: payer    (pos 1 = payer name)
// Row 3: claim    (pos 4 = claimId, pos 5 = billedAmt, last pos = status A/W/R)
// Skipped: pos 1 = patient name

function parseIBR(content: string, filename: string): EdiClaimResult[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const results: EdiClaimResult[] = []

  let payerName: string | null = null
  let submittedDate: string | null = null

  for (const line of lines) {
    const p = line.split('|')

    if (p[0] === '1') {
      submittedDate = p[1] || null
    } else if (p[0] === '2') {
      payerName = p[1] || null
    } else if (p[0] === '3') {
      const claimId = p[4]
      if (!claimId || claimId === 'NA') continue

      // Status is last non-empty field
      const statusCode = p.filter(Boolean).pop()?.trim()
      let status: EdiClaimResult['status'] = 'unknown'
      if (statusCode === 'A') status = 'accepted'
      else if (statusCode === 'W') status = 'warning'
      else if (statusCode === 'R') status = 'rejected'

      results.push({
        claimId,
        payerName,
        submittedDate,
        status,
        errorCode: null,
        errorMessage: null,
        billedAmount: p[5] ? parseFloat(p[5]) : null,
        sourceFile: filename,
        fileType: 'IBR',
      })
    }
  }

  return results
}

// ─── Deduplication ────────────────────────────────────────────────────────────
// If the same claimId appears in multiple files, prefer the most informative:
// EBR (has error detail) > DPR > IBR, and rejected/warning > accepted

const FILE_TYPE_PRIORITY: Record<string, number> = { EBR: 3, DPR: 2, IBR: 1, UNKNOWN: 0 }
const STATUS_PRIORITY: Record<string, number> = { rejected: 3, warning: 2, accepted: 1, unknown: 0 }

export function deduplicateResults(results: EdiClaimResult[]): EdiClaimResult[] {
  const map = new Map<string, EdiClaimResult>()

  for (const r of results) {
    const existing = map.get(r.claimId)
    if (!existing) {
      map.set(r.claimId, r)
      continue
    }

    const newPriority =
      FILE_TYPE_PRIORITY[r.fileType] * 10 + STATUS_PRIORITY[r.status]
    const oldPriority =
      FILE_TYPE_PRIORITY[existing.fileType] * 10 + STATUS_PRIORITY[existing.status]

    if (newPriority > oldPriority) map.set(r.claimId, r)
  }

  return Array.from(map.values())
}
