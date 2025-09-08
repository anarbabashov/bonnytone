import { NextRequest, NextResponse } from 'next/server'
import { ChangeEmailInitDto } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { verifyPassword } from '@/lib/auth/crypto'
import { createEmailActionToken, revokeUserTokens } from '@/lib/auth/tokens'
import { sendEmail } from '@/lib/auth/email'
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

    // Rate limiting
    const rateLimit = await checkRateLimit(emailLimiter, tokenPayload.sub)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many email change attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const result = ChangeEmailInitDto.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.format() },
        { status: 400 }
      )
    }

    const { newEmail } = result.data
    const newEmailLower = newEmail.toLowerCase()

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      select: {
        id: true,
        email: true,
        passwordHash: true,
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

    // Check if new email is the same as current
    if (user.email === newEmailLower) {
      return NextResponse.json(
        { error: 'New email must be different from current email' },
        { status: 400 }
      )
    }

    // Check if new email is already taken
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmailLower },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email is already in use' },
        { status: 409 }
      )
    }

    // Revoke existing email change tokens
    await revokeUserTokens(user.id, 'change_email')

    // Create email change token
    const changeToken = await createEmailActionToken({
      userId: user.id,
      type: 'change_email',
      expiresInMinutes: 60, // 1 hour
      targetEmail: newEmailLower,
    })

    // Send confirmation email to new address
    const emailSent = await sendEmail('email_change_confirm', newEmailLower, {
      oldEmail: user.email,
      newEmail: newEmailLower,
      token: changeToken,
    })

    if (!emailSent) {
      console.error('Failed to send email change confirmation')
      return NextResponse.json(
        { error: 'Failed to send confirmation email. Please try again later.' },
        { status: 500 }
      )
    }

    // Log email change initiation
    logAuthEvent('email_change_init_success', user.id, tokenPayload.sid, ip, {
      currentEmail: user.email,
      newEmail: newEmailLower,
    })

    return NextResponse.json({
      message: `Confirmation email sent to ${newEmailLower}. Please check your inbox and click the confirmation link.`,
    })

  } catch (error) {
    console.error('Email change init error:', error)
    logAuthEvent('email_change_init_failed', undefined, undefined, ip, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}