import { NextRequest, NextResponse } from 'next/server'
import { registerSchema } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/crypto'
import { createEmailActionToken } from '@/lib/auth/tokens'
import { sendEmail } from '@/lib/auth/email'
import { checkRateLimit, registerLimiterIP, registerLimiterEmail, getClientIp } from '@/lib/auth/rates'
import { logAuthEvent } from '@/lib/observability'
import { authMetrics, timeAuthRequest } from '@/lib/observability/metrics'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return timeAuthRequest('/api/auth/register', 'POST', async () => {
    const ip = getClientIp(request)
    
    try {
    // Parse and validate request body first
    const body = await request.json()
    const result = registerSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.format() },
        { status: 400 }
      )
    }

    const { email, password, displayName } = result.data

    // Rate limiting (matching security contracts: 3/min/IP, 10/day/email)
    const [ipRateLimit, emailRateLimit] = await Promise.all([
      checkRateLimit(registerLimiterIP, ip),
      checkRateLimit(registerLimiterEmail, email.toLowerCase()),
    ])
    
    if (!ipRateLimit.success || !emailRateLimit.success) {
      authMetrics.httpResponse(429, '/api/auth/register')
      authMetrics.rateLimitHit('register', ipRateLimit.success ? 'email' : 'ip')
      
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      authMetrics.registerFailed('email_exists')
      authMetrics.httpResponse(409, '/api/auth/register')
      
      logAuthEvent('register_failed', undefined, undefined, ip, { 
        email, 
        reason: 'email_exists' 
      })
      
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        displayName,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
      },
    })

    // Create verification token
    const verificationToken = await createEmailActionToken({
      userId: user.id,
      type: 'verify_email',
      expiresInMinutes: 1440, // 24 hours
    })

    // Send verification email
    await sendEmail('verify_email', user.email, {
      token: verificationToken,
      displayName: user.displayName,
    })

    // Emit success metrics
    authMetrics.registerSuccess('email')
    authMetrics.emailSent('verify_email', process.env.EMAIL_PROVIDER || 'dev')
    authMetrics.httpResponse(201, '/api/auth/register')

    // No auto-login until email is verified (per spec)
    const response = NextResponse.json({
      ok: true,
      message: 'Registration successful. Please check your email to verify your account.',
    }, { status: 201 })

    // Log successful registration (no session created yet)
    logAuthEvent('register_success', user.id, undefined, ip, {
      email: user.email,
    })

    return response

    } catch (error) {
      console.error('Registration error:', error)
      authMetrics.registerFailed('internal_error')
      authMetrics.httpResponse(500, '/api/auth/register')
      
      logAuthEvent('register_failed', undefined, undefined, ip, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}