import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { parseEdiFile, deduplicateResults, EdiClaimResult } from '@/lib/ediParser'
import { sendEdiSummaryEmail } from '@/lib/sendEmail'

function adminOnly(req: NextRequest) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Stage priority — don't overwrite a more-resolved stage with an earlier one
const STAGE_PRIORITY: Record<string, number> = {
  'Draft': 0,
  '': 0,
  'INS-1 Submitted': 1,
  'INS-2 Submitted': 2,
  'Resubmitted': 2,
  'Pending': 3,
  'Info Requested': 3,
  'Info Sent': 3,
  'Appealed': 4,
  'Paid': 10,
  'Denied': 10,
  'Rejected': 5,
}

function stageFromStatus(status: EdiClaimResult['status']): string | null {
  if (status === 'accepted') return 'INS-1 Submitted'
  if (status === 'warning' || status === 'rejected') return 'Rejected'
  return null
}

function buildNote(result: EdiClaimResult): string {
  const date = result.submittedDate || 'unknown date'
  const payer = result.payerName || 'unknown payer'
  const file = result.fileType

  if (result.status === 'accepted') {
    return `[${date} · ${file} · ${payer}] Accepted for processing → INS-1 Submitted`
  }
  if (result.status === 'warning' || result.status === 'rejected') {
    const code = result.errorCode ? ` (Error ${result.errorCode})` : ''
    const msg = result.errorMessage ? `: ${result.errorMessage}` : ''
    return `[${date} · ${file} · ${payer}] Rejected${code}${msg}`
  }
  return `[${date} · ${file} · ${payer}] Status unknown`
}

export async function POST(req: NextRequest) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const files = formData.getAll('files') as File[]
  if (!files.length) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
  }

  // ── Parse all files ────────────────────────────────────────────────────────
  const allResults: EdiClaimResult[] = []
  const skippedFiles: string[] = []
  const parsedFiles: string[] = []

  for (const file of files) {
    const content = await file.text()
    const parsed = parseEdiFile(file.name, content)

    if (parsed.skipped) {
      skippedFiles.push(file.name)
    } else {
      parsedFiles.push(file.name)
      allResults.push(...parsed.claims)
    }
  }

  const deduplicated = deduplicateResults(allResults)

  // ── Match against DB claims + update ───────────────────────────────────────
  const matched: { claimId: string; changes: string[] }[] = []
  const unmatched: string[] = []
  // Keep full detail on unmatched for the email report
  const unmatchedDetail: { claimId: string; submittedDate: string | null; status: string; payerName: string | null }[] = []

  for (const result of deduplicated) {
    const claim = await prisma.claim.findFirst({
      where: { claimId: result.claimId },
    })

    if (!claim) {
      unmatched.push(result.claimId)
      unmatchedDetail.push({
        claimId: result.claimId,
        submittedDate: result.submittedDate,
        status: result.status,
        payerName: result.payerName,
      })
      continue
    }

    const changes: string[] = []
    const updateData: Record<string, unknown> = {}

    // ── Stage update (only move forward, never backward) ───────────────────
    const newStage = stageFromStatus(result.status)
    if (newStage) {
      const currentPriority = STAGE_PRIORITY[claim.claimStage || ''] ?? 0
      const newPriority = STAGE_PRIORITY[newStage] ?? 0
      if (newPriority > currentPriority) {
        updateData.claimStage = newStage
        changes.push(`stage → ${newStage}`)
      }
    }

    // ── Append note to processingNotes ─────────────────────────────────────
    const note = buildNote(result)
    const existingNotes = claim.processingNotes || ''
    // Avoid adding duplicate notes for same file
    if (!existingNotes.includes(note)) {
      updateData.processingNotes = existingNotes
        ? `${note}\n${existingNotes}`
        : note
      changes.push('notes updated')
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.claim.update({
        where: { id: claim.id },
        data: updateData,
      })
    }

    matched.push({ claimId: result.claimId, changes })
  }

  const summaryPayload = {
    filesUploaded: files.length,
    filesParsed: parsedFiles.length,
    filesSkipped: skippedFiles.length,
    claimsFound: deduplicated.length,
    claimsMatched: matched.length,
    claimsUnmatched: unmatched.length,
  }

  // Send summary email (fire-and-forget — don't block the response)
  sendEdiSummaryEmail({
    unmatched: unmatchedDetail,
    matched,
    summary: summaryPayload,
  }).catch(() => {})

  return NextResponse.json({
    summary: summaryPayload,
    matched,
    unmatched,
    skippedFiles,
  })
}
