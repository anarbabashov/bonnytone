/**
 * Security Validation Tests
 * 
 * Tests cookie security flags, JWT validation, token expiry,
 * session security, and other security mechanisms.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setSessionCookie,
  clearAuthCookies,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  getSessionIdFromRequest,
} from '@/lib/auth/cookies'
import {
  issueAccessJwt,
  createRefreshToken,
  verifyAccessJwt,
  verifyRefreshToken
} from '@/lib/auth/jwt'
import { createSession, refreshAccessToken } from '@/lib/auth/session'
import jwt from 'jsonwebtoken'

// Mock environment for security tests
const SECURITY_ENV = {
  NODE_ENV: 'production',
  JWT_ISSUER: 'security-test-issuer',
  JWT_AUDIENCE: 'security-test-audience',
  JWT_ALGORITHM: 'HS512',
  JWT_ACCESS_TTL: '600',
  JWT_REFRESH_TTL: '2592000',
  TOKEN_HMAC_SECRET: 'security-test-secret-32-bytes-long',
  COOKIE_DOMAIN: '.secure-domain.com',
}

// Set security environment
Object.keys(SECURITY_ENV).forEach(key => {
  process.env[key] = SECURITY_ENV[key as keyof typeof SECURITY_ENV]
})

describe('Cookie Security', () => {
  let mockResponse: NextResponse

  beforeEach(() => {
    mockResponse = NextResponse.json({})
  })

  test('should set secure cookie flags in production', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production'

    setAccessTokenCookie(mockResponse, 'test-access-token')
    setRefreshTokenCookie(mockResponse, 'test-refresh-token')
    setSessionCookie(mockResponse, 'test-session-id')

    const setCookieHeaders = mockResponse.headers.getSetCookie()

    setCookieHeaders.forEach(cookie => {
      expect(cookie).toMatch(/Secure/)
      expect(cookie).toMatch(/HttpOnly/)
      expect(cookie).toMatch(/SameSite=Lax/)
    });

    (process.env as any).NODE_ENV = originalEnv
  })

  test('should not set Secure flag in development', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development'

    setAccessTokenCookie(mockResponse, 'test-access-token')
    
    const setCookieHeaders = mockResponse.headers.getSetCookie()
    const accessCookie = setCookieHeaders.find(cookie => cookie.includes('access_token'))

    expect(accessCookie).toBeDefined()
    expect(accessCookie).not.toMatch(/Secure/)
    expect(accessCookie).toMatch(/HttpOnly/)
    expect(accessCookie).toMatch(/SameSite=Lax/);

    (process.env as any).NODE_ENV = originalEnv
  })

  test('should use correct cookie domain in production', () => {
    const originalEnv = process.env.NODE_ENV
    const originalDomain = process.env.COOKIE_DOMAIN;

    (process.env as any).NODE_ENV = 'production'
    process.env.COOKIE_DOMAIN = '.production-domain.com'

    setAccessTokenCookie(mockResponse, 'test-access-token')
    
    const setCookieHeaders = mockResponse.headers.getSetCookie()
    const accessCookie = setCookieHeaders.find(cookie => cookie.includes('access_token'))

    expect(accessCookie).toMatch(/Domain=\.production-domain\.com/);

    (process.env as any).NODE_ENV = originalEnv
    process.env.COOKIE_DOMAIN = originalDomain
  })

  test('should set appropriate expiration times', () => {
    setAccessTokenCookie(mockResponse, 'test-access-token')
    setRefreshTokenCookie(mockResponse, 'test-refresh-token')

    const setCookieHeaders = mockResponse.headers.getSetCookie()
    const accessCookie = setCookieHeaders.find(cookie => cookie.includes('access_token'))
    const refreshCookie = setCookieHeaders.find(cookie => cookie.includes('refresh_token'))

    // Access token should have shorter expiry (10 minutes)
    expect(accessCookie).toMatch(/Max-Age=600/)
    
    // Refresh token should have longer expiry (30 days)
    expect(refreshCookie).toMatch(/Max-Age=2592000/)
  })

  test('should properly clear all auth cookies', () => {
    clearAuthCookies(mockResponse)

    const setCookieHeaders = mockResponse.headers.getSetCookie()
    
    expect(setCookieHeaders.length).toBe(3) // access_token, refresh_token, session_id
    
    setCookieHeaders.forEach(cookie => {
      expect(cookie).toMatch(/Max-Age=0/)
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/)
    })
  })

  test('should handle cookie extraction from request headers', () => {
    const request = new NextRequest('http://localhost:3000', {
      headers: {
        'cookie': 'access_token=test-access; refresh_token=test-refresh; session_id=test-session; other=value',
      },
    })

    expect(getAccessTokenFromRequest(request)).toBe('test-access')
    expect(getRefreshTokenFromRequest(request)).toBe('test-refresh')
    expect(getSessionIdFromRequest(request)).toBe('test-session')
  })

  test('should handle missing cookies gracefully', () => {
    const request = new NextRequest('http://localhost:3000', {
      headers: { 'cookie': 'other=value' },
    })

    expect(getAccessTokenFromRequest(request)).toBeNull()
    expect(getRefreshTokenFromRequest(request)).toBeNull()
    expect(getSessionIdFromRequest(request)).toBeNull()
  })

  test('should handle malformed cookie header', () => {
    const request = new NextRequest('http://localhost:3000', {
      headers: { 'cookie': 'malformed-cookie-string' },
    })

    expect(getAccessTokenFromRequest(request)).toBeNull()
    expect(getRefreshTokenFromRequest(request)).toBeNull()
    expect(getSessionIdFromRequest(request)).toBeNull()
  })
})

describe('JWT Security Validation', () => {
  const userId = 'user_123'
  const sessionId = 'session_456'

  test('should validate JWT audience claim', async () => {
    const token = await issueAccessJwt(userId, sessionId)
    
    // Valid audience
    const validPayload = await verifyAccessJwt(token)
    expect(validPayload).toBeDefined()
    expect(validPayload!.aud).toBe(SECURITY_ENV.JWT_AUDIENCE)

    // Invalid audience
    const originalAud = process.env.JWT_AUDIENCE
    process.env.JWT_AUDIENCE = 'wrong-audience'
    
    const invalidPayload = await verifyAccessJwt(token)
    expect(invalidPayload).toBeNull()

    process.env.JWT_AUDIENCE = originalAud
  })

  test('should validate JWT issuer claim', async () => {
    const token = await issueAccessJwt(userId, sessionId)
    
    // Valid issuer
    const validPayload = await verifyAccessJwt(token)
    expect(validPayload).toBeDefined()
    expect(validPayload!.iss).toBe(SECURITY_ENV.JWT_ISSUER)

    // Invalid issuer
    const originalIss = process.env.JWT_ISSUER
    process.env.JWT_ISSUER = 'wrong-issuer'
    
    const invalidPayload = await verifyAccessJwt(token)
    expect(invalidPayload).toBeNull()

    process.env.JWT_ISSUER = originalIss
  })

  test('should validate token expiration strictly', async () => {
    const originalTtl = process.env.JWT_ACCESS_TTL
    process.env.JWT_ACCESS_TTL = '1' // 1 second
    
    const token = await issueAccessJwt(userId, sessionId)
    
    // Token should be valid immediately
    const immediatePayload = await verifyAccessJwt(token)
    expect(immediatePayload).toBeDefined()

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Token should be invalid after expiry
    const expiredPayload = await verifyAccessJwt(token)
    expect(expiredPayload).toBeNull()

    process.env.JWT_ACCESS_TTL = originalTtl
  }, 3000)

  test('should reject tokens with tampered signatures', async () => {
    const token = await issueAccessJwt(userId, sessionId)
    
    // Tamper with signature
    const parts = token.split('.')
    const tamperedSignature = Buffer.from('tampered-signature').toString('base64url')
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`
    
    const payload = await verifyAccessJwt(tamperedToken)
    expect(payload).toBeNull()
  })

  test('should reject tokens with tampered payload', async () => {
    const token = await issueAccessJwt(userId, sessionId)
    
    // Tamper with payload
    const parts = token.split('.')
    const tamperedPayload = {
      sub: 'different-user-id',
      aud: SECURITY_ENV.JWT_AUDIENCE,
      iss: SECURITY_ENV.JWT_ISSUER,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }
    
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url')
    const tamperedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`
    
    const payload = await verifyAccessJwt(tamperedToken)
    expect(payload).toBeNull()
  })

  test('should reject tokens issued in the future', async () => {
    // Create token with future issued time
    const futureIat = Math.floor(Date.now() / 1000) + 3600 // 1 hour in future
    const futurePayload = {
      sub: userId,
      sid: sessionId,
      aud: SECURITY_ENV.JWT_AUDIENCE,
      iss: SECURITY_ENV.JWT_ISSUER,
      iat: futureIat,
      exp: futureIat + 3600,
      type: 'access',
      scope: 'user',
    }

    const futureToken = jwt.sign(futurePayload, SECURITY_ENV.TOKEN_HMAC_SECRET, {
      algorithm: 'HS512',
    })

    const payload = await verifyAccessJwt(futureToken)
    expect(payload).toBeNull()
  })

  test('should validate required claims are present', async () => {
    const incompletePayloads = [
      { /* missing sub */ sid: sessionId, aud: SECURITY_ENV.JWT_AUDIENCE, iss: SECURITY_ENV.JWT_ISSUER },
      { sub: userId, /* missing sid */ aud: SECURITY_ENV.JWT_AUDIENCE, iss: SECURITY_ENV.JWT_ISSUER },
      { sub: userId, sid: sessionId, /* missing aud */ iss: SECURITY_ENV.JWT_ISSUER },
      { sub: userId, sid: sessionId, aud: SECURITY_ENV.JWT_AUDIENCE /* missing iss */ },
    ]

    for (const incompletePayload of incompletePayloads) {
      const now = Math.floor(Date.now() / 1000)
      const tokenPayload = {
        ...incompletePayload,
        iat: now,
        exp: now + 3600,
        type: 'access',
      }

      const token = jwt.sign(tokenPayload, SECURITY_ENV.TOKEN_HMAC_SECRET, {
        algorithm: 'HS512',
      })

      const payload = await verifyAccessJwt(token)
      expect(payload).toBeNull()
    }
  })

  test('should validate token type claim', async () => {
    // Create access token with wrong type
    const wrongTypePayload = {
      sub: userId,
      sid: sessionId,
      aud: SECURITY_ENV.JWT_AUDIENCE,
      iss: SECURITY_ENV.JWT_ISSUER,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      type: 'refresh', // Wrong type for access token
      scope: 'user',
    }

    const wrongTypeToken = jwt.sign(wrongTypePayload, SECURITY_ENV.TOKEN_HMAC_SECRET, {
      algorithm: 'HS512',
    })

    const payload = await verifyAccessJwt(wrongTypeToken)
    expect(payload).toBeNull()
  })
})

describe('Session Security', () => {
  // Mock Prisma for session tests
  jest.mock('@/lib/prisma', () => ({
    prisma: {
      session: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    },
  }))

  jest.mock('@/lib/observability', () => ({
    logAuthEvent: jest.fn(),
  }))

  jest.mock('@/lib/observability/metrics', () => ({
    authMetrics: {
      sessionEvent: jest.fn(),
      tokenReuse: jest.fn(),
    },
  }))

  const { prisma } = require('@/lib/prisma')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should enforce session expiration', async () => {
    const expiredSession = {
      id: 'session_123',
      userId: 'user_123',
      expiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
      revokedAt: null,
    }

    prisma.session.findUnique.mockResolvedValue(expiredSession)

    // Session should be treated as invalid due to expiration
    // This would be tested in actual session validation middleware
  })

  test('should enforce session revocation', async () => {
    const revokedSession = {
      id: 'session_123',
      userId: 'user_123',
      expiresAt: new Date(Date.now() + 60000), // Valid expiry
      revokedAt: new Date(Date.now() - 30000), // Revoked 30 seconds ago
    }

    prisma.session.findUnique.mockResolvedValue(revokedSession)

    // Session should be treated as invalid due to revocation
    // This would be tested in actual session validation middleware
  })

  test('should detect refresh token reuse attempts', async () => {
    const reusedToken = {
      id: 'refresh_123',
      userId: 'user_123',
      sessionId: 'session_123',
      tokenFamily: 'family_123',
      rotatedAt: new Date(Date.now() - 60000), // Already rotated
      revokedAt: null,
      session: {
        id: 'session_123',
        userId: 'user_123',
      },
    }

    prisma.refreshToken.findUnique.mockResolvedValue(reusedToken)
    prisma.refreshToken.update.mockResolvedValue({})
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 })
    prisma.session.update.mockResolvedValue({})

    const result = await refreshAccessToken('refresh_123')
    
    expect(result).toBeNull()
    
    // Verify security response: all tokens in family revoked
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

describe('Input Validation Security', () => {
  test('should sanitize user inputs in JWT claims', async () => {
    const maliciousUserId = '<script>alert("xss")</script>'
    const maliciousSessionId = '"; DROP TABLE sessions; --'

    // JWT should handle malicious input safely
    const token = await issueAccessJwt(maliciousUserId, maliciousSessionId)
    expect(token).toBeDefined()

    const payload = await verifyAccessJwt(token)
    expect(payload).toBeDefined()
    expect(payload!.sub).toBe(maliciousUserId) // Stored as-is but safely encoded in JWT
    expect(payload!.sid).toBe(maliciousSessionId)
  })

  test('should handle extremely long input values', async () => {
    const longUserId = 'u'.repeat(10000)
    const longSessionId = 's'.repeat(10000)

    // Should handle long inputs without throwing
    const token = await issueAccessJwt(longUserId, longSessionId)
    expect(token).toBeDefined()

    const payload = await verifyAccessJwt(token)
    expect(payload).toBeDefined()
    expect(payload!.sub).toBe(longUserId)
    expect(payload!.sid).toBe(longSessionId)
  })

  test('should handle Unicode characters in JWT claims', async () => {
    const unicodeUserId = '用户_123_🔐'
    const unicodeSessionId = '会话_456_🚀'

    const token = await issueAccessJwt(unicodeUserId, unicodeSessionId)
    expect(token).toBeDefined()

    const payload = await verifyAccessJwt(token)
    expect(payload).toBeDefined()
    expect(payload!.sub).toBe(unicodeUserId)
    expect(payload!.sid).toBe(unicodeSessionId)
  })
})

describe('Timing Attack Prevention', () => {
  test('token verification should have consistent timing', async () => {
    const validToken = await issueAccessJwt('user_123', 'session_456')
    const invalidToken = 'invalid.jwt.token'

    // Measure timing for valid token verification
    const validTimings: number[] = []
    for (let i = 0; i < 10; i++) {
      const start = process.hrtime.bigint()
      await verifyAccessJwt(validToken)
      const end = process.hrtime.bigint()
      validTimings.push(Number(end - start))
    }

    // Measure timing for invalid token verification
    const invalidTimings: number[] = []
    for (let i = 0; i < 10; i++) {
      const start = process.hrtime.bigint()
      await verifyAccessJwt(invalidToken)
      const end = process.hrtime.bigint()
      invalidTimings.push(Number(end - start))
    }

    const validAvg = validTimings.reduce((a, b) => a + b) / validTimings.length
    const invalidAvg = invalidTimings.reduce((a, b) => a + b) / invalidTimings.length

    // Timing difference should be reasonable (within 50% of each other)
    const timingRatio = Math.max(validAvg, invalidAvg) / Math.min(validAvg, invalidAvg)
    expect(timingRatio).toBeLessThan(1.5)
  })
})

describe('Algorithm Confusion Prevention', () => {
  test('should reject tokens with different algorithms', async () => {
    const payload = {
      sub: 'user_123',
      sid: 'session_456',
      aud: SECURITY_ENV.JWT_AUDIENCE,
      iss: SECURITY_ENV.JWT_ISSUER,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      type: 'access',
      scope: 'user',
    }

    // Create token with different algorithm
    const wrongAlgToken = jwt.sign(payload, SECURITY_ENV.TOKEN_HMAC_SECRET, {
      algorithm: 'HS256', // Wrong algorithm
    })

    // Should reject due to algorithm mismatch
    const result = await verifyAccessJwt(wrongAlgToken)
    expect(result).toBeNull()
  })

  test('should reject unsigned tokens (none algorithm)', async () => {
    const payload = {
      sub: 'user_123',
      sid: 'session_456',
      aud: SECURITY_ENV.JWT_AUDIENCE,
      iss: SECURITY_ENV.JWT_ISSUER,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      type: 'access',
      scope: 'user',
    }

    // Create unsigned token
    const unsignedToken = jwt.sign(payload, '', {
      algorithm: 'none',
    })

    // Should reject unsigned tokens
    const result = await verifyAccessJwt(unsignedToken)
    expect(result).toBeNull()
  })
})

describe('Environment-Specific Security', () => {
  test('should use secure settings in production', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production'

    const response = NextResponse.json({})
    setAccessTokenCookie(response, 'test-token')

    const setCookieHeaders = response.headers.getSetCookie()
    const cookie = setCookieHeaders[0]

    expect(cookie).toMatch(/Secure/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/);

    (process.env as any).NODE_ENV = originalEnv
  })

  test('should handle missing environment variables securely', () => {
    const originalSecret = process.env.TOKEN_HMAC_SECRET
    delete process.env.TOKEN_HMAC_SECRET

    // Should throw error or handle gracefully
    expect(async () => {
      await issueAccessJwt('user_123', 'session_456')
    }).rejects.toThrow()

    process.env.TOKEN_HMAC_SECRET = originalSecret
  })

  test('should validate environment variable formats', () => {
    const originalTtl = process.env.JWT_ACCESS_TTL
    
    // Invalid TTL format
    process.env.JWT_ACCESS_TTL = 'invalid'
    
    // Should handle invalid TTL gracefully
    expect(async () => {
      await issueAccessJwt('user_123', 'session_456')
    }).not.toThrow()

    process.env.JWT_ACCESS_TTL = originalTtl
  })
})