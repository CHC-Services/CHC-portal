import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
import { sendNewClaimAlert } from '../../../../../lib/sendEmail'

// Must stay in sync with EDI route — controls which direction stage can move
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
  'Rejected': 5,
  'Paid': 10,
  'Denied': 10,
}

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

function parseDate(val: string): Date | null {
  if (!val || val.trim() === '') return null
  const d = new Date(val.trim())
  return isNaN(d.getTime()) ? null : d
}

function parseFloat2(val: string): number | null {
  if (!val || val.trim() === '') return null
  const n = parseFloat(val.replace(/[$,]/g, ''))
  return isNaN(n) ? null : n
}

export async function POST(req: Request) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { rows } = body as { rows: Record<string, string>[] }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  // Build provider name → nurseId lookup using providerAliases
  const profiles = await prisma.nurseProfile.findMany({
    select: { id: true, displayName: true, firstName: true, lastName: true, providerAliases: true }
  })

  function findNurse(providerName: string): string | null {
    if (!providerName) return null
    const lower = providerName.toLowerCase().trim()
    return profiles.find(p => {
      const full = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().trim()
      const display = (p.displayName || '').toLowerCase().trim()
      const aliases = (p.providerAliases || []).map((a: string) => a.toLowerCase().trim())
      return full === lower || display === lower || aliases.includes(lower)
    })?.id ?? null
  }

  let created = 0
  let updated = 0
  let skipped = 0

  for (const row of rows) {
    const providerName = row['Provider Name'] || ''
    const nurseId = findNurse(providerName)

    if (!nurseId) {
      skipped++
      continue
    }

    const claimId = row['Claim ID'] || null

    const data = {
      nurseId,
      claimId,
      providerName:        providerName || null,
      dosStart:            parseDate(row['DOS Start'] || ''),
      dosStop:             parseDate(row['DOS Stop'] || ''),
      totalBilled:         parseFloat2(row['Total Billed'] || ''),
      claimStage:          row['Claim Stage'] || null,
      primaryPayer:        row['Primary Payer'] || null,
      primaryAllowedAmt:   parseFloat2(row['Primary Allowed Amt'] || ''),
      primaryPaidAmt:      parseFloat2(row['Primary Paid Amt'] || ''),
      primaryPaidDate:     parseDate(row['Primary Paid Date'] || ''),
      primaryPaidTo:       row['Primary Paid To'] || null,
      secondaryPayer:      row['Secondary Payer'] || null,
      secondaryAllowedAmt: parseFloat2(row['Secondary Allowed Amt'] || ''),
      secondaryPaidAmt:    parseFloat2(row['Secondary Paid Amt'] || ''),
      secondaryPaidDate:   parseDate(row['Secondary Paid Date'] || ''),
      secondaryPaidTo:     row['Secondary Paid To'] || null,
      totalReimbursed:     parseFloat2(row['Total Reimbursed'] || ''),
      remainingBalance:    parseFloat2(row['Remaining Balance'] || ''),
      dateFullyFinalized:  parseDate(row['Date Fully Finalized'] || ''),
      processingNotes:     row['Processing Notes'] || null,
    }

    if (claimId) {
      const existing = await prisma.claim.findFirst({ where: { claimId, nurseId } })
      if (existing) {
        // Don't let CSV overwrite a stage that EDI already advanced to a higher priority
        const csvPriority = STAGE_PRIORITY[data.claimStage || ''] ?? 0
        const existingPriority = STAGE_PRIORITY[existing.claimStage || ''] ?? 0
        const safeStage = csvPriority >= existingPriority ? data.claimStage : existing.claimStage

        // Don't let CSV wipe notes that EDI wrote — only update notes if none exist yet
        const safeNotes = existing.processingNotes || data.processingNotes

        await prisma.claim.update({
          where: { id: existing.id },
          data: { ...data, claimStage: safeStage, processingNotes: safeNotes },
        })
        updated++
      } else {
        const newClaim = await prisma.claim.create({ data })
        created++
        fireClaimAlert(nurseId, newClaim)
      }
    } else {
      const newClaim = await prisma.claim.create({ data })
      created++
      fireClaimAlert(nurseId, newClaim)
    }
  }

  return NextResponse.json({ ok: true, created, updated, skipped })
}

async function fireClaimAlert(nurseId: string, claim: { claimId: string | null; dosStart: Date | null; dosStop: Date | null; totalBilled: number | null }) {
  try {
    // Check global bulk import mode — if ON, queue instead of sending immediately
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'bulkImportMode' } })
    if (setting?.value === 'true') {
      if (claim.claimId) {
        await prisma.pendingNotification.create({
          data: {
            nurseId,
            type: 'claim',
            payload: {
              claimId: claim.claimId,
              dosStart: claim.dosStart?.toISOString() ?? null,
              dosStop: claim.dosStop?.toISOString() ?? null,
              totalBilled: claim.totalBilled,
            },
          },
        })
      }
      return
    }

    const profile = await prisma.nurseProfile.findUnique({
      where: { id: nurseId },
      include: { user: { select: { email: true } } },
    })
    if (!profile?.notifyNewClaim || !profile.user?.email || !claim.claimId) return
    sendNewClaimAlert({
      nurseEmail: profile.user.email,
      nurseName: profile.displayName,
      claimId: claim.claimId,
      dosStart: claim.dosStart,
      dosStop: claim.dosStop,
      totalBilled: claim.totalBilled,
    }).catch(() => {})
  } catch {
    // fire-and-forget — never block the import
  }
}
