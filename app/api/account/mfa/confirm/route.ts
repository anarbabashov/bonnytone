import { NextRequest, NextResponse } from 'next/server'
import { mfaConfirmSchema } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { decryptMFASecret, verifyTOTPCode } from '@/lib/auth/mfa'
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

    if (user.mfaEnabled) {
      return NextResponse.json(
        { error: 'MFA is already enabled' },
        { status: 400 }
      )
    }

    if (!user.mfaSecretEnc) {
      return NextResponse.json(
        { error: 'MFA setup not initiated. Please call /mfa/setup first.' },
        { status: 400 }
      )
    }

    // Decrypt the MFA secret
    const mfaSecret = decryptMFASecret(user.mfaSecretEnc, user.id)

    // Verify the TOTP code
    const isValidCode = verifyTOTPCode(mfaSecret, token)
    
    if (!isValidCode) {
      logAuthEvent('mfa_confirm_failed', user.id, tokenPayload.sid, ip, {
        reason: 'invalid_code',
      })
      
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Enable MFA for the user
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true },
    })

    // Log successful MFA setup
    logAuthEvent('mfa_setup_success', user.id, tokenPayload.sid, ip, {
      email: user.email,
    })

    return NextResponse.json({
      message: 'MFA enabled successfully. Your account is now secured with two-factor authentication.',
    })

  } catch (error) {
    console.error('MFA confirm error:', error)
    logAuthEvent('mfa_confirm_failed', undefined, undefined, ip, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}