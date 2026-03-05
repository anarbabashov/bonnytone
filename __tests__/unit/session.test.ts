/**
 * Unit Tests for Session Management
 * 
 * Tests token rotation, reuse detection, session creation,
 * and the security mechanisms around refresh tokens.
 */

import {
  createSession,
  refreshAccessToken as rotateRefreshToken,
  revokeSession,
  SessionInfo
} from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { verifyAccessJwt, verifyRefreshToken } from '@/lib/auth/jwt'

// Mock Prisma for unit testing
jest.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}))

// Mock observability
jest.mock('@/lib/observability', () => ({
  logAuthEvent: jest.fn(),
}))

jest.mock('@/lib/observability/metrics', () => ({
  authMetrics: {
    sessionEvent: jest.fn(),
    tokenReuse: jest.fn(),
  },
}))

const mockPrisma = prisma as any

describe('Session Creation', () => {
  const userId = 'user_123'
  const ip = '192.168.1.1'
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should create session with valid tokens', async () => {
    const sessionId = 'session_123'
    const refreshTokenId = 'refresh_123'

    // Mock database responses
    mockPrisma.session.create.mockResolvedValue({
      id: sessionId,
      userId,
      ip,
      userAgent: 'Chrome 91.0 on Windows',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      revokedAt: null,
    } as any)

    mockPrisma.refreshToken.create.mockResolvedValue({
      id: refreshTokenId,
      userId,
      sessionId,
      tokenHash: 'hashed-token',
      tokenFamily: 'family_123',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      rotatedAt: null,
      revokedAt: null,
      reusedAt: null,
    } as any)

    const sessionInfo = await createSession(userId, ip, userAgent)

    expect(sessionInfo).toBeDefined()
    expect(sessionInfo.sessionId).toBe(sessionId)
    expect(sessionInfo.accessToken).toBeDefined()
    expect(sessionInfo.refreshToken).toBeDefined()

    // Verify tokens are valid
    const accessPayload = await verifyAccessJwt(sessionInfo.accessToken)
    const refreshPayload = await verifyRefreshToken(sessionInfo.refreshToken)

    expect(accessPayload).toBeDefined()
    expect(accessPayload!.sub).toBe(userId)
    expect(accessPayload!.sid).toBe(sessionId)

    expect(refreshPayload).toBeDefined()
    expect(refreshPayload!.sub).toBe(userId)
    expect(refreshPayload!.sid).toBe(sessionId)

    // Verify database calls
    expect(mockPrisma.session.create).toHaveBeenCalledWith({
      data: {
        userId,
        ip,
        userAgent: expect.stringContaining('Chrome'),
        expiresAt: expect.any(Date),
      },
    })

    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        userId,
        sessionId,
        tokenHash: expect.any(String),
        tokenFamily: expect.any(String),
        expiresAt: expect.any(Date),
      },
    })
  })

  test('should parse user agent correctly', async () => {
    const sessionId = 'session_123'
    
    mockPrisma.session.create.mockResolvedValue({
      id: sessionId,
      userId,
      userAgent: 'Firefox 89.0 on macOS',
      createdAt: new Date(),
      expiresAt: new Date(),
    } as any)

    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'refresh_123',
      tokenFamily: 'family_123',
    } as any)

    const firefoxUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
    
    await createSession(userId, ip, firefoxUA)

    expect(mockPrisma.session.create).toHaveBeenCalledWith({
      data: {
        userId,
        ip,
        userAgent: expect.stringContaining('Firefox'),
        expiresAt: expect.any(Date),
      },
    })
  })

  test('should handle missing user agent', async () => {
    const sessionId = 'session_123'
    
    mockPrisma.session.create.mockResolvedValue({
      id: sessionId,
      userId,
      userAgent: 'Unknown',
      createdAt: new Date(),
      expiresAt: new Date(),
    } as any)

    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'refresh_123',
      tokenFamily: 'family_123',
    } as any)

    await createSession(userId, ip, undefined)

    expect(mockPrisma.session.create).toHaveBeenCalledWith({
      data: {
        userId,
        ip,
        userAgent: expect.stringContaining('Unknown'),
        expiresAt: expect.any(Date),
      },
    })
  })
})

describe('Token Rotation', () => {
  const userId = 'user_123'
  const sessionId = 'session_123'
  const refreshTokenId = 'refresh_123'
  const tokenFamily = 'family_123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should rotate refresh token successfully', async () => {
    const newRefreshTokenId = 'refresh_456'
    
    // Mock finding existing refresh token
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: refreshTokenId,
      userId,
      sessionId,
      tokenHash: 'old-token-hash',
      tokenFamily,
      rotatedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      session: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    } as any)

    // Mock marking old token as rotated
    mockPrisma.refreshToken.update.mockResolvedValueOnce({
      id: refreshTokenId,
      rotatedAt: new Date(),
    } as any)

    // Mock creating new token
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: newRefreshTokenId,
      userId,
      sessionId,
      tokenFamily,
      tokenHash: 'new-token-hash',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    } as any)

    const tokens = await rotateRefreshToken(refreshTokenId)

    expect(tokens).toBeDefined()
    expect(tokens!.accessToken).toBeDefined()
    expect(tokens!.refreshToken).toBeDefined()

    // Verify new tokens are valid
    const accessPayload = await verifyAccessJwt(tokens!.accessToken)
    const refreshPayload = await verifyRefreshToken(tokens!.refreshToken)

    expect(accessPayload!.sub).toBe(userId)
    expect(refreshPayload!.sub).toBe(userId)

    // Verify old token was marked as rotated
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: refreshTokenId },
      data: { rotatedAt: expect.any(Date) },
    })

    // Verify new token was created
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        userId,
        sessionId,
        tokenHash: expect.any(String),
        tokenFamily, // Same family for reuse detection
        expiresAt: expect.any(Date),
      },
    })
  })

  test('should detect token reuse and revoke session', async () => {
    const logAuthEvent = require('@/lib/observability').logAuthEvent
    const { authMetrics } = require('@/lib/observability/metrics')

    // Mock finding already rotated token
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: refreshTokenId,
      userId,
      sessionId,
      tokenFamily,
      rotatedAt: new Date(Date.now() - 60000), // Rotated 1 minute ago
      revokedAt: null,
      session: {
        id: sessionId,
        userId,
      },
    } as any)

    // Mock revoking tokens in family
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 })
    mockPrisma.session.update.mockResolvedValue({})

    const result = await rotateRefreshToken(refreshTokenId)

    expect(result).toBeNull()

    // Verify token reuse was logged
    expect(authMetrics.tokenReuse).toHaveBeenCalledWith(sessionId, userId)
    expect(logAuthEvent).toHaveBeenCalledWith(
      'token_reuse',
      userId,
      sessionId,
      undefined,
      expect.objectContaining({
        tokenFamily,
        originalRotatedAt: expect.any(String),
      })
    )

    // Verify token was marked as reused
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: refreshTokenId },
      data: {
        reusedAt: expect.any(Date),
        revokedAt: expect.any(Date),
      },
    })

    // Verify all tokens in family were revoked
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenFamily, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })

    // Verify session was revoked
    expect(mockPrisma.session.update).toHaveBeenCalledWith({
      where: { id: sessionId },
      data: { revokedAt: expect.any(Date) },
    })
  })

  test('should reject expired refresh token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: refreshTokenId,
      userId,
      sessionId,
      tokenFamily,
      rotatedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
      session: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000), // Session still valid
      },
    } as any)

    const result = await rotateRefreshToken(refreshTokenId)
    expect(result).toBeNull()
  })

  test('should reject token for revoked session', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: refreshTokenId,
      userId,
      sessionId,
      tokenFamily,
      rotatedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      session: {
        id: sessionId,
        userId,
        revokedAt: new Date(Date.now() - 60000), // Session revoked
        expiresAt: new Date(Date.now() + 60000),
      },
    } as any)

    const result = await rotateRefreshToken(refreshTokenId)
    expect(result).toBeNull()
  })

  test('should reject non-existent token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null)

    const result = await rotateRefreshToken('non-existent-token')
    expect(result).toBeNull()
  })

  test('should reject already revoked token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: refreshTokenId,
      userId,
      sessionId,
      tokenFamily,
      rotatedAt: null,
      revokedAt: new Date(Date.now() - 60000), // Already revoked
      expiresAt: new Date(Date.now() + 60000),
      session: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000),
      },
    } as any)

    const result = await rotateRefreshToken(refreshTokenId)
    expect(result).toBeNull()
  })
})

describe('Session Revocation', () => {
  const sessionId = 'session_123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should revoke session and all refresh tokens', async () => {
    const { authMetrics } = require('@/lib/observability/metrics')

    mockPrisma.session.update.mockResolvedValue({
      id: sessionId,
      revokedAt: new Date(),
    })

    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 })

    await revokeSession(sessionId)

    // Verify metrics were emitted
    expect(authMetrics.sessionEvent).toHaveBeenCalledWith('revoked')

    // Verify session was revoked
    expect(mockPrisma.session.update).toHaveBeenCalledWith({
      where: { id: sessionId },
      data: { revokedAt: expect.any(Date) },
    })

    // Verify all refresh tokens for session were revoked
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { sessionId },
      data: { revokedAt: expect.any(Date) },
    })
  })
})

describe('Security Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should handle rapid token rotation attempts', async () => {
    const refreshTokenId = 'refresh_123'
    const tokenFamily = 'family_123'

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: refreshTokenId,
      tokenFamily,
      rotatedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      session: {
        id: 'session_123',
        userId: 'user_123',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000),
      },
    } as any)

    mockPrisma.refreshToken.update.mockResolvedValue({})
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'refresh_456',
      tokenFamily,
    } as any)

    // Attempt multiple rotations simultaneously
    const promises = [
      rotateRefreshToken(refreshTokenId),
      rotateRefreshToken(refreshTokenId),
      rotateRefreshToken(refreshTokenId),
    ]

    const results = await Promise.all(promises)

    // Only one should succeed, others should fail due to database constraints
    const successCount = results.filter(result => result !== null).length
    expect(successCount).toBeLessThanOrEqual(1)
  })

  test('should handle token family cleanup on reuse', async () => {
    const refreshTokenId = 'refresh_123'
    const tokenFamily = 'family_123'
    const userId = 'user_123'
    const sessionId = 'session_123'

    // Simulate token that was already rotated (reuse attempt)
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: refreshTokenId,
      userId,
      sessionId,
      tokenFamily,
      rotatedAt: new Date(Date.now() - 30000), // Rotated 30 seconds ago
      revokedAt: null,
      session: {
        id: sessionId,
        userId,
      },
    } as any)

    mockPrisma.refreshToken.update.mockResolvedValue({})
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 5 }) // 5 tokens in family
    mockPrisma.session.update.mockResolvedValue({})

    await rotateRefreshToken(refreshTokenId)

    // Verify all tokens in family were revoked
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenFamily, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })

    // Verify session was revoked
    expect(mockPrisma.session.update).toHaveBeenCalledWith({
      where: { id: sessionId },
      data: { revokedAt: expect.any(Date) },
    })
  })

  test('should maintain token family across rotations', async () => {
    const originalFamily = 'family_123'
    const refreshTokenId = 'refresh_123'

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: refreshTokenId,
      userId: 'user_123',
      sessionId: 'session_123',
      tokenFamily: originalFamily,
      rotatedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      session: {
        id: 'session_123',
        userId: 'user_123',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000),
      },
    } as any)

    mockPrisma.refreshToken.update.mockResolvedValue({})
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'refresh_456',
      tokenFamily: originalFamily,
    } as any)

    await rotateRefreshToken(refreshTokenId)

    // Verify new token uses same family
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenFamily: originalFamily,
      }),
    })
  })
})