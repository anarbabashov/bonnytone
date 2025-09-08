import { prisma } from '../prisma'
import { createSecureToken, hashToken } from './crypto'
import { createAccessToken, createRefreshToken, getRefreshTokenExpiry } from './jwt'
import { UAParser } from 'ua-parser-js'
import { logAuthEvent } from '../observability'
import { authMetrics } from '../observability/metrics'

export interface SessionInfo {
  sessionId: string
  accessToken: string
  refreshToken: string
}

// Create a new session
export async function createSession(
  userId: string,
  ip?: string,
  userAgent?: string
): Promise<SessionInfo> {
  // Parse user agent
  const parser = new UAParser(userAgent)
  const parsedUA = parser.getResult()
  const formattedUA = `${parsedUA.browser.name || 'Unknown'} ${parsedUA.browser.version || ''} on ${parsedUA.os.name || 'Unknown'}`
  
  // Create session record
  const session = await prisma.session.create({
    data: {
      userId,
      ip,
      userAgent: formattedUA,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  })
  
  // Create refresh token with family ID for reuse detection
  const refreshTokenId = createSecureToken(32)
  const refreshTokenHash = hashToken(refreshTokenId)
  const tokenFamily = createSecureToken(16) // Family ID for all tokens in this chain
  
  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      userId,
      sessionId: session.id,
      tokenHash: refreshTokenHash,
      tokenFamily,
      expiresAt: getRefreshTokenExpiry(),
    },
  })
  
  // Create JWT tokens
  const accessToken = await createAccessToken(userId, session.id)
  const refreshToken = await createRefreshToken(userId, refreshTokenId, session.id)
  
  return {
    sessionId: session.id,
    accessToken,
    refreshToken,
  }
}

// Refresh access token with reuse detection
export async function refreshAccessToken(
  refreshTokenId: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const tokenHash = hashToken(refreshTokenId)
  
  // Find refresh token (including already rotated ones for reuse detection)
  const refreshTokenRecord = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      session: {
        select: {
          userId: true,
          id: true,
          revokedAt: true,
          expiresAt: true,
        },
      },
    },
  })
  
  if (!refreshTokenRecord || !refreshTokenRecord.session) {
    return null
  }
  
  // SECURITY: Check for token reuse (already rotated token being used again)
  if (refreshTokenRecord.rotatedAt) {
    // This is a security violation - token reuse detected
    
    // Emit critical security metrics
    authMetrics.tokenReuse(refreshTokenRecord.session.id, refreshTokenRecord.session.userId)
    
    // Log security event
    logAuthEvent('token_reuse', refreshTokenRecord.session.userId, refreshTokenRecord.session.id, undefined, {
      tokenFamily: refreshTokenRecord.tokenFamily,
      originalRotatedAt: refreshTokenRecord.rotatedAt.toISOString(),
    })
    
    // Mark token as reused and revoke entire token family + session
    await prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { 
        reusedAt: new Date(),
        revokedAt: new Date(),
      },
    })
    
    // Revoke all tokens in the same family
    await prisma.refreshToken.updateMany({
      where: {
        tokenFamily: refreshTokenRecord.tokenFamily,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })
    
    // Revoke the entire session
    await revokeSession(refreshTokenRecord.session.id)
    
    return null
  }
  
  // Check if session is still valid
  if (refreshTokenRecord.session.revokedAt || refreshTokenRecord.session.expiresAt < new Date()) {
    return null
  }
  
  // Mark old refresh token as rotated (rotate on every use)
  await prisma.refreshToken.update({
    where: { id: refreshTokenRecord.id },
    data: { rotatedAt: new Date() },
  })
  
  // Create new refresh token in the same family
  const newRefreshTokenId = createSecureToken(32)
  const newRefreshTokenHash = hashToken(newRefreshTokenId)
  
  await prisma.refreshToken.create({
    data: {
      id: newRefreshTokenId,
      userId: refreshTokenRecord.userId,
      sessionId: refreshTokenRecord.sessionId,
      tokenHash: newRefreshTokenHash,
      tokenFamily: refreshTokenRecord.tokenFamily, // Same family for reuse detection
      expiresAt: getRefreshTokenExpiry(),
    },
  })
  
  // Create new access token
  const accessToken = await createAccessToken(
    refreshTokenRecord.session.userId,
    refreshTokenRecord.session.id
  )
  
  const refreshToken = await createRefreshToken(
    refreshTokenRecord.session.userId,
    newRefreshTokenId,
    refreshTokenRecord.session.id
  )
  
  // Emit success metrics
  authMetrics.sessionEvent('refreshed')
  
  return { accessToken, refreshToken }
}

// Revoke session
export async function revokeSession(sessionId: string): Promise<void> {
  // Emit metrics
  authMetrics.sessionEvent('revoked')
  
  await Promise.all([
    // Mark session as revoked
    prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    }),
    // Revoke all refresh tokens for this session
    prisma.refreshToken.updateMany({
      where: { sessionId },
      data: { revokedAt: new Date() },
    }),
  ])
}

// Revoke all user sessions
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await Promise.all([
    // Mark all user sessions as revoked
    prisma.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    }),
    // Revoke all user refresh tokens
    prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    }),
  ])
}

// Get user sessions
export async function getUserSessions(userId: string) {
  return prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// Clean up expired sessions and tokens
export async function cleanupExpiredSessions(): Promise<void> {
  const now = new Date()
  
  await Promise.all([
    // Delete expired sessions
    prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    // Delete expired refresh tokens
    prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
  ])
}