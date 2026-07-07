import { PrismaClient } from '@prisma/client'
import path from 'path'

function resolveLocalSqliteUrl() {
  const url = process.env.DATABASE_URL
  if (
    url === 'file:../db/custom.db' ||
    url === 'file:./db/custom.db' ||
    url === 'file:/home/z/my-project/db/custom.db'
  ) {
    process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'db/custom.db')}`
  }
}

resolveLocalSqliteUrl()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
