import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    return null
  }
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    })
  } catch {
    console.warn('Failed to initialize Prisma client — auth features disabled')
    return null
  }
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  createPrismaClient() as PrismaClient

if (process.env.NODE_ENV !== 'production' && prisma) globalForPrisma.prisma = prisma
