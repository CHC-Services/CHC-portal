import { prisma } from './prisma'

// A nurse's spendable account balance is the running sum of their
// ProviderCredit rows tagged 'account_balance' — positive entries are
// overpayment credits, negative entries are prior spends against the balance.
export async function getAccountBalance(nurseId: string): Promise<number> {
  const result = await (prisma.providerCredit.aggregate as any)({
    where: { nurseId, type: 'account_balance' },
    _sum: { amount: true },
  })
  return result._sum.amount || 0
}
