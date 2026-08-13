import { NextResponse } from 'next/server'
import { getOrCreateCarcCodesPdf } from '../../../../../lib/carcPdf'

// GET — public, stable link for the CARC code list PDF. Meant to be pasted
// once into an FAQ item's answer (as an inline link or citation — see
// app/components/FaqEditorSection.tsx) and keep working indefinitely: the
// underlying S3 object is generated once and cached by a fixed key, but the
// presigned URL it resolves to expires in 15 minutes, so this route
// regenerates a fresh one on every hit rather than the caller linking
// straight to S3. No auth — the public FAQ page (app/faq/page.tsx) itself
// requires none, so a link embedded in it can't require any either.
export async function GET() {
  const { url } = await getOrCreateCarcCodesPdf()
  return NextResponse.redirect(url)
}
