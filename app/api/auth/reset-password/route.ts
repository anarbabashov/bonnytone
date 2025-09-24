import { NextRequest, NextResponse } from 'next/server'
import { ResetDto } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/crypto'
import { verifyEmailActionToken, verifyAndConsumeEmailActionToken } from '@/lib/auth/tokens'
import { revokeAllUserSessions } from '@/lib/auth/session'
import { checkRateLimit, passwordResetLimiter, getClientIp } from '@/lib/auth/rates'
import { logAuthEvent } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)

  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Verify token without consuming it (just check if it's valid)
    const tokenData = await verifyEmailActionToken(token, 'password_reset')

    if (!tokenData) {
      logAuthEvent('password_reset_token_validation_failed', undefined, undefined, ip, {
        reason: 'invalid_token'
      })

      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 400 }
      )
    }

    // Get user details to ensure they still exist and aren't blocked
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        email: true,
        isBlocked: true,
      },
    })

    if (!user) {
      logAuthEvent('password_reset_token_validation_failed', tokenData.userId, undefined, ip, {
        reason: 'user_not_found'
      })

      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.isBlocked) {
      logAuthEvent('password_reset_token_validation_failed', user.id, undefined, ip, {
        reason: 'user_blocked'
      })

      return NextResponse.json(
        { error: 'Account is blocked' },
        { status: 403 }
      )
    }

    // Token is valid
    return NextResponse.json({
      message: 'Token is valid',
      valid: true
    })

  } catch (error) {
    console.error('Token validation error:', error)
    logAuthEvent('password_reset_token_validation_failed', undefined, undefined, ip, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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