import { prisma } from './prisma'
import { randomUUID } from 'crypto'

interface LoginLogParams {
  accountType: string
  email: string
  firstName?: string | null
  lastName?: string | null
  accountNumber?: string | null
  result: string
  ip?: string | null
}

export async function logLogin(params: LoginLogParams): Promise<void> {
  try {
    await (prisma.loginLog.create as any)({
      data: {
        id: randomUUID(),
        accountType: params.accountType,
        email: params.email,
        firstName: params.firstName ?? null,
        lastName: params.lastName ?? null,
        accountNumber: params.accountNumber ?? null,
        result: params.result,
        ip: params.ip ?? null,
      },
    })
  } catch {
    // Never let logging errors surface to the caller
  }
}

export function getIp(req: Request): string | null {
  const xff = (req as any).headers?.get?.('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const realIp = (req as any).headers?.get?.('x-real-ip')
  return realIp || null
}
