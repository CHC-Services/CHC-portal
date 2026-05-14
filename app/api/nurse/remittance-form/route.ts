import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import path from 'path'
import fs from 'fs'
import { verifyToken } from '../../../../lib/auth'

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  const session = token ? verifyToken(token) : null

  if (!session || !['nurse', 'provider'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { firstName, lastName, npiNumber, etin, epacesUserId } = await req.json()

  const pdfPath = path.join(process.cwd(), 'public', 'Electronic_Remittance BLANK.pdf')
  const pdfBytes = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const form = pdfDoc.getForm()

  const today = new Date()
  const submissionDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`

  function fillField(name: string, value: string) {
    try {
      const field = form.getTextField(name)
      field.setText(value || '')
    } catch {
      // field not found — skip
    }
  }

  fillField('Text Box 1', `${firstName || ''} ${lastName || ''}`.trim())
  fillField('Text Box 2', npiNumber || '')
  // Text Box 3 = MMIS Provider ID — leave blank (atypical providers only)
  fillField('Text Box 4', etin || '')
  fillField('Text Box 5', submissionDate)
  fillField('Text Box 6', epacesUserId || '')
  // Text Box 5_2 (email) and Text Box 5_3 (printed name) — omit (already prefilled on form)

  form.flatten()

  const filledBytes = await pdfDoc.save()
  const buffer = Buffer.from(filledBytes)

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Electronic_Remittance_Enrollment.pdf"',
    },
  })
}
