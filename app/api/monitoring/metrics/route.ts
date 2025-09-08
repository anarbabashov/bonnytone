import { NextRequest, NextResponse } from 'next/server'
import { metrics } from '@/lib/observability/metrics'
import { verifyAccessJwt } from '@/lib/auth/jwt'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check for Prometheus scraper or admin access
    const userAgent = request.headers.get('user-agent') || ''
    const isPrometheus = userAgent.includes('Prometheus') || userAgent.includes('prometheus')
    
    // For non-Prometheus requests, require admin authentication
    if (!isPrometheus) {
      const authHeader = request.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      const token = authHeader.slice(7)
      const payload = await verifyAccessJwt(token)
      
      if (!payload) {
        return NextResponse.json(
          { error: 'Invalid token' },
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
    }

    // Get format from query params
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'prometheus'

    if (format === 'json') {
      const jsonMetrics = metrics.getJSONMetrics()
      return NextResponse.json(jsonMetrics)
    }

    // Default: Prometheus format
    const prometheusMetrics = metrics.getPrometheusMetrics()
    
    return new Response(prometheusMetrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    })

  } catch (error) {
    console.error('Metrics endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}