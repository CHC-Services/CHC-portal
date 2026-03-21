import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { createHmac } from 'crypto'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const token = searchParams.get('token')

  if (!id || !token) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }

  const expected = createHmac('sha256', process.env.JWT_SECRET!)
    .update(id)
    .digest('hex')

  if (expected !== token) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  await prisma.nurseProfile.update({
    where: { id },
    data: { receiveNotifications: false },
  })

  // Redirect to the confirmation page
  return NextResponse.redirect(new URL('/unsubscribe?success=1', req.url))
}
