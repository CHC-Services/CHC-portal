import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx')

const REPORT_START = new Date('2026-01-01T00:00:00Z')
const REPORT_END   = new Date('2026-04-20T00:00:00Z')

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token  = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch nurses + their entries in the date window ──────────────────────
  const nurses = await prisma.nurseProfile.findMany({
    select: {
      id: true,
      displayName: true,
      firstName: true,
      timeEntries: {
        where: { workDate: { gte: REPORT_START, lte: REPORT_END } },
        select: { workDate: true, hours: true },
      },
    },
  })

  // Sort by first name (fall back to displayName)
  nurses.sort((a: { firstName: string | null; displayName: string }, b: { firstName: string | null; displayName: string }) => {
    const aName = (a.firstName || a.displayName || '').toLowerCase()
    const bName = (b.firstName || b.displayName || '').toLowerCase()
    return aName.localeCompare(bName)
  })

  // ── Build lookup: nurseId → dateKey → total hours ─────────────────────────
  const lookup = new Map<string, Map<string, number>>()
  for (const nurse of nurses) {
    const byDate = new Map<string, number>()
    for (const e of nurse.timeEntries) {
      const key = new Date(e.workDate).toISOString().slice(0, 10)
      byDate.set(key, (byDate.get(key) || 0) + e.hours)
    }
    lookup.set(nurse.id, byDate)
  }

  // ── Generate date list Jan 1 → Apr 20 ────────────────────────────────────
  const dates: Date[] = []
  const cursor = new Date(REPORT_START)
  while (cursor <= REPORT_END) {
    dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // ── Build 2-D array ───────────────────────────────────────────────────────
  const colLabels = nurses.map((n: { firstName: string | null; displayName: string }) =>
    n.firstName || n.displayName
  )
  const header = ['Date', ...colLabels]

  const rows = dates.map(date => {
    const key   = date.toISOString().slice(0, 10)
    const label = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
    return [
      label,
      ...nurses.map((n: { id: string }) => lookup.get(n.id)?.get(key) ?? ''),
    ]
  })

  const aoa = [header, ...rows]

  // ── Build worksheet ───────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Style every cell: 8pt Arial, centered (except column A = left-aligned)
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < aoa[r].length; c++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      if (!ws[ref]) continue
      ws[ref].s = {
        font: { name: 'Arial', sz: 8, bold: r === 0 },
        alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
        ...(r === 0
          ? { fill: { fgColor: { rgb: '2F3E4E' }, patternType: 'solid' }, font: { name: 'Arial', sz: 8, bold: true, color: { rgb: 'FFFFFF' } } }
          : {}),
      }
    }
  }

  // Column widths (characters): date col wider, nurse cols narrow
  ws['!cols'] = [
    { wch: 6 },
    ...nurses.map(() => ({ wch: 4.5 })),
  ]

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }

  // Page setup: landscape, fit to 1 page wide
  ws['!printSetup'] = {
    paperSize: 1,           // US Letter
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  }

  // Very narrow margins (inches)
  ws['!margins'] = { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0, footer: 0 }

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Time Report Jan–Apr 2026')

  const buf: Uint8Array = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellStyles: true })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="CHC-Time-Report-2026.xlsx"',
    },
  })
}
