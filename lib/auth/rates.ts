import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible'
import { NextResponse } from 'next/server'
import Redis from 'ioredis'

const isDevelopment = process.env.NODE_ENV === 'development'

// Redis connection with error handling
let redis: Redis | null = null
try {
  if (!isDevelopment && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL)
  }
} catch (error) {
  console.warn('Redis connection failed, using memory rate limiting for development')
}

// Helper to create rate limiter with fallback
function createRateLimiter(config: {
  keyPrefix: string
  points: number
  duration: number
  blockDuration: number
}) {
  if (isDevelopment) {
    // Use more generous limits for development
    return new RateLimiterMemory({
      keyPrefix: config.keyPrefix,
      points: config.points * 10, // 10x more generous in dev
      duration: config.duration,
      blockDuration: Math.min(config.blockDuration, 60), // Max 1 minute block in dev
    })
  }

  if (redis) {
    return new RateLimiterRedis({
      storeClient: redis,
      ...config
    })
  }

  // Fallback to memory limiter with warning
  console.warn(`Using memory rate limiter for ${config.keyPrefix} - Redis not available`)
  return new RateLimiterMemory(config)
}

// Rate limiters for different operations - matching security contracts

// Login rate limiting: 10/min/IP, 5/min/email
export const loginLimiterIP = createRateLimiter({
  keyPrefix: 'login_ip',
  points: 10, // 10 attempts per IP (100 in dev)
  duration: 60, // Per minute
  blockDuration: 300, // Block for 5 minutes (1 min in dev)
})

export const loginLimiterEmail = createRateLimiter({
  keyPrefix: 'login_email',
  points: 5, // 5 attempts per email (50 in dev)
  duration: 60, // Per minute
  blockDuration: 900, // Block for 15 minutes (1 min in dev)
})

// Register rate limiting: 3/min/IP, 10/day/email
export const registerLimiterIP = createRateLimiter({
  keyPrefix: 'register_ip',
  points: 3, // 3 registrations per IP (30 in dev)
  duration: 60, // Per minute
  blockDuration: 300, // Block for 5 minutes (1 min in dev)
})

export const registerLimiterEmail = createRateLimiter({
  keyPrefix: 'register_email',
  points: 10, // 10 registrations per email (100 in dev)
  duration: 86400, // Per day (24 hours)
  blockDuration: 3600, // Block for 1 hour (1 min in dev)
})

// Email rate limiting: 3/hour per user per type
export const emailVerificationLimiter = createRateLimiter({
  keyPrefix: 'email_verification',
  points: 3, // 3 emails per user (30 in dev)
  duration: 3600, // Per hour
  blockDuration: 1800, // Block for 30 minutes (1 min in dev)
})

export const emailPasswordResetLimiter = createRateLimiter({
  keyPrefix: 'email_password_reset',
  points: 3, // 3 emails per user (30 in dev)
  duration: 3600, // Per hour
  blockDuration: 1800, // Block for 30 minutes (1 min in dev)
})

export const emailChangeEmailLimiter = createRateLimiter({
  keyPrefix: 'email_change_email',
  points: 3, // 3 emails per user (30 in dev)
  duration: 3600, // Per hour
  blockDuration: 1800, // Block for 30 minutes (1 min in dev)
})

// Legacy limiters for backward compatibility
export const loginLimiter = loginLimiterEmail
export const registerLimiter = registerLimiterIP
export const emailLimiter = emailVerificationLimiter
export const passwordResetLimiter = emailPasswordResetLimiter

export const generalApiLimiter = createRateLimiter({
  keyPrefix: 'general_api',
  points: 100, // 100 requests per user (1000 in dev)
  duration: 60, // Per minute
  blockDuration: 60, // Block for 1 minute (1 min in dev)
})

// Helper function to get client IP
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  if (cfConnectingIp) return cfConnectingIp
  if (realIp) return realIp
  if (forwarded) return forwarded.split(',')[0].trim()
  
  return 'unknown'
}

// Helper function to handle rate limiting
export async function checkRateLimit(
  limiter: RateLimiterRedis,
  key: string,
  points: number = 1
): Promise<{ success: boolean; remainingPoints?: number; msBeforeNext?: number }> {
  try {
    const result = await limiter.consume(key, points)
    return {
      success: true,
      remainingPoints: result.remainingPoints,
      msBeforeNext: result.msBeforeNext,
    }
  } catch (rateLimiterRes: any) {
    return {
      success: false,
      remainingPoints: rateLimiterRes.remainingPoints || 0,
      msBeforeNext: rateLimiterRes.msBeforeNext || 0,
    }
  }
}

// Helper function to create 429 response with Retry-After header
export function createRateLimitResponse(
  message: string,
  msBeforeNext: number
): NextResponse {
  const retryAfterSeconds = Math.ceil(msBeforeNext / 1000)
  
  const response = NextResponse.json(
    { error: message },
    { status: 429 }
  )
  
  // Add Retry-After header (in seconds)
  response.headers.set('Retry-After', retryAfterSeconds.toString())
  
  // Add rate limit headers for client info
  response.headers.set('X-RateLimit-Limit', '0') // Currently at limit
  response.headers.set('X-RateLimit-Remaining', '0')
  response.headers.set('X-RateLimit-Reset', new Date(Date.now() + msBeforeNext).toISOString())
  
  return response
}

// Enhanced rate limit check with proper error response
export async function checkRateLimitWithResponse(
  limiter: RateLimiterRedis,
  key: string,
  errorMessage: string,
  points: number = 1
): Promise<{ success: boolean; response?: NextResponse; remainingPoints?: number }> {
  try {
    const result = await limiter.consume(key, points)
    return {
      success: true,
      remainingPoints: result.remainingPoints,
    }
  } catch (rateLimiterRes: any) {
    const msBeforeNext = rateLimiterRes.msBeforeNext || 60000 // Default 1 minute
    
    return {
      success: false,
      response: createRateLimitResponse(errorMessage, msBeforeNext),
      remainingPoints: rateLimiterRes.remainingPoints || 0,
    }
  }
}

// Penalty for failed login attempts
export async function penalizeFailedLogin(email: string, ip: string): Promise<void> {
  await Promise.all([
    loginLimiter.consume(email),
    loginLimiter.consume(ip),
  ])
}

// Reset login attempts on successful login
export async function resetLoginAttempts(email: string, ip: string): Promise<void> {
  await Promise.all([
    loginLimiter.delete(email),
    loginLimiter.delete(ip),
  ])
}

export default redis