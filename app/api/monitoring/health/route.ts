import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import redis from '@/lib/auth/rates'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; duration?: number }> = {}

  // Database health check
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    checks.database = {
      status: 'ok',
      duration: Date.now() - start,
    }
  } catch (error) {
    checks.database = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database connection failed',
    }
  }

  // Redis health check
  try {
    const start = Date.now()
    await redis.ping()
    checks.redis = {
      status: 'ok',
      duration: Date.now() - start,
    }
  } catch (error) {
    checks.redis = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Redis connection failed',
    }
  }

  // Overall health status
  const allHealthy = Object.values(checks).every(check => check.status === 'ok')
  const status = allHealthy ? 200 : 503

  const response = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
  }

  return NextResponse.json(response, { status })
}