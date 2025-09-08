import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { revokeSession } from '@/lib/auth/session'
import { getAccessTokenFromRequest, getSessionIdFromRequest, clearAuthCookies } from '@/lib/auth/cookies'
import { logAuthEvent } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get access token and session ID
    const accessToken = getAccessTokenFromRequest(request)
    const sessionId = getSessionIdFromRequest(request)
    
    let userId: string | undefined
    
    // Try to get user ID from access token if available
    if (accessToken) {
      const tokenPayload = await verifyAccessToken(accessToken)
      if (tokenPayload) {
        userId = tokenPayload.sub
      }
    }

    // Revoke session if we have a session ID
    if (sessionId) {
      await revokeSession(sessionId)
    }

    // Clear cookies
    const response = NextResponse.json({
      message: 'Logged out successfully',
    })
    
    clearAuthCookies(response)

    // Log logout event
    logAuthEvent('logout', userId, sessionId || undefined)

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