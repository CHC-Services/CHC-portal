import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '../../../../lib/prisma'
import { verifyToken } from '../../../../lib/auth'
import { sendWelcomeEmail } from '../../../../lib/sendEmail'

async function generateAccountNumber(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2) // e.g. "26"
  const prefix = yy // accounts look like 26001, 26002, ...

  // Find the highest existing sequence number for this year
  const last = await (prisma.nurseProfile.findFirst as any)({
    where: { accountNumber: { startsWith: prefix } },
    orderBy: { accountNumber: 'desc' },
    select: { accountNumber: true },
  })

  const lastSeq = last?.accountNumber ? parseInt(last.accountNumber.slice(2), 10) : 0
  const nextSeq = String(lastSeq + 1).padStart(3, '0')
  return `${prefix}${nextSeq}`
}

export async function POST(req: Request) {
  try {
    const { email, password, role, name, displayName } = await req.json()

    const userCount = await prisma.user.count()

    if (userCount > 0) {
      const cookie = req.headers.get('cookie') || ''
      const token = cookie.split('auth_token=').pop()?.split(';')[0]
      const session = token ? verifyToken(token) : null

      if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const hashed = await bcrypt.hash(password, 10)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (prisma.user.create as any)({
      data: {
        email,
        password: hashed,
        name: name || email,
        role: role === 'admin' ? 'admin' : 'nurse',
        nurseProfile:
          role === 'nurse'
            ? { create: { displayName: displayName || email, accountNumber: await generateAccountNumber() } }
            : undefined
      },
      select: { id: true, email: true, role: true, nurseProfile: { select: { id: true } } }
    })

    if (role === 'nurse') {
      sendWelcomeEmail({
        to: email,
        displayName: displayName || email,
        email,
        password,
      })
    }

    return NextResponse.json(user)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Register error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
