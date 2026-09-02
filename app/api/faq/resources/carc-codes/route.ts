import { NextResponse } from 'next/server'
import { getOrCreateCarcCodesPdf } from '../../../../../lib/carcPdf'

// Puppeteer launching headless Chromium + rendering can run past Vercel's
// default serverless timeout — matters here more than most PDF routes since
// this one is public and un-cached hits (first load, or after a force-
// regenerate) still do the full render inline.
export const maxDuration = 60

// GET — public, stable link for the CARC code list PDF. Meant to be pasted
// once into an FAQ item's answer (as an inline link or citation — see
// app/components/FaqEditorSection.tsx) and keep working indefinitely: the
// underlying S3 object is generated once and cached by a fixed key, but the
// presigned URL it resolves to expires in 15 minutes, so this route
// regenerates a fresh one on every hit rather than the caller linking
// straight to S3. No auth — the public FAQ page (app/faq/page.tsx) itself
// requires none, so a link embedded in it can't require any either.
export async function GET() {
  try {
    const { url } = await getOrCreateCarcCodesPdf()
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('CARC codes PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate the CARC codes PDF. Please try again.' }, { status: 500 })
  }
}
