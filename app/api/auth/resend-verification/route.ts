import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { createEmailActionToken, revokeUserTokens } from '@/lib/auth/tokens'
import { sendEmail } from '@/lib/auth/email'
import { getServerUrl } from '@/lib/utils'
import { getAccessTokenFromRequest } from '@/lib/auth/cookies'
import { checkRateLimit, emailLimiter, getClientIp } from '@/lib/auth/rates'
import { logAuthEvent } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  
  try {
    // Get access token from cookies
    const accessToken = getAccessTokenFromRequest(request)
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify access token
    const tokenPayload = await verifyAccessToken(accessToken)
    
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Invalid access token' },
        { status: 401 }
      )
    }

    // Rate limiting by user ID
    const rateLimit = await checkRateLimit(emailLimiter, tokenPayload.sub)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many emails sent. Please try again later.' },
        { status: 429 }
      )
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        isBlocked: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.isBlocked) {
      logAuthEvent('verification_email_failed', user.id, tokenPayload.sid, ip, { 
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

    // Revoke existing verification tokens
    await revokeUserTokens(user.id, 'verify_email')

    // Create new verification token
    const verificationToken = await createEmailActionToken({
      userId: user.id,
      type: 'verify_email',
      expiresInMinutes: 1440, // 24 hours
    })

    // Get server URL for email links
    const serverUrl = getServerUrl(request)

    // Send verification email
    const emailSent = await sendEmail('verify_email', user.email, {
      token: verificationToken,
    }, serverUrl)

    if (!emailSent) {
      console.error('Failed to send verification email')
      return NextResponse.json(
        { error: 'Failed to send email. Please try again later.' },
        { status: 500 }
      )
    }

    // Log verification email sent
    logAuthEvent('verification_email_sent', user.id, tokenPayload.sid, ip, {
      email: user.email,
    })

    return NextResponse.json({
      message: 'Verification email sent. Please check your inbox.',
    })

  } catch (error) {
    console.error('Resend verification error:', error)
    logAuthEvent('verification_email_failed', undefined, undefined, ip, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}