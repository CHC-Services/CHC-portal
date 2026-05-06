import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { uploadToS3 } from '../../../../lib/s3'
import { buildBillingAgreementHtml } from '../../../../lib/agreementDocument'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

export async function POST(req: Request) {
  const session = getSession(req)
  if (!session || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { initials } = await req.json()
  if (!initials || initials.trim().length < 1) {
    return NextResponse.json({ error: 'Initials are required' }, { status: 400 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const profile = await (prisma.nurseProfile.findUnique as any)({
    where: { id: session.nurseProfileId },
    select: {
      id: true, displayName: true, firstName: true, lastName: true, accountNumber: true,
      billingAgreementSignedAt: true,
    },
  })

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.billingAgreementSignedAt) {
    return NextResponse.json({ ok: true, alreadySigned: true })
  }

  const signedAt = new Date()
  const yymmdd = signedAt.toISOString().slice(2, 10).replace(/-/g, '')
  const lastName = (profile.lastName || profile.displayName || 'Unknown').replace(/\s+/g, '')
  const acctNum = profile.accountNumber || 'NOACCT'
  const docTitle = `Billing Service Agreement - ${acctNum} ${lastName} - ${yymmdd}`
  const fileName = `billing-agreement-${acctNum}-${lastName}-${yymmdd}.html`.toLowerCase()
  const s3Key = `nurses/${profile.id}/agreements/${fileName}`

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    || profile.displayName || session.displayName || ''

  const html = buildBillingAgreementHtml({
    displayName: fullName,
    accountNumber: acctNum,
    lastName,
    initials: initials.trim().toUpperCase(),
    signedAt,
    ip,
    title: docTitle,
  })

  const htmlBuffer = Buffer.from(html, 'utf-8')
  await uploadToS3(s3Key, htmlBuffer, 'text/html; charset=utf-8')

  await (prisma.nurseProfile.update as any)({
    where: { id: profile.id },
    data: {
      billingAgreementSignedAt: signedAt,
      billingAgreementInitials: initials.trim().toUpperCase(),
    },
  })

  await (prisma.nurseDocument.create as any)({
    data: {
      nurseId: profile.id,
      title: docTitle,
      fileName,
      storageKey: s3Key,
      category: 'Agreement',
      mimeType: 'text/html',
      fileSize: htmlBuffer.length,
      uploadedBy: 'system',
      visibleToNurse: true,
      nurseUploaded: false,
    },
  })

  return NextResponse.json({ ok: true })
}
