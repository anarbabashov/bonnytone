import { NextRequest, NextResponse } from 'next/server'
import { ResetDto } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/crypto'
import { verifyAndConsumeEmailActionToken } from '@/lib/auth/tokens'
import { revokeAllUserSessions } from '@/lib/auth/session'
import { checkRateLimit, passwordResetLimiter, getClientIp } from '@/lib/auth/rates'
import { logAuthEvent } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  
  try {
    // Rate limiting
    const rateLimit = await checkRateLimit(passwordResetLimiter, ip)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const result = ResetDto.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.format() },
        { status: 400 }
      )
    }

    const { token, newPassword } = result.data

    // Verify and consume token
    const tokenData = await verifyAndConsumeEmailActionToken(token, 'password_reset')
    
    if (!tokenData) {
      logAuthEvent('password_reset_failed', undefined, undefined, ip, { 
        reason: 'invalid_token' 
      })
      
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 400 }
      )
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        email: true,
        isBlocked: true,
      },
    })

    if (!user) {
      logAuthEvent('password_reset_failed', tokenData.userId, undefined, ip, { 
        reason: 'user_not_found' 
      })
      
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.isBlocked) {
      logAuthEvent('password_reset_failed', user.id, undefined, ip, { 
        reason: 'user_blocked' 
      })
      
      return NextResponse.json(
        { error: 'Account is blocked' },
        { status: 403 }
      )
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword)

    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    // Revoke all existing sessions for security
    await revokeAllUserSessions(user.id)

    // Log successful password reset (per spec: auth.reset_password)
    logAuthEvent('auth.reset_password', user.id, undefined, ip, {
      email: user.email,
    })

    return NextResponse.json({
      message: 'Password reset successful. Please log in with your new password.',
    })

  } catch (error) {
    console.error('Password reset error:', error)
    logAuthEvent('password_reset_failed', undefined, undefined, ip, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}