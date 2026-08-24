import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyToken } from '../../../../../lib/auth'

function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const token = cookie.split('auth_token=').pop()?.split(';')[0]
  return token ? verifyToken(token) : null
}

// Standard average typing speed used for the "time saved" ballpark shown
// alongside Micro-Charting Devices — deliberately not trying to model actual
// dictation/recording time, just "how long would typing this much text by
// hand have taken." A rough value-demonstration number, not a scientific one.
const TYPING_WPM = 40

// Estimated minutes saved by dictating instead of typing every note this
// nurse has compiled via Micro-Charting (i.e. any note with at least one
// voice entry) — sums the word count of the AI-compiled shiftNotes text
// across those notes and converts it to "typing time" at TYPING_WPM.
export async function GET(req: Request) {
  const session = getSession(req)
  if (!session || session.role !== 'nurse' || !session.nurseProfileId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const notes = await prisma.progressNote.findMany({
    where: { authorUserId: session.id, voiceEntries: { some: {} } },
    select: { shiftNotes: true },
  })

  const wordCount = notes.reduce((sum, n) => {
    const words = (n.shiftNotes || '').trim().split(/\s+/).filter(Boolean)
    return sum + words.length
  }, 0)

  const minutesSaved = Math.round(wordCount / TYPING_WPM)

  return NextResponse.json({ noteCount: notes.length, wordCount, minutesSaved })
}
