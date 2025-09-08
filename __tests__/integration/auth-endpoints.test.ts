/**
 * API Integration Tests for Auth Endpoints
 * 
 * Tests all auth endpoints with happy paths, edge cases,
 * error scenarios, rate limiting, and security validation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { POST as registerHandler } from '@/app/api/auth/register/route'
import { POST as forgotPasswordHandler } from '@/app/api/auth/forgot-password/route'
import { POST as resetPasswordHandler } from '@/app/api/auth/reset-password/route'
import { POST as refreshHandler } from '@/app/api/auth/refresh/route'
import { POST as logoutHandler } from '@/app/api/auth/logout/route'
import { GET as meHandler } from '@/app/api/auth/me/route'
import { POST as verifyEmailHandler } from '@/app/api/auth/verify-email/route'
import { POST as resendVerificationHandler } from '@/app/api/auth/resend-verification/route'

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    emailActionToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    loginAttempt: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth/rates', () => ({
  checkRateLimit: jest.fn(),
  getClientIp: jest.fn(),
  penalizeFailedLogin: jest.fn(),
  resetLoginAttempts: jest.fn(),
  loginLimiterIP: {},
  loginLimiterEmail: {},
  registerLimiterIP: {},
  registerLimiterEmail: {},
}))

jest.mock('@/lib/auth/email', () => ({
  sendEmail: jest.fn(),
}))

jest.mock('@/lib/observability', () => ({
  logAuthEvent: jest.fn(),
}))

jest.mock('@/lib/observability/metrics', () => ({
  authMetrics: {
    loginSuccess: jest.fn(),
    loginFailed: jest.fn(),
    registerSuccess: jest.fn(),
    registerFailed: jest.fn(),
    httpResponse: jest.fn(),
    rateLimitHit: jest.fn(),
    sessionEvent: jest.fn(),
    emailSent: jest.fn(),
  },
  timeAuthRequest: jest.fn((endpoint, method, fn) => fn()),
}))

const { prisma } = require('@/lib/prisma')
const { checkRateLimit, getClientIp } = require('@/lib/auth/rates')
const { sendEmail } = require('@/lib/auth/email')

// Helper to create NextRequest
function createRequest(method: string, body?: any, headers: Record<string, string> = {}) {
  const url = 'http://localhost:3000/api/auth/test'
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }
  
  if (body) {
    options.body = JSON.stringify(body)
  }
  
  return new NextRequest(url, options)
}

// Helper to extract JSON from Response
async function getJsonResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: 'Invalid JSON response', text }
  }
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    checkRateLimit.mockResolvedValue({ success: true })
    getClientIp.mockReturnValue('192.168.1.1')
  })

  test('should login successfully with valid credentials', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'user@example.com',
      displayName: 'John Doe',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
      emailVerifiedAt: new Date(),
      isBlocked: false,
      mfaEnabled: false,
      mfaSecretEnc: null,
    }

    const mockSession = {
      id: 'session_123',
      userId: 'user_123',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }

    prisma.user.findUnique.mockResolvedValue(mockUser)
    prisma.session.create.mockResolvedValue(mockSession)
    prisma.refreshToken.create.mockResolvedValue({
      id: 'refresh_123',
      tokenFamily: 'family_123',
    })

    // Mock password verification
    const crypto = require('@/lib/auth/crypto')
    crypto.verifyPassword = jest.fn().mockResolvedValue(true)
    crypto.needsRehash = jest.fn().mockReturnValue(false)

    const request = createRequest('POST', {
      email: 'user@example.com',
      password: 'SecurePassword123!',
    })

    const response = await loginHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.token).toBeDefined()
    expect(data.user.id).toBe('user_123')
    expect(data.user.email).toBe('user@example.com')
    
    // Check cookies are set
    const setCookieHeaders = response.headers.getSetCookie()
    expect(setCookieHeaders.some(cookie => cookie.includes('access_token'))).toBe(true)
    expect(setCookieHeaders.some(cookie => cookie.includes('refresh_token'))).toBe(true)
  })

  test('should reject invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_123',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
    })

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyPassword = jest.fn().mockResolvedValue(false)

    const request = createRequest('POST', {
      email: 'user@example.com',
      password: 'WrongPassword',
    })

    const response = await loginHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid email or password')
  })

  test('should reject login for blocked user', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'user@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
      isBlocked: true,
    }

    prisma.user.findUnique.mockResolvedValue(mockUser)

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyPassword = jest.fn().mockResolvedValue(true)

    const request = createRequest('POST', {
      email: 'user@example.com',
      password: 'SecurePassword123!',
    })

    const response = await loginHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(403)
    expect(data.error).toBe('Account is blocked. Please contact support.')
  })

  test('should require MFA when enabled', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'user@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
      isBlocked: false,
      mfaEnabled: true,
      mfaSecretEnc: 'encrypted-secret',
    }

    prisma.user.findUnique.mockResolvedValue(mockUser)

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyPassword = jest.fn().mockResolvedValue(true)

    const request = createRequest('POST', {
      email: 'user@example.com',
      password: 'SecurePassword123!',
    })

    const response = await loginHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('MFA code is required')
    expect(data.requiresMFA).toBe(true)
  })

  test('should handle rate limiting', async () => {
    checkRateLimit.mockResolvedValue({ success: false })

    const request = createRequest('POST', {
      email: 'user@example.com',
      password: 'SecurePassword123!',
    })

    const response = await loginHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(429)
    expect(data.error).toBe('Too many failed login attempts. Please try again later.')
  })

  test('should validate request body', async () => {
    const request = createRequest('POST', {
      email: 'invalid-email',
      password: '',
    })

    const response = await loginHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid input')
    expect(data.details).toBeDefined()
  })
})

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    checkRateLimit.mockResolvedValue({ success: true })
    getClientIp.mockReturnValue('192.168.1.1')
    sendEmail.mockResolvedValue(true)
  })

  test('should register successfully with valid data', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'newuser@example.com',
      displayName: 'New User',
      emailVerifiedAt: null,
    }

    prisma.user.findUnique.mockResolvedValue(null) // No existing user
    prisma.user.create.mockResolvedValue(mockUser)
    prisma.emailActionToken.create.mockResolvedValue({
      id: 'token_123',
      tokenHash: 'hashed-token',
    })

    const crypto = require('@/lib/auth/crypto')
    crypto.hashPassword = jest.fn().mockResolvedValue('$argon2id$hash')

    const request = createRequest('POST', {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      displayName: 'New User',
    })

    const response = await registerHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(201)
    expect(data.ok).toBe(true)
    expect(data.message).toContain('Registration successful')
    
    expect(sendEmail).toHaveBeenCalledWith('verify_email', 'newuser@example.com', expect.any(Object))
  })

  test('should reject registration with existing email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'existing_user',
      email: 'existing@example.com',
    })

    const request = createRequest('POST', {
      email: 'existing@example.com',
      password: 'SecurePassword123!',
    })

    const response = await registerHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(409)
    expect(data.error).toBe('User with this email already exists')
  })

  test('should handle registration rate limiting', async () => {
    checkRateLimit.mockResolvedValue({ success: false })

    const request = createRequest('POST', {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
    })

    const response = await registerHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(429)
    expect(data.error).toBe('Too many registration attempts. Please try again later.')
  })
})

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    checkRateLimit.mockResolvedValue({ success: true })
    sendEmail.mockResolvedValue(true)
  })

  test('should send reset email for existing user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_123',
      email: 'user@example.com',
    })

    prisma.emailActionToken.create.mockResolvedValue({
      id: 'token_123',
    })

    const request = createRequest('POST', {
      email: 'user@example.com',
    })

    const response = await forgotPasswordHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.message).toContain('password reset link has been sent')
    
    expect(sendEmail).toHaveBeenCalledWith('password_reset', 'user@example.com', expect.any(Object))
  })

  test('should return success even for non-existent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    const request = createRequest('POST', {
      email: 'nonexistent@example.com',
    })

    const response = await forgotPasswordHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.message).toContain('password reset link has been sent')
    
    // Should not send email for non-existent user
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should reset password with valid token', async () => {
    const mockToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'password_reset',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      consumedAt: null,
      tokenHash: 'hashed-token',
    }

    const mockUser = {
      id: 'user_123',
      email: 'user@example.com',
    }

    prisma.emailActionToken.findFirst.mockResolvedValue(mockToken)
    prisma.user.findUnique.mockResolvedValue(mockUser)
    prisma.emailActionToken.update.mockResolvedValue({})
    prisma.user.update.mockResolvedValue({})

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)
    crypto.hashPassword = jest.fn().mockResolvedValue('$argon2id$new-hash')

    const request = createRequest('POST', {
      token: 'valid-reset-token',
      password: 'NewSecurePassword123!',
    })

    const response = await resetPasswordHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.message).toBe('Password has been reset successfully')

    // Verify token was consumed
    expect(prisma.emailActionToken.update).toHaveBeenCalledWith({
      where: { id: 'token_123' },
      data: { consumedAt: expect.any(Date) },
    })

    // Verify password was updated
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_123' },
      data: { passwordHash: '$argon2id$new-hash' },
    })
  })

  test('should reject expired token', async () => {
    const mockToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'password_reset',
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired)
      consumedAt: null,
      tokenHash: 'hashed-token',
    }

    prisma.emailActionToken.findFirst.mockResolvedValue(mockToken)

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)

    const request = createRequest('POST', {
      token: 'expired-token',
      password: 'NewSecurePassword123!',
    })

    const response = await resetPasswordHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid or expired reset token')
  })

  test('should reject already consumed token', async () => {
    const mockToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'password_reset',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      consumedAt: new Date(Date.now() - 30 * 60 * 1000), // Already consumed
      tokenHash: 'hashed-token',
    }

    prisma.emailActionToken.findFirst.mockResolvedValue(mockToken)

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)

    const request = createRequest('POST', {
      token: 'consumed-token',
      password: 'NewSecurePassword123!',
    })

    const response = await resetPasswordHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid or expired reset token')
  })
})

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should refresh tokens successfully', async () => {
    const mockRefreshToken = {
      id: 'refresh_123',
      userId: 'user_123',
      sessionId: 'session_123',
      tokenFamily: 'family_123',
      rotatedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      session: {
        id: 'session_123',
        userId: 'user_123',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }

    prisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken)
    prisma.refreshToken.update.mockResolvedValue({})
    prisma.refreshToken.create.mockResolvedValue({
      id: 'refresh_456',
      tokenFamily: 'family_123',
    })

    const request = createRequest('POST', {}, {
      'cookie': 'refresh_token=valid-refresh-token',
    })

    const response = await refreshHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.accessToken).toBeDefined()
    expect(data.refreshToken).toBeDefined()

    // Check new cookies are set
    const setCookieHeaders = response.headers.getSetCookie()
    expect(setCookieHeaders.some(cookie => cookie.includes('access_token'))).toBe(true)
    expect(setCookieHeaders.some(cookie => cookie.includes('refresh_token'))).toBe(true)
  })

  test('should detect token reuse', async () => {
    const mockRefreshToken = {
      id: 'refresh_123',
      userId: 'user_123',
      sessionId: 'session_123',
      tokenFamily: 'family_123',
      rotatedAt: new Date(Date.now() - 60000), // Already rotated (reuse attempt)
      revokedAt: null,
      session: {
        id: 'session_123',
        userId: 'user_123',
      },
    }

    prisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken)
    prisma.refreshToken.update.mockResolvedValue({})
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 })
    prisma.session.update.mockResolvedValue({})

    const request = createRequest('POST', {}, {
      'cookie': 'refresh_token=reused-token',
    })

    const response = await refreshHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid refresh token')

    // Verify token family was revoked
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenFamily: 'family_123', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })

    // Verify session was revoked
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'session_123' },
      data: { revokedAt: expect.any(Date) },
    })
  })
})

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should logout successfully', async () => {
    const mockSession = {
      id: 'session_123',
      userId: 'user_123',
      revokedAt: null,
    }

    prisma.session.findUnique.mockResolvedValue(mockSession)
    prisma.session.update.mockResolvedValue({})
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })

    const request = createRequest('POST', {}, {
      'cookie': 'session_id=session_123',
    })

    const response = await logoutHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.message).toBe('Logged out successfully')

    // Verify session was revoked
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'session_123' },
      data: { revokedAt: expect.any(Date) },
    })

    // Check logout cookies are set
    const setCookieHeaders = response.headers.getSetCookie()
    expect(setCookieHeaders.some(cookie => cookie.includes('access_token=;'))).toBe(true)
    expect(setCookieHeaders.some(cookie => cookie.includes('refresh_token=;'))).toBe(true)
  })
})

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should return user data with valid token', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'user@example.com',
      displayName: 'John Doe',
      emailVerifiedAt: new Date(),
      mfaEnabled: false,
    }

    prisma.user.findUnique.mockResolvedValue(mockUser)

    // Mock JWT verification
    const jwt = require('@/lib/auth/jwt')
    jwt.verifyAccessJwt = jest.fn().mockResolvedValue({
      sub: 'user_123',
      sid: 'session_123',
    })

    const request = createRequest('GET', null, {
      'authorization': 'Bearer valid-access-token',
    })

    const response = await meHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.user.id).toBe('user_123')
    expect(data.user.email).toBe('user@example.com')
    expect(data.user.displayName).toBe('John Doe')
  })

  test('should reject invalid token', async () => {
    const jwt = require('@/lib/auth/jwt')
    jwt.verifyAccessJwt = jest.fn().mockResolvedValue(null)

    const request = createRequest('GET', null, {
      'authorization': 'Bearer invalid-token',
    })

    const response = await meHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid or expired token')
  })
})

describe('POST /api/auth/verify-email', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should verify email with valid token', async () => {
    const mockToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'verify_email',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      consumedAt: null,
      tokenHash: 'hashed-token',
    }

    const mockUser = {
      id: 'user_123',
      email: 'user@example.com',
      emailVerifiedAt: null,
    }

    prisma.emailActionToken.findFirst.mockResolvedValue(mockToken)
    prisma.user.findUnique.mockResolvedValue(mockUser)
    prisma.emailActionToken.update.mockResolvedValue({})
    prisma.user.update.mockResolvedValue({})

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)

    const request = createRequest('POST', {
      token: 'valid-verification-token',
    })

    const response = await verifyEmailHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.message).toBe('Email verified successfully')

    // Verify user's email was marked as verified
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_123' },
      data: { emailVerifiedAt: expect.any(Date) },
    })
  })

  test('should reject already verified email', async () => {
    const mockToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'verify_email',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      consumedAt: null,
      tokenHash: 'hashed-token',
    }

    const mockUser = {
      id: 'user_123',
      email: 'user@example.com',
      emailVerifiedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Already verified
    }

    prisma.emailActionToken.findFirst.mockResolvedValue(mockToken)
    prisma.user.findUnique.mockResolvedValue(mockUser)

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)

    const request = createRequest('POST', {
      token: 'valid-verification-token',
    })

    const response = await verifyEmailHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBe('Email is already verified')
  })
})

describe('Error Handling and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should handle database errors gracefully', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'))

    const request = createRequest('POST', {
      email: 'user@example.com',
      password: 'SecurePassword123!',
    })

    const response = await loginHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })

  test('should handle malformed JSON requests', async () => {
    const url = 'http://localhost:3000/api/auth/login'
    const request = new NextRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json{',
    })

    const response = await loginHandler(request)
    const data = await getJsonResponse(response)

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  test('should handle missing Content-Type header', async () => {
    const url = 'http://localhost:3000/api/auth/login'
    const request = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'SecurePassword123!',
      }),
    })

    const response = await loginHandler(request)
    
    // Should still work with JSON body even without explicit Content-Type
    expect(response.status).not.toBe(400)
  })

  test('should handle very large request bodies', async () => {
    const largePassword = 'a'.repeat(10000) // Very large password
    
    const request = createRequest('POST', {
      email: 'user@example.com',
      password: largePassword,
    })

    const response = await loginHandler(request)
    const data = await getJsonResponse(response)

    // Should be rejected by schema validation (password too long)
    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid input')
  })
})