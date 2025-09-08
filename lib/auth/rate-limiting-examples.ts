/**
 * Rate Limiting Examples and Usage Patterns
 * 
 * This file demonstrates how to implement rate limiting in API routes
 * following security best practices with proper 429 responses and Retry-After headers.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  loginLimiterEmail,
  loginLimiterIP,
  registerLimiterIP,
  registerLimiterEmail,
  emailVerificationLimiter,
  emailPasswordResetLimiter,
  emailChangeEmailLimiter,
  checkRateLimitWithResponse,
  createRateLimitResponse,
  getClientIp,
  penalizeFailedLogin,
  resetLoginAttempts
} from './rates'

/**
 * Example 1: Login Rate Limiting (5/min per email)
 * Implements sliding window with proper 429 + Retry-After responses
 */
export async function loginRateLimitExample(request: NextRequest) {
  const ip = getClientIp(request)
  const { email } = await request.json() as { email: string }
  const emailLower = email.toLowerCase()

  // Check both email and IP rate limits
  const [emailResult, ipResult] = await Promise.all([
    checkRateLimitWithResponse(
      loginLimiterEmail, 
      emailLower,
      'Too many login attempts for this email. Please try again later.'
    ),
    checkRateLimitWithResponse(
      loginLimiterIP,
      ip,
      'Too many login attempts from this IP. Please try again later.'
    )
  ])

  // Return 429 with Retry-After if either limit exceeded
  if (!emailResult.success) {
    return emailResult.response!
  }
  
  if (!ipResult.success) {
    return ipResult.response!
  }

  // Simulate login logic...
  const loginSuccess = Math.random() > 0.3 // 70% success rate

  if (!loginSuccess) {
    // Penalize failed login attempts
    await penalizeFailedLogin(emailLower, ip)
    
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )
  }

  // Reset rate limits on successful login
  await resetLoginAttempts(emailLower, ip)

  return NextResponse.json({
    message: 'Login successful',
    token: 'jwt_token_here'
  })
}

/**
 * Example 2: Registration Rate Limiting (3/min per IP, 10/day per email)
 */
export async function registerRateLimitExample(request: NextRequest) {
  const ip = getClientIp(request)
  const { email } = await request.json() as { email: string }
  const emailLower = email.toLowerCase()

  // Check IP rate limit (3/min)
  const ipResult = await checkRateLimitWithResponse(
    registerLimiterIP,
    ip,
    'Too many registration attempts from this IP. Please try again later.'
  )

  if (!ipResult.success) {
    return ipResult.response!
  }

  // Check email rate limit (10/day)  
  const emailResult = await checkRateLimitWithResponse(
    registerLimiterEmail,
    emailLower,
    'Too many registration attempts for this email. Please try again later.'
  )

  if (!emailResult.success) {
    return emailResult.response!
  }

  // Registration logic here...
  console.log(`Registering user: ${emailLower} from IP: ${ip}`)

  return NextResponse.json({
    message: 'Registration successful',
    ok: true
  }, { status: 201 })
}

/**
 * Example 3: Email Action Rate Limiting (3/hour per user per type)
 */
export async function emailVerificationRateLimitExample(request: NextRequest) {
  // Assume we have userId from auth middleware
  const userId = 'user_123' // From auth context
  
  // Rate limit verification emails (3/hour per user)
  const result = await checkRateLimitWithResponse(
    emailVerificationLimiter,
    userId,
    'Too many verification emails sent. Please try again later.'
  )

  if (!result.success) {
    return result.response!
  }

  // Send verification email logic...
  console.log(`Sending verification email to user: ${userId}`)

  return NextResponse.json({
    message: 'Verification email sent successfully'
  })
}

/**
 * Example 4: Password Reset Rate Limiting (3/hour per user)
 */
export async function passwordResetRateLimitExample(request: NextRequest) {
  const { email } = await request.json() as { email: string }
  const emailLower = email.toLowerCase()

  // Use email as key since user might not be authenticated
  const result = await checkRateLimitWithResponse(
    emailPasswordResetLimiter,
    emailLower,
    'Too many password reset attempts. Please try again later.'
  )

  if (!result.success) {
    return result.response!
  }

  // Password reset email logic...
  console.log(`Sending password reset email to: ${emailLower}`)

  // Always return success to prevent email enumeration
  return NextResponse.json({
    message: 'If an account exists, a password reset link has been sent.'
  })
}

/**
 * Example 5: Change Email Rate Limiting (3/hour per user)
 */
export async function changeEmailRateLimitExample(request: NextRequest) {
  const userId = 'user_123' // From auth context
  
  const result = await checkRateLimitWithResponse(
    emailChangeEmailLimiter,
    userId,
    'Too many email change attempts. Please try again later.'
  )

  if (!result.success) {
    return result.response!
  }

  // Change email logic...
  console.log(`Processing email change for user: ${userId}`)

  return NextResponse.json({
    message: 'Email change confirmation sent'
  })
}

/**
 * Example 6: Custom Rate Limiting with Manual Response Creation
 */
export async function customRateLimitExample(request: NextRequest) {
  const ip = getClientIp(request)

  try {
    // Use a limiter directly
    await loginLimiterIP.consume(ip)
    
    // Success - continue with logic
    return NextResponse.json({
      message: 'Request processed successfully'
    })
    
  } catch (rateLimitResult: any) {
    // Manually create 429 response with custom message
    const msBeforeNext = rateLimitResult.msBeforeNext || 300000 // 5 minutes
    
    return createRateLimitResponse(
      'Custom rate limit exceeded. Please slow down.',
      msBeforeNext
    )
  }
}

/**
 * Example 7: Global Email Rate Limiting (Provider Protection)
 */
import { RateLimiterRedis } from 'rate-limiter-flexible'
import redis from './rates'

// Global email limiter to prevent provider bans
export const globalEmailLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'global_email',
  points: 1000, // 1000 emails total
  duration: 3600, // Per hour
  blockDuration: 1800, // Block for 30 minutes
})

export async function globalEmailProtectionExample() {
  // Check global email rate limit before sending any email
  const result = await checkRateLimitWithResponse(
    globalEmailLimiter,
    'global',
    'Email service temporarily unavailable due to high volume. Please try again later.'
  )

  if (!result.success) {
    return result.response!
  }

  // Send email logic...
  console.log('Email sent successfully with global protection')

  return NextResponse.json({
    message: 'Email sent successfully'
  })
}

/**
 * Example 8: Progressive Rate Limiting
 * Increase blocking duration for repeat offenders
 */
export async function progressiveRateLimitExample(request: NextRequest) {
  const ip = getClientIp(request)
  
  try {
    // Try to consume from rate limiter
    const result = await loginLimiterIP.consume(ip)
    
    // Success case
    return NextResponse.json({
      message: 'Request successful',
      remainingAttempts: result.remainingPoints
    })
    
  } catch (rateLimitResult: any) {
    // Progressive blocking based on how many times they've been blocked
    let blockDuration = rateLimitResult.msBeforeNext || 300000 // 5 minutes default
    
    // Increase block duration for repeat offenders
    const totalHits = rateLimitResult.totalHits || 0
    if (totalHits > 50) {
      blockDuration *= 4 // 20 minutes
    } else if (totalHits > 20) {
      blockDuration *= 2 // 10 minutes
    }
    
    return createRateLimitResponse(
      'Rate limit exceeded. Extended blocking applied for repeated violations.',
      blockDuration
    )
  }
}

/**
 * Example 9: Rate Limiting with Different Point Costs
 * Heavy operations consume more points
 */
export async function weightedRateLimitExample(request: NextRequest) {
  const userId = 'user_123' // From auth context
  const { operation } = await request.json() as { operation: string }
  
  // Different operations have different point costs
  let pointCost = 1
  switch (operation) {
    case 'heavy_computation':
      pointCost = 5
      break
    case 'bulk_operation':
      pointCost = 3
      break
    case 'simple_read':
      pointCost = 1
      break
  }

  const result = await checkRateLimitWithResponse(
    emailVerificationLimiter, // Reusing for example
    userId,
    `Too many ${operation} operations. Please try again later.`,
    pointCost
  )

  if (!result.success) {
    return result.response!
  }

  return NextResponse.json({
    message: `${operation} completed successfully`,
    pointsUsed: pointCost,
    remainingPoints: result.remainingPoints
  })
}

/**
 * Example 10: Rate Limiting Headers for Client Information
 */
export function addRateLimitHeaders(
  response: NextResponse, 
  remainingPoints: number,
  resetTime: Date
): NextResponse {
  response.headers.set('X-RateLimit-Remaining', remainingPoints.toString())
  response.headers.set('X-RateLimit-Reset', resetTime.toISOString())
  response.headers.set('X-RateLimit-Limit', '5') // Example limit
  
  return response
}

export async function rateLimitWithHeadersExample(request: NextRequest) {
  const ip = getClientIp(request)
  
  try {
    const result = await loginLimiterIP.consume(ip)
    
    const response = NextResponse.json({
      message: 'Success'
    })
    
    // Add rate limit info headers for client
    return addRateLimitHeaders(
      response,
      result.remainingPoints,
      new Date(Date.now() + result.msBeforeNext)
    )
    
  } catch (rateLimitResult: any) {
    return createRateLimitResponse(
      'Rate limit exceeded',
      rateLimitResult.msBeforeNext || 300000
    )
  }
}