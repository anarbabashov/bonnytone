import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword, needsRehash, hashPassword } from '@/lib/auth/crypto'
import { createSession } from '@/lib/auth/session'
import { setAccessTokenCookie, setRefreshTokenCookie, setSessionCookie } from '@/lib/auth/cookies'
import { 
  checkRateLimit, 
  loginLimiterIP,
  loginLimiterEmail,
  getClientIp, 
  penalizeFailedLogin, 
  resetLoginAttempts 
} from '@/lib/auth/rates'
import { logAuthEvent } from '@/lib/observability'
import { authMetrics, timeAuthRequest } from '@/lib/observability/metrics'
import { verifyTOTPCode, decryptMFASecret } from '@/lib/auth/mfa'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return timeAuthRequest('/api/auth/login', 'POST', async () => {
    const ip = getClientIp(request)
    
    try {
    // Parse and validate request body
    const body = await request.json()
    const result = loginSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.format() },
        { status: 400 }
      )
    }

    const { email, password, mfaCode } = result.data
    const emailLower = email.toLowerCase()

    // Check rate limits for this email and IP (matching security contracts)
    const [emailRateLimit, ipRateLimit] = await Promise.all([
      checkRateLimit(loginLimiterEmail, emailLower),
      checkRateLimit(loginLimiterIP, ip),
    ])

    if (!emailRateLimit.success || !ipRateLimit.success) {
      authMetrics.httpResponse(429, '/api/auth/login')
      authMetrics.rateLimitHit('login', emailRateLimit.success ? 'ip' : 'email')
      
      return NextResponse.json(
        { error: 'Too many failed login attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        email: true,
        displayName: true,
        passwordHash: true,
        emailVerifiedAt: true,
        isBlocked: true,
        mfaEnabled: true,
        mfaSecretEnc: true,
      },
    })

    // Verify user exists and password is correct
    if (!user || !user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      await penalizeFailedLogin(emailLower, ip)
      
      // Emit metrics
      authMetrics.loginFailed('invalid_credentials')
      authMetrics.httpResponse(401, '/api/auth/login')
      
      // Log failed login
      logAuthEvent('login_failed', user?.id, undefined, ip, { 
        email: emailLower, 
        reason: 'invalid_credentials' 
      })

      // Record login attempt
      await prisma.loginAttempt.create({
        data: {
          email: emailLower,
          ip,
          outcome: 'invalid_credentials',
        },
      })

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if user is blocked
    if (user.isBlocked) {
      authMetrics.loginFailed('user_blocked')
      authMetrics.httpResponse(403, '/api/auth/login')
      
      logAuthEvent('login_failed', user.id, undefined, ip, { 
        email: emailLower, 
        reason: 'user_blocked' 
      })

      await prisma.loginAttempt.create({
        data: {
          email: emailLower,
          ip,
          outcome: 'user_blocked',
        },
      })

      return NextResponse.json(
        { error: 'Account is blocked. Please contact support.' },
        { status: 403 }
      )
    }

    // Handle MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return NextResponse.json(
          { error: 'MFA code is required', requiresMFA: true },
          { status: 400 }
        )
      }

      if (!user.mfaSecretEnc) {
        logAuthEvent('login_failed', user.id, undefined, ip, {
          email: emailLower,
          reason: 'mfa_secret_missing'
        })
        
        return NextResponse.json(
          { error: 'MFA configuration error. Please contact support.' },
          { status: 500 }
        )
      }

      try {
        const decryptedSecret = decryptMFASecret(user.mfaSecretEnc, user.id)
        
        if (!verifyTOTPCode(decryptedSecret, mfaCode)) {
          await penalizeFailedLogin(emailLower, ip)
          
          authMetrics.loginFailed('invalid_mfa_code')
          authMetrics.mfaEvent('verify_fail')
          authMetrics.httpResponse(401, '/api/auth/login')
          
          logAuthEvent('login_failed', user.id, undefined, ip, {
            email: emailLower,
            reason: 'invalid_mfa_code'
          })
          
          return NextResponse.json(
            { error: 'Invalid MFA code' },
            { status: 401 }
          )
        }
      } catch (error) {
        logAuthEvent('login_failed', user.id, undefined, ip, {
          email: emailLower,
          reason: 'mfa_verification_error'
        })
        
        return NextResponse.json(
          { error: 'MFA verification failed' },
          { status: 500 }
        )
      }
    }

    // Reset failed login attempts
    await resetLoginAttempts(emailLower, ip)

    // Check if password needs rehashing with improved parameters
    if (needsRehash(user.passwordHash)) {
      try {
        const newPasswordHash = await hashPassword(password)
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newPasswordHash },
        })
        
        logAuthEvent('password_rehashed', user.id, undefined, ip, {
          email: user.email,
        })
      } catch (error) {
        // Don't fail login if rehashing fails, just log it
        console.error('Password rehash failed:', error)
      }
    }

    // Create session
    const userAgent = request.headers.get('user-agent') || undefined
    const sessionInfo = await createSession(user.id, ip, userAgent)

    // Set cookies and return token in JSON body (per spec)
    const response = NextResponse.json({
      token: sessionInfo.accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    })

    setAccessTokenCookie(response, sessionInfo.accessToken)
    setRefreshTokenCookie(response, sessionInfo.refreshToken)
    setSessionCookie(response, sessionInfo.sessionId)

    // Emit success metrics
    authMetrics.loginSuccess('password', 'user')
    authMetrics.sessionEvent('created')
    if (user.mfaEnabled) {
      authMetrics.mfaEvent('verify_success')
    }
    authMetrics.httpResponse(200, '/api/auth/login')
    
    // Log successful login
    logAuthEvent('login_success', user.id, sessionInfo.sessionId, ip, {
      email: user.email,
    })

    // Record successful login attempt
    await prisma.loginAttempt.create({
      data: {
        email: emailLower,
        ip,
        outcome: 'success',
      },
    })

    return response

    } catch (error) {
      console.error('Login error:', error)
      authMetrics.httpResponse(500, '/api/auth/login')
      
      logAuthEvent('login_failed', undefined, undefined, ip, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}