import { NextRequest, NextResponse } from 'next/server'
import { ChangeEmailConfirmDto } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { verifyAndConsumeEmailActionToken } from '@/lib/auth/tokens'
import { revokeAllUserSessions } from '@/lib/auth/session'
import { getClientIp } from '@/lib/auth/rates'
import { logAuthEvent } from '@/lib/observability'
import { sendEmail } from '@/lib/auth/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  
  try {
    // Parse request body first, then fallback to query params
    let token: string
    
    try {
      const body = await request.json()
      const result = ChangeEmailConfirmDto.safeParse(body)
      
      if (result.success) {
        token = result.data.token
      } else {
        // Fallback to query params for GET requests
        const { searchParams } = new URL(request.url)
        const queryToken = searchParams.get('token')
        
        if (!queryToken) {
          return NextResponse.json(
            { error: 'Confirmation token is required' },
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
          { error: 'Confirmation token is required' },
          { status: 400 }
        )
      }
      
      token = queryToken
    }

    // Verify and consume token
    const tokenData = await verifyAndConsumeEmailActionToken(token, 'change_email')
    
    if (!tokenData || !tokenData.targetEmail) {
      logAuthEvent('email_change_confirm_failed', undefined, undefined, ip, { 
        reason: 'invalid_token' 
      })
      
      return NextResponse.json(
        { error: 'Invalid or expired confirmation token' },
        { status: 400 }
      )
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        email: true,
        isBlocked: true,
      },
    })

    if (!user) {
      logAuthEvent('email_change_confirm_failed', tokenData.userId, undefined, ip, { 
        reason: 'user_not_found' 
      })
      
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.isBlocked) {
      logAuthEvent('email_change_confirm_failed', user.id, undefined, ip, { 
        reason: 'user_blocked' 
      })
      
      return NextResponse.json(
        { error: 'Account is blocked' },
        { status: 403 }
      )
    }

    // Check if new email is already taken (race condition protection)
    const existingUser = await prisma.user.findUnique({
      where: { email: tokenData.targetEmail },
    })

    if (existingUser && existingUser.id !== user.id) {
      logAuthEvent('email_change_confirm_failed', user.id, undefined, ip, { 
        reason: 'email_taken',
        newEmail: tokenData.targetEmail,
      })
      
      return NextResponse.json(
        { error: 'Email is already in use' },
        { status: 409 }
      )
    }

    const oldEmail = user.email

    // Update user email and reset email verification
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        email: tokenData.targetEmail,
        emailVerifiedAt: new Date(), // New email is considered verified
      },
    })

    // Send notification to old email address (per spec)
    try {
      await sendEmail('email_changed_notification', oldEmail, {
        oldEmail: oldEmail,
        newEmail: tokenData.targetEmail,
      })
    } catch (error) {
      // Don't fail the email change if notification fails, just log it
      console.error('Failed to send email change notification:', error)
    }

    // Revoke all sessions for security
    await revokeAllUserSessions(user.id)

    // Log successful email change
    logAuthEvent('email_change_confirm_success', user.id, undefined, ip, {
      oldEmail: oldEmail,
      newEmail: tokenData.targetEmail,
    })

    return NextResponse.json({
      message: 'Email changed successfully. Please log in again with your new email.',
    })

  } catch (error) {
    console.error('Email change confirm error:', error)
    logAuthEvent('email_change_confirm_failed', undefined, undefined, ip, { 
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