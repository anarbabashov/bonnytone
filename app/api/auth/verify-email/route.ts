import { NextRequest, NextResponse } from 'next/server'
import { VerifyDto } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { verifyAndConsumeEmailActionToken } from '@/lib/auth/tokens'
import { getClientIp } from '@/lib/auth/rates'
import { logAuthEvent } from '@/lib/observability'
import { createSession } from '@/lib/auth/session'
import { setAccessTokenCookie, setRefreshTokenCookie, setSessionCookie } from '@/lib/auth/cookies'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  
  try {
    // Parse request body first, then fallback to query params
    let token: string
    
    try {
      const body = await request.json()
      const result = VerifyDto.safeParse(body)
      
      if (result.success) {
        token = result.data.token
      } else {
        // Fallback to query params for GET requests
        const { searchParams } = new URL(request.url)
        const queryToken = searchParams.get('token')
        
        if (!queryToken) {
          return NextResponse.json(
            { error: 'Verification token is required' },
            { status: 400 }
          )
        }
        
        token = queryToken
      }
    } catch {
      // Fallback to query params if JSON parsing fails
      const { searchParams } = new URL(request.url)
      const queryToken = searchParams.get('token')
      
      if (!queryToken) {
        return NextResponse.json(
          { error: 'Verification token is required' },
          { status: 400 }
        )
      }
      
      token = queryToken
    }

    // Verify and consume token
    const tokenData = await verifyAndConsumeEmailActionToken(token, 'verify_email')
    
    if (!tokenData) {
      logAuthEvent('email_verification_failed', undefined, undefined, ip, { 
        reason: 'invalid_token' 
      })
      
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      )
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        isBlocked: true,
      },
    })

    if (!user) {
      logAuthEvent('email_verification_failed', tokenData.userId, undefined, ip, { 
        reason: 'user_not_found' 
      })
      
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.isBlocked) {
      logAuthEvent('email_verification_failed', user.id, undefined, ip, { 
        reason: 'user_blocked' 
      })
      
      return NextResponse.json(
        { error: 'Account is blocked' },
        { status: 403 }
      )
    }

    // Check if email is already verified
    if (user.emailVerifiedAt) {
      return NextResponse.json({
        message: 'Email is already verified',
      })
    }

    // Update user to mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    })

    // Create session after successful email verification (happy-path flow)
    const userAgent = request.headers.get('user-agent') || undefined
    const sessionInfo = await createSession(user.id, ip, userAgent)

    // Set cookies and return token
    const response = NextResponse.json({
      message: 'Email verified successfully',
      token: sessionInfo.accessToken,
      user: {
        id: user.id,
        email: user.email,
        emailVerifiedAt: new Date(),
      },
    })

    setAccessTokenCookie(response, sessionInfo.accessToken)
    setRefreshTokenCookie(response, sessionInfo.refreshToken)
    setSessionCookie(response, sessionInfo.sessionId)

    // Log successful email verification with session
    logAuthEvent('email_verification_success', user.id, sessionInfo.sessionId, ip, {
      email: user.email,
    })

    return response

  } catch (error) {
    console.error('Email verification error:', error)
    logAuthEvent('email_verification_failed', undefined, undefined, ip, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Support GET method for email links
export async function GET(request: NextRequest) {
  return POST(request)
}