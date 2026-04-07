import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

export const maxDuration = 60 // seconds — requires Vercel Pro or higher

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

  // ── 1. Load nurse profiles ────────────────────────────────────────────────
  const profiles = await prisma.nurseProfile.findMany({
    select: {
      id: true, displayName: true, firstName: true, lastName: true,
      providerAliases: true, notifyNewClaim: true,
      user: { select: { email: true } },
    },
  })

  // Build in-memory nurse lookup (no per-row DB call)
  type Profile = typeof profiles[number]
  function findNurse(providerName: string): Profile | null {
    if (!providerName) return null
    const lower = providerName.toLowerCase().trim()
    return profiles.find(p => {
      const full = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().trim()
      const display = (p.displayName || '').toLowerCase().trim()
      const aliases = (p.providerAliases || []).map((a: string) => a.toLowerCase().trim())
      return full === lower || display === lower || aliases.includes(lower)
    }) ?? null
  }

  // ── 2. Parse every row into typed data ────────────────────────────────────
  type RowData = {
    nurseId: string
    profile: Profile
    claimId: string | null
    data: Record<string, any>
  }

  const parsed: RowData[] = []
  let skipped = 0

  for (const row of rows) {
    const providerName = row['Provider Name'] || ''
    const profile = findNurse(providerName)
    if (!profile) { skipped++; continue }

    parsed.push({
      nurseId: profile.id,
      profile,
      claimId: row['Claim ID'] || null,
      data: {
        nurseId:             profile.id,
        claimId:             row['Claim ID'] || null,
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
      },
    })
  }

  // ── 3. Fetch all potentially existing claims in ONE query ─────────────────
  const claimIds = parsed.map(r => r.claimId).filter(Boolean) as string[]
  const nurseIds  = [...new Set(parsed.map(r => r.nurseId))]

  const existingClaims = claimIds.length > 0
    ? await prisma.claim.findMany({
        where: { claimId: { in: claimIds }, nurseId: { in: nurseIds } },
        select: { id: true, claimId: true, nurseId: true, claimStage: true, processingNotes: true },
      })
    : []

  // Build lookup: "claimId|nurseId" → existing record
  const existingMap = new Map(existingClaims.map(c => [`${c.claimId}|${c.nurseId}`, c]))

  // ── 4. Separate into creates vs updates ───────────────────────────────────
  type NewClaim = { nurseId: string; claimId: string | null; dosStart: Date | null; dosStop: Date | null; totalBilled: number | null; profile: Profile }
  const toCreate: RowData[] = []
  const toUpdate: { id: string; data: Record<string, any> }[] = []

  for (const row of parsed) {
    if (row.claimId) {
      const existing = existingMap.get(`${row.claimId}|${row.nurseId}`)
      if (existing) {
        const csvPriority = STAGE_PRIORITY[row.data.claimStage || ''] ?? 0
        const existingPriority = STAGE_PRIORITY[existing.claimStage || ''] ?? 0
        toUpdate.push({
          id: existing.id,
          data: {
            ...row.data,
            claimStage: csvPriority >= existingPriority ? row.data.claimStage : existing.claimStage,
            processingNotes: existing.processingNotes || row.data.processingNotes,
          },
        })
      } else {
        toCreate.push(row)
      }
    } else {
      toCreate.push(row)
    }
  }

  // ── 5. Bulk create + parallel update ─────────────────────────────────────
  // createMany = single INSERT statement (much faster than N parallel creates)
  const [createResult] = await Promise.all([
    (prisma.claim.createMany as any)({ data: toCreate.map(r => r.data), skipDuplicates: true }),
    // Limit update concurrency to 5 at a time to stay within connection pool limits
    (async () => {
      for (let i = 0; i < toUpdate.length; i += 5) {
        await Promise.all(toUpdate.slice(i, i + 5).map(u =>
          prisma.claim.update({ where: { id: u.id }, data: u.data })
        ))
      }
    })(),
  ])

  const created: number = createResult.count ?? toCreate.length
  const updated = toUpdate.length

  // ── 6. Queue notifications — built from in-memory data (no extra DB round-trip) ──
  const toQueue = toCreate.filter(r => r.claimId)
  if (toQueue.length > 0) {
    await prisma.pendingNotification.createMany({
      data: toQueue.map(r => ({
        nurseId: r.nurseId,
        type: 'claim',
        payload: {
          claimId: r.claimId!,
          dosStart: r.data.dosStart?.toISOString?.() ?? null,
          dosStop:  r.data.dosStop?.toISOString?.()  ?? null,
          totalBilled: r.data.totalBilled ?? null,
        },
      })),
    })
  }

  const affectedNurseIds = [...new Set(toQueue.map(r => r.nurseId))]

  return NextResponse.json({ ok: true, created, updated, skipped, affectedNurseIds })
}
