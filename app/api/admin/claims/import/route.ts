import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

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

  // Build nurse name → id lookup
  const profiles = await prisma.nurseProfile.findMany({
    select: { id: true, displayName: true, firstName: true, lastName: true }
  })

  function findNurse(name: string): string | null {
    if (!name) return null
    const lower = name.toLowerCase().trim()
    return profiles.find(p => {
      const full = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().trim()
      const display = (p.displayName || '').toLowerCase().trim()
      return full === lower || display === lower || display.includes(lower) || lower.includes(display)
    })?.id ?? null
  }

  let created = 0
  let updated = 0
  let skipped = 0

  for (const row of rows) {
    const nurseName = row['Nurse Name'] || row['nurse_name'] || row['NurseName'] || ''
    const nurseId = findNurse(nurseName)

    if (!nurseId) {
      skipped++
      continue
    }

    const claimCtrlId = row['Claim Ctrl ID'] || row['claim_ctrl_id'] || null

    const data: Record<string, unknown> = {
      nurseId,
      claimCtrlId,
      transId:          row['Trans ID'] || null,
      submitStatus:     row['Submit Status'] || null,
      submitDate:       parseDate(row['Submit Date'] || ''),
      status:           row['Status'] || null,
      dosStart:         parseDate(row['DOS Start'] || ''),
      dosStop:          parseDate(row['DOS Stop'] || ''),
      hoursBilled:      parseFloat2(row['Hours Billed'] || ''),
      chargeAmount:     parseFloat2(row['Billed'] || ''),
      allowedAmount:    parseFloat2(row['Allowed'] || ''),
      paidAmount:       parseFloat2(row['BCBS Paid'] || ''),
      remitCheckNumber: row['Remit / Check #'] || row['Remit/Check #'] || null,
      checkAmount:      parseFloat2(row['Check $'] || ''),
      finalizedDate:    parseDate(row['Finalized Date'] || ''),
      eobDate:          parseDate(row['EOB Date'] || ''),
      statusNote:       row['Comments'] || null,
      innOon:           row['INN / OON'] || row['INN/OON'] || null,
      dedCoin:          parseFloat2(row['DED / COIN'] || row['DED/COIN'] || ''),
      allowRate:        parseFloat2(row['Allow Rate'] || ''),
    }

    if (claimCtrlId) {
      // Try to find existing claim by claimCtrlId + nurseId
      const existing = await (prisma.claim.findFirst as any)({
        where: { claimCtrlId, nurseId }
      })

      if (existing) {
        await (prisma.claim.update as any)({
          where: { id: existing.id },
          data
        })
        updated++
      } else {
        await (prisma.claim.create as any)({ data })
        created++
      }
    } else {
      await (prisma.claim.create as any)({ data })
      created++
    }
  }

  return NextResponse.json({ ok: true, created, updated, skipped })
}
