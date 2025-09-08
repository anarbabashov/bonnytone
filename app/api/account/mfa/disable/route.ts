import { NextRequest, NextResponse } from 'next/server'
import { mfaConfirmSchema } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { decryptMFASecret, verifyTOTPCode } from '@/lib/auth/mfa'
import { revokeAllUserSessions } from '@/lib/auth/session'
import { getAccessTokenFromRequest } from '@/lib/auth/cookies'
import { checkRateLimit, generalApiLimiter, getClientIp } from '@/lib/auth/rates'
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

    // Rate limiting
    const rateLimit = await checkRateLimit(generalApiLimiter, tokenPayload.sub, 3)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many MFA attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const result = mfaConfirmSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.format() },
        { status: 400 }
      )
    }

    const { token } = result.data

    // Get user with MFA secret
    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      select: {
        id: true,
        email: true,
        mfaEnabled: true,
        mfaSecretEnc: true,
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
      return NextResponse.json(
        { error: 'Account is blocked' },
        { status: 403 }
      )
    }

    if (!user.mfaEnabled) {
      return NextResponse.json(
        { error: 'MFA is not enabled' },
        { status: 400 }
      )
    }

    if (!user.mfaSecretEnc) {
      return NextResponse.json(
        { error: 'MFA secret not found' },
        { status: 400 }
      )
    }

    // Decrypt the MFA secret
    const mfaSecret = decryptMFASecret(user.mfaSecretEnc, user.id)

    // Verify the TOTP code to confirm identity
    const isValidCode = verifyTOTPCode(mfaSecret, token)
    
    if (!isValidCode) {
      logAuthEvent('mfa_disable_failed', user.id, tokenPayload.sid, ip, {
        reason: 'invalid_code',
      })
      
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Disable MFA and remove secret
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        mfaEnabled: false,
        mfaSecretEnc: null,
      },
    })

    // Revoke all other sessions for security (keep current one)
    const otherSessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        id: { not: tokenPayload.sid },
        revokedAt: null,
      },
      select: { id: true },
    })

    if (otherSessions.length > 0) {
      await Promise.all(
        otherSessions.map(session => 
          prisma.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
          })
        )
      )

      // Also revoke refresh tokens for those sessions
      await prisma.refreshToken.updateMany({
        where: {
          sessionId: { in: otherSessions.map(s => s.id) },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      })
    }

    // Log successful MFA disable
    logAuthEvent('mfa_disable_success', user.id, tokenPayload.sid, ip, {
      email: user.email,
    })

    return NextResponse.json({
      message: 'MFA disabled successfully. Other sessions have been logged out for security.',
    })

  } catch (error) {
    console.error('MFA disable error:', error)
    logAuthEvent('mfa_disable_failed', undefined, undefined, ip, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}