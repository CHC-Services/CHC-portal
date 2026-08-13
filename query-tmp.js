require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  const demo = await prisma.user.findMany({ where: { isDemo: true }, select: { id: true, email: true, role: true } })
  console.log('demo users:', JSON.stringify(demo, null, 2))
  const nurse = await prisma.nurseProfile.findUnique({ where: { id: '511a9ee3-df88-4b7a-9dcb-1b213262c41f' }, select: { id: true, displayName: true, user: { select: { email: true, isDemo: true } } } })
  console.log('Alex nurse:', JSON.stringify(nurse, null, 2))
}
main().finally(() => prisma.$disconnect())
