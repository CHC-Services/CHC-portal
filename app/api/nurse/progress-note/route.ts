import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { isPaidSubscriber } from '../../../../lib/planPermissions'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null
  if (!session || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await (prisma.nurseProfile.findUnique as any)({
    where: { id: session.nurseProfileId },
    select: { displayName: true, planTier: true, trialExpiresAt: true },
  })
  if (!profile || !isPaidSubscriber(profile.planTier, profile.trialExpiresAt)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const url = new URL(req.url)
  const patientName    = url.searchParams.get('patientName') || ''
  const patientId      = url.searchParams.get('patientId') || ''
  const dos            = url.searchParams.get('dos') || ''
  const hrIn           = url.searchParams.get('hrIn') || ''
  const hrOut          = url.searchParams.get('hrOut') || ''
  const totalHr        = url.searchParams.get('totalHr') || ''
  const arrivalFindings = url.searchParams.get('arrivalFindings') || ''
  const nurseName      = profile.displayName || ''

  const pdfPath = path.join(process.cwd(), 'public', 'Progress-Note-BLANK.pdf')
  const pdfBytes = await fs.readFile(pdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const form = pdfDoc.getForm()

  function setText(fieldName: string, value: string) {
    try { form.getTextField(fieldName).setText(value) } catch { /* field absent — skip */ }
  }

  setText('Patient Name1', patientName)
  setText('Patient Name2', patientName)
  setText('Patient Name3', patientName)
  setText('Patient ID', patientId)
  setText('DOS1', dos)
  setText('DOS2', dos)
  setText('DOS3', dos)
  setText('Hr In', hrIn)
  setText('Hr Out', hrOut)
  setText('Total Hr', totalHr)
  setText('Nurse Name', nurseName)
  if (arrivalFindings) setText('Arrival Findings', arrivalFindings)

  const filled = await pdfDoc.save()
  const safeDate = dos.replace(/\//g, '-') || 'blank'

  return new Response(Buffer.from(filled), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Progress-Note-${safeDate}.pdf"`,
    },
  })
}
