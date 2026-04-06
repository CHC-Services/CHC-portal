import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function adminOnly(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

function parseDate(val: unknown): Date | null | undefined {
  if (val === undefined) return undefined
  if (val === null || val === '') return null
  const d = new Date(String(val))
  return isNaN(d.getTime()) ? null : d
}

function parseNum(val: unknown): number | null | undefined {
  if (val === undefined) return undefined
  if (val === null || val === '') return null
  const n = parseFloat(String(val).replace(/[$,]/g, ''))
  return isNaN(n) ? null : n
}

function parseStr(val: unknown): string | null | undefined {
  if (val === undefined) return undefined
  if (val === null || val === '') return null
  return String(val).trim()
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = adminOnly(req)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  // Build update data — only include keys that were explicitly sent
  const data: Record<string, any> = {}

  if ('resubmissionOf'     in body) data.resubmissionOf     = parseStr(body.resubmissionOf)
  if ('claimId'            in body) data.claimId            = parseStr(body.claimId)
  if ('providerName'       in body) data.providerName       = parseStr(body.providerName)
  if ('dosStart'           in body) data.dosStart           = parseDate(body.dosStart)
  if ('dosStop'            in body) data.dosStop            = parseDate(body.dosStop)
  if ('totalBilled'        in body) data.totalBilled        = parseNum(body.totalBilled)
  if ('claimStage'         in body) data.claimStage         = parseStr(body.claimStage)
  if ('primaryPayer'       in body) data.primaryPayer       = parseStr(body.primaryPayer)
  if ('primaryAllowedAmt'  in body) data.primaryAllowedAmt  = parseNum(body.primaryAllowedAmt)
  if ('primaryPaidAmt'     in body) data.primaryPaidAmt     = parseNum(body.primaryPaidAmt)
  if ('primaryPaidDate'    in body) data.primaryPaidDate    = parseDate(body.primaryPaidDate)
  if ('primaryPaidTo'      in body) data.primaryPaidTo      = parseStr(body.primaryPaidTo)
  if ('secondaryPayer'     in body) data.secondaryPayer     = parseStr(body.secondaryPayer)
  if ('secondaryAllowedAmt'in body) data.secondaryAllowedAmt= parseNum(body.secondaryAllowedAmt)
  if ('secondaryPaidAmt'   in body) data.secondaryPaidAmt   = parseNum(body.secondaryPaidAmt)
  if ('secondaryPaidDate'  in body) data.secondaryPaidDate  = parseDate(body.secondaryPaidDate)
  if ('secondaryPaidTo'    in body) data.secondaryPaidTo    = parseStr(body.secondaryPaidTo)
  if ('totalReimbursed'    in body) data.totalReimbursed    = parseNum(body.totalReimbursed)
  if ('remainingBalance'   in body) data.remainingBalance   = parseNum(body.remainingBalance)
  if ('dateFullyFinalized' in body) data.dateFullyFinalized = parseDate(body.dateFullyFinalized)
  if ('processingNotes'    in body) data.processingNotes    = parseStr(body.processingNotes)

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const claim = await prisma.claim.update({ where: { id }, data })

  return NextResponse.json({ ok: true, claim })
}
