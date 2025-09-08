import { NextRequest, NextResponse } from 'next/server'
import { changePasswordSchema } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { hashPassword, verifyPassword } from '@/lib/auth/crypto'
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
    const rateLimit = await checkRateLimit(generalApiLimiter, tokenPayload.sub)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const result = changePasswordSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.format() },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = result.data

    // Get user with current password
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

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Account does not have a password set' },
        { status: 400 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(user.passwordHash, currentPassword)
    
    if (!isCurrentPasswordValid) {
      logAuthEvent('password_change_failed', user.id, tokenPayload.sid, ip, {
        reason: 'invalid_current_password',
      })
      
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    })

    // Revoke all other sessions for security (except current one)
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

    // Log successful password change
    logAuthEvent('password_change_success', user.id, tokenPayload.sid, ip, {
      email: user.email,
    })

    return NextResponse.json({
      message: 'Password changed successfully. Other sessions have been logged out.',
    })

  } catch (error) {
    console.error('Change password error:', error)
    logAuthEvent('password_change_failed', undefined, undefined, ip, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}