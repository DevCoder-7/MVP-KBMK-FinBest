/**
 * Create a demo account for the existing demo user
 * Username: demo, Password: demo
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const prisma = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  console.log('Creating demo account...')

  const demoUser = await prisma.userProfile.findFirst({
    where: { email: 'demo@finbest.ai' },
  })

  if (!demoUser) {
    console.error('Demo user not found. Run main seed first.')
    process.exit(1)
  }

  const existing = await prisma.account.findUnique({
    where: { username: 'demo' },
  })

  if (existing) {
    console.log('Demo account already exists, updating password...')
    await prisma.account.update({
      where: { username: 'demo' },
      data: { password: hashPassword('demo') },
    })
  } else {
    await prisma.account.create({
      data: {
        username: 'demo',
        password: hashPassword('demo'),
        userId: demoUser.id,
      },
    })
  }

  console.log('Demo account ready:')
  console.log('  Username: demo')
  console.log('  Password: demo')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
