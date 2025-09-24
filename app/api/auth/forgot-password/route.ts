import { NextRequest, NextResponse } from 'next/server'
import { forgotPasswordSchema } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { createEmailActionToken, revokeUserTokens } from '@/lib/auth/tokens'
import { sendEmail } from '@/lib/auth/email'
import { getServerUrl } from '@/lib/utils'
import { checkRateLimit, passwordResetLimiter, getClientIp } from '@/lib/auth/rates'
import { logAuthEvent } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  
  try {
    // Parse and validate request body
    const body = await request.json()
    const result = forgotPasswordSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.format() },
        { status: 400 }
      )
    }

    const { email } = result.data
    const emailLower = email.toLowerCase()

    // Rate limiting
    const rateLimit = await checkRateLimit(passwordResetLimiter, ip)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        email: true,
        isBlocked: true,
      },
    })

    if (!user) {
      logAuthEvent('password_reset_attempt', undefined, undefined, ip, {
        email: emailLower,
        reason: 'user_not_found'
      })

      return NextResponse.json({
        error: 'Email not found. Please check your email address or register for a new account.',
        code: 'EMAIL_NOT_FOUND'
      }, { status: 404 })
    }

    // Success response for existing users
    const successResponse = NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    })

    if (user.isBlocked) {
      logAuthEvent('password_reset_attempt', user.id, undefined, ip, { 
        email: emailLower, 
        reason: 'user_blocked' 
      })
      
      return successResponse
    }

    // Revoke existing password reset tokens
    await revokeUserTokens(user.id, 'password_reset')

    // Create new password reset token
    const resetToken = await createEmailActionToken({
      userId: user.id,
      type: 'password_reset',
      expiresInMinutes: 30, // 30 minutes (per spec)
    })

    // Get server URL for email links
    const serverUrl = getServerUrl(request)

    // Send password reset email
    const emailSent = await sendEmail('password_reset', user.email, {
      token: resetToken,
    }, serverUrl)

    if (!emailSent) {
      console.error('Failed to send password reset email')
      return NextResponse.json(
        { error: 'Failed to send email. Please try again later.' },
        { status: 500 }
      )
    }

    // Log password reset request
    logAuthEvent('password_reset_requested', user.id, undefined, ip, {
      email: user.email,
    })

    return successResponse

  } catch (error) {
    console.error('Password reset request error:', error)
    logAuthEvent('password_reset_failed', undefined, undefined, ip, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}