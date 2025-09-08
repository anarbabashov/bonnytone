import { NextRequest, NextResponse } from 'next/server'
import { verifyRefreshToken } from '@/lib/auth/jwt'
import { refreshAccessToken } from '@/lib/auth/session'
import { getRefreshTokenFromRequest } from '@/lib/auth/cookies'
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from '@/lib/auth/cookies'
import { logAuthEvent } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookies
    const refreshTokenJWT = getRefreshTokenFromRequest(request)
    
    if (!refreshTokenJWT) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 }
      )
    }

    // Verify refresh token JWT
    const tokenPayload = await verifyRefreshToken(refreshTokenJWT)
    
    if (!tokenPayload || !tokenPayload.jti) {
      const response = NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      )
      
      clearAuthCookies(response)
      return response
    }

    // Refresh the access token using the token ID
    const tokenResult = await refreshAccessToken(tokenPayload.jti)
    
    if (!tokenResult) {
      const response = NextResponse.json(
        { error: 'Refresh token expired or revoked' },
        { status: 401 }
      )
      
      clearAuthCookies(response)
      
      logAuthEvent('token_refresh_failed', tokenPayload.sub, tokenPayload.sid)
      return response
    }

    // Set new tokens in cookies and return new access token (per spec)
    const response = NextResponse.json({
      token: tokenResult.accessToken,
    })

    setAccessTokenCookie(response, tokenResult.accessToken)
    setRefreshTokenCookie(response, tokenResult.refreshToken)

    logAuthEvent('token_refresh_success', tokenPayload.sub, tokenPayload.sid)

    return response

  } catch (error) {
    console.error('Token refresh error:', error)
    
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
    
    clearAuthCookies(response)
    return response
  }
}