import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { generateMFASecret, generateMFAQRCodeUrl, encryptMFASecret } from '@/lib/auth/mfa'
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
    const rateLimit = await checkRateLimit(generalApiLimiter, tokenPayload.sub)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      select: {
        id: true,
        email: true,
        mfaEnabled: true,
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

    // Generate MFA secret
    const mfaSecret = generateMFASecret()
    
    // Encrypt the secret for storage (using user ID as encryption key)
    const encryptedSecret = encryptMFASecret(mfaSecret, user.id)
    
    // Store encrypted secret temporarily (will be confirmed in the next step)
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecretEnc: encryptedSecret },
    })

    // Generate QR code URL for authenticator apps
    const qrCodeUrl = generateMFAQRCodeUrl(mfaSecret, user.email)

    // Log MFA setup initiation
    logAuthEvent('mfa_setup_init', user.id, tokenPayload.sid, ip, {
      email: user.email,
    })

    return NextResponse.json({
      secret: mfaSecret,
      qrCodeUrl,
      message: 'MFA secret generated. Please scan the QR code with your authenticator app and confirm with a code.',
    })

  } catch (error) {
    console.error('MFA setup error:', error)
    logAuthEvent('mfa_setup_failed', undefined, undefined, ip, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}