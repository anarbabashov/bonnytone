import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { revokeSession } from '@/lib/auth/session'
import { getAccessTokenFromRequest, getSessionIdFromRequest, clearAuthCookies } from '@/lib/auth/cookies'
import { logAuthEvent } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get access token from Authorization header or cookies
    let accessToken: string | null = null
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7) // Remove 'Bearer ' prefix
    } else {
      accessToken = getAccessTokenFromRequest(request)
    }

    const sessionId = getSessionIdFromRequest(request)

    let userId: string | undefined
    let sessionIdFromToken: string | undefined

    // Try to get user ID and session ID from access token if available
    if (accessToken) {
      const tokenPayload = await verifyAccessToken(accessToken)
      if (tokenPayload) {
        userId = tokenPayload.sub
        sessionIdFromToken = tokenPayload.sid
      }
    }

    // Revoke session - prefer session ID from token, fall back to cookie
    const sessionToRevoke = sessionIdFromToken || sessionId
    if (sessionToRevoke) {
      await revokeSession(sessionToRevoke)
    }

    // Clear cookies
    const response = NextResponse.json({
      message: 'Logged out successfully',
    })
    
    clearAuthCookies(response)

    // Log logout event
    logAuthEvent('logout', userId, sessionToRevoke || undefined)

    return response

  } catch (error) {
    console.error('Logout error:', error)
    
    // Clear cookies even if there's an error
    const response = NextResponse.json({
      message: 'Logged out successfully',
    })
    
    clearAuthCookies(response)
    return response
  }
}