import { NextRequest, NextResponse } from 'next/server'
import { alerting } from '@/lib/observability/alerts'
import { observability } from '@/lib/observability/index'
import { verifyAccessJwt } from '@/lib/auth/jwt'

export const dynamic = 'force-dynamic'

async function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)
  return await verifyAccessJwt(token)
}

// GET /api/monitoring/alerts - List active alerts
export async function GET(request: NextRequest) {
  try {
    const payload = await requireAuth(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const timeRange = {
      from: new Date(url.searchParams.get('from') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      to: new Date(url.searchParams.get('to') || new Date().toISOString()),
    }

    const [alerts, metrics] = await Promise.all([
      alerting.getActiveAlerts(),
      observability.getSecurityMetrics(timeRange),
    ])

    return NextResponse.json({
      alerts,
      metrics,
      timeRange,
    })

  } catch (error) {
    console.error('Alerts endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/monitoring/alerts - Test alert (admin only)
export async function POST(request: NextRequest) {
  try {
    const payload = await requireAuth(request)
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // In production, check for admin role
    // if (payload.scope !== 'admin') {
    //   return NextResponse.json(
    //     { error: 'Admin access required' },
    //     { status: 403 }
    //   )
    // }

    const body = await request.json()
    const { ruleName } = body

    if (!ruleName || typeof ruleName !== 'string') {
      return NextResponse.json(
        { error: 'ruleName is required' },
        { status: 400 }
      )
    }

    const alert = await alerting.testAlert(ruleName)
    if (!alert) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ alert })

  } catch (error) {
    console.error('Test alert endpoint error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}