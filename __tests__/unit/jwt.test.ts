/**
 * Unit Tests for JWT Operations
 * 
 * Tests JWT creation, verification, token rotation,
 * and security contract compliance (aud, iss, claims).
 */

import {
  createAccessToken,
  createRefreshToken,
  issueAccessJwt,
  verifyAccessJwt,
  verifyRefreshToken,
  getRefreshTokenExpiry,
  AccessTokenPayload,
  RefreshTokenPayload,
} from '@/lib/auth/jwt'
import jwt from 'jsonwebtoken'

// Mock environment for consistent testing
const mockEnv = {
  JWT_ISSUER: 'test-issuer',
  JWT_AUDIENCE: 'test-audience',
  JWT_ALGORITHM: 'HS512',
  JWT_ACCESS_TTL: '600', // 10 minutes
  JWT_REFRESH_TTL: '2592000', // 30 days
  TOKEN_HMAC_SECRET: 'test-secret-key-32-bytes-long-exactly',
}

// Set environment variables
Object.keys(mockEnv).forEach(key => {
  process.env[key] = mockEnv[key as keyof typeof mockEnv]
})

describe('JWT Token Creation', () => {
  const userId = 'user_123'
  const sessionId = 'session_456'
  const refreshTokenId = 'refresh_789'

  test('should create access token with correct structure', async () => {
    const token = await createAccessToken(userId, sessionId)
    
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    
    // Decode without verification to check structure
    const decoded = jwt.decode(token) as any
    expect(decoded).toBeDefined()
    expect(decoded.sub).toBe(userId)
    expect(decoded.sid).toBe(sessionId)
    expect(decoded.iss).toBe(mockEnv.JWT_ISSUER)
    expect(decoded.aud).toBe(mockEnv.JWT_AUDIENCE)
    expect(decoded.type).toBe('access')
    expect(decoded.scope).toBe('user')
  })

  test('should create refresh token with correct structure', async () => {
    const token = await createRefreshToken(userId, refreshTokenId, sessionId)
    
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    
    const decoded = jwt.decode(token) as any
    expect(decoded).toBeDefined()
    expect(decoded.sub).toBe(userId)
    expect(decoded.jti).toBe(refreshTokenId)
    expect(decoded.sid).toBe(sessionId)
    expect(decoded.iss).toBe(mockEnv.JWT_ISSUER)
    expect(decoded.aud).toBe(mockEnv.JWT_AUDIENCE)
    expect(decoded.type).toBe('refresh')
  })

  test('should create access token with custom scope', async () => {
    const token = await issueAccessJwt(userId, sessionId, 'admin')
    
    const decoded = jwt.decode(token) as any
    expect(decoded.scope).toBe('admin')
  })

  test('should have correct expiration times', async () => {
    const accessToken = await createAccessToken(userId, sessionId)
    const refreshToken = await createRefreshToken(userId, refreshTokenId, sessionId)
    
    const accessDecoded = jwt.decode(accessToken) as any
    const refreshDecoded = jwt.decode(refreshToken) as any
    
    const now = Math.floor(Date.now() / 1000)
    
    // Access token should expire in ~10 minutes
    expect(accessDecoded.exp - accessDecoded.iat).toBe(parseInt(mockEnv.JWT_ACCESS_TTL))
    expect(accessDecoded.exp).toBeGreaterThan(now + 590) // Allow some variance
    expect(accessDecoded.exp).toBeLessThan(now + 610)
    
    // Refresh token should expire in ~30 days
    expect(refreshDecoded.exp - refreshDecoded.iat).toBe(parseInt(mockEnv.JWT_REFRESH_TTL))
    expect(refreshDecoded.exp).toBeGreaterThan(now + 2592000 - 10) // Allow some variance
  })
})

describe('JWT Token Verification', () => {
  const userId = 'user_123'
  const sessionId = 'session_456'
  const refreshTokenId = 'refresh_789'

  test('should verify valid access token', async () => {
    const token = await createAccessToken(userId, sessionId)
    const payload = await verifyAccessJwt(token)
    
    expect(payload).toBeDefined()
    expect(payload!.sub).toBe(userId)
    expect(payload!.sid).toBe(sessionId)
    expect(payload!.iss).toBe(mockEnv.JWT_ISSUER)
    expect(payload!.aud).toBe(mockEnv.JWT_AUDIENCE)
    expect(payload!.type).toBe('access')
    expect(payload!.scope).toBe('user')
  })

  test('should verify valid refresh token', async () => {
    const token = await createRefreshToken(userId, refreshTokenId, sessionId)
    const payload = await verifyRefreshToken(token)
    
    expect(payload).toBeDefined()
    expect(payload!.sub).toBe(userId)
    expect(payload!.jti).toBe(refreshTokenId)
    expect(payload!.sid).toBe(sessionId)
    expect(payload!.iss).toBe(mockEnv.JWT_ISSUER)
    expect(payload!.aud).toBe(mockEnv.JWT_AUDIENCE)
    expect(payload!.type).toBe('refresh')
  })

  test('should reject invalid signature', async () => {
    const token = await createAccessToken(userId, sessionId)
    
    // Tamper with the token
    const tamperedToken = token.slice(0, -5) + 'XXXXX'
    
    const payload = await verifyAccessJwt(tamperedToken)
    expect(payload).toBeNull()
  })

  test('should reject expired token', async () => {
    // Create token with very short expiry
    const originalTtl = process.env.JWT_ACCESS_TTL
    process.env.JWT_ACCESS_TTL = '1' // 1 second
    
    const token = await createAccessToken(userId, sessionId)
    
    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const payload = await verifyAccessJwt(token)
    expect(payload).toBeNull()
    
    // Restore original TTL
    process.env.JWT_ACCESS_TTL = originalTtl
  }, 3000)

  test('should reject token with wrong audience', async () => {
    const token = await createAccessToken(userId, sessionId)
    
    // Change audience in environment
    const originalAud = process.env.JWT_AUDIENCE
    process.env.JWT_AUDIENCE = 'wrong-audience'
    
    const payload = await verifyAccessJwt(token)
    expect(payload).toBeNull()
    
    // Restore original audience
    process.env.JWT_AUDIENCE = originalAud
  })

  test('should reject token with wrong issuer', async () => {
    const token = await createAccessToken(userId, sessionId)
    
    // Change issuer in environment
    const originalIss = process.env.JWT_ISSUER
    process.env.JWT_ISSUER = 'wrong-issuer'
    
    const payload = await verifyAccessJwt(token)
    expect(payload).toBeNull()
    
    // Restore original issuer
    process.env.JWT_ISSUER = originalIss
  })

  test('should reject malformed token', async () => {
    const invalidTokens = [
      'invalid-jwt-token',
      'header.payload', // Missing signature
      'not.a.jwt.token.at.all',
      '', // Empty string
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.signature', // Invalid payload
    ]
    
    for (const invalidToken of invalidTokens) {
      const payload = await verifyAccessJwt(invalidToken)
      expect(payload).toBeNull()
    }
  })
})

describe('JWT Security Contracts', () => {
  const userId = 'user_123'
  const sessionId = 'session_456'

  test('access token should have all required claims', async () => {
    const token = await createAccessToken(userId, sessionId)
    const payload = await verifyAccessJwt(token)
    
    expect(payload).toBeDefined()
    
    // Required by security contract
    expect(payload!.sub).toBeDefined() // Subject (userId)
    expect(payload!.iss).toBeDefined() // Issuer
    expect(payload!.aud).toBeDefined() // Audience
    expect(payload!.sid).toBeDefined() // Session ID
    expect(payload!.scope).toBeDefined() // Scope
    expect(payload!.type).toBe('access') // Token type
    
    // Standard JWT claims
    expect(payload!.iat).toBeDefined() // Issued at
    expect(payload!.exp).toBeDefined() // Expires at
    expect(payload!.exp).toBeGreaterThan(payload!.iat!)
  })

  test('refresh token should have all required claims', async () => {
    const token = await createRefreshToken(userId, 'refresh_123', sessionId)
    const payload = await verifyRefreshToken(token)
    
    expect(payload).toBeDefined()
    
    // Required by security contract
    expect(payload!.sub).toBeDefined() // Subject (userId)
    expect(payload!.iss).toBeDefined() // Issuer
    expect(payload!.aud).toBeDefined() // Audience
    expect(payload!.jti).toBeDefined() // JWT ID (refresh token ID)
    expect(payload!.sid).toBeDefined() // Session ID
    expect(payload!.type).toBe('refresh') // Token type
    
    // Standard JWT claims
    expect(payload!.iat).toBeDefined() // Issued at
    expect(payload!.exp).toBeDefined() // Expires at
    expect(payload!.exp).toBeGreaterThan(payload!.iat!)
  })

  test('should validate issuer matches environment', async () => {
    const token = await createAccessToken(userId, sessionId)
    const payload = await verifyAccessJwt(token)
    
    expect(payload!.iss).toBe(process.env.JWT_ISSUER)
  })

  test('should validate audience matches environment', async () => {
    const token = await createAccessToken(userId, sessionId)
    const payload = await verifyAccessJwt(token)
    
    expect(payload!.aud).toBe(process.env.JWT_AUDIENCE)
  })

  test('should use correct algorithm', async () => {
    const token = await createAccessToken(userId, sessionId)
    
    // Decode header to check algorithm
    const headerB64 = token.split('.')[0]
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString())
    
    expect(header.alg).toBe(process.env.JWT_ALGORITHM)
  })
})

describe('Token Expiry Utilities', () => {
  test('should calculate correct refresh token expiry', () => {
    const expiry = getRefreshTokenExpiry()
    const now = new Date()
    const expectedExpiry = new Date(now.getTime() + parseInt(mockEnv.JWT_REFRESH_TTL) * 1000)
    
    // Allow 1 second variance
    expect(Math.abs(expiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000)
  })

  test('should handle different TTL values', () => {
    const originalTtl = process.env.JWT_REFRESH_TTL
    
    // Test with 1 hour TTL
    process.env.JWT_REFRESH_TTL = '3600'
    const expiry1h = getRefreshTokenExpiry()
    const now = new Date()
    const expected1h = new Date(now.getTime() + 3600 * 1000)
    
    expect(Math.abs(expiry1h.getTime() - expected1h.getTime())).toBeLessThan(1000)
    
    // Restore original TTL
    process.env.JWT_REFRESH_TTL = originalTtl
  })
})

describe('JWT Performance and Edge Cases', () => {
  const userId = 'user_123'
  const sessionId = 'session_456'

  test('should handle concurrent token creation', async () => {
    const promises = []
    
    // Create 10 tokens concurrently
    for (let i = 0; i < 10; i++) {
      promises.push(createAccessToken(`user_${i}`, `session_${i}`))
    }
    
    const tokens = await Promise.all(promises)
    
    // All tokens should be unique
    const tokenSet = new Set(tokens)
    expect(tokenSet.size).toBe(10)
    
    // All tokens should be valid
    for (const token of tokens) {
      const payload = await verifyAccessJwt(token)
      expect(payload).toBeDefined()
    }
  })

  test('should handle very long user IDs', async () => {
    const longUserId = 'u'.repeat(1000)
    const token = await createAccessToken(longUserId, sessionId)
    const payload = await verifyAccessJwt(token)
    
    expect(payload).toBeDefined()
    expect(payload!.sub).toBe(longUserId)
  })

  test('should handle Unicode in claims', async () => {
    const unicodeUserId = '用户_123_🔐'
    const unicodeSessionId = '会话_456_🚀'
    
    const token = await createAccessToken(unicodeUserId, unicodeSessionId)
    const payload = await verifyAccessJwt(token)
    
    expect(payload).toBeDefined()
    expect(payload!.sub).toBe(unicodeUserId)
    expect(payload!.sid).toBe(unicodeSessionId)
  })

  test('should handle empty strings gracefully', async () => {
    // Should not create tokens with empty required claims
    await expect(createAccessToken('', sessionId)).rejects.toThrow()
    await expect(createAccessToken(userId, '')).rejects.toThrow()
    await expect(createRefreshToken('', 'refresh_123', sessionId)).rejects.toThrow()
  })

  test('token creation should be fast', async () => {
    const iterations = 100
    const start = Date.now()
    
    const promises = []
    for (let i = 0; i < iterations; i++) {
      promises.push(createAccessToken(`user_${i}`, `session_${i}`))
    }
    
    await Promise.all(promises)
    const duration = Date.now() - start
    
    // Should create 100 tokens within 1 second
    expect(duration).toBeLessThan(1000)
  })

  test('token verification should be fast', async () => {
    const tokens = []
    
    // Create tokens first
    for (let i = 0; i < 50; i++) {
      tokens.push(await createAccessToken(`user_${i}`, `session_${i}`))
    }
    
    // Verify all tokens
    const start = Date.now()
    const results = await Promise.all(
      tokens.map(token => verifyAccessJwt(token))
    )
    const duration = Date.now() - start
    
    // All verifications should succeed
    expect(results.every(result => result !== null)).toBe(true)
    
    // Should verify 50 tokens within 1 second
    expect(duration).toBeLessThan(1000)
  })
})