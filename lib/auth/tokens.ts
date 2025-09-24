import { prisma } from '../prisma'
import { createSecureToken } from './crypto'
import { createHmac } from 'crypto'

const TOKEN_HMAC_SECRET = process.env.TOKEN_HMAC_SECRET || 'fallback-secret'

// Create HMAC of token for secure storage (per security contracts)
function createTokenHmac(token: string): string {
  return createHmac('sha256', TOKEN_HMAC_SECRET).update(token).digest('hex')
}

export type TokenType = 'verify_email' | 'password_reset' | 'change_email'

interface CreateTokenOptions {
  userId: string
  type: TokenType
  expiresInMinutes?: number
  targetEmail?: string
}

// Create email action token (32B random → store HMAC per security contracts)
export async function createEmailActionToken(options: CreateTokenOptions): Promise<string> {
  const { userId, type, expiresInMinutes, targetEmail } = options
  
  // Generate secure 32-byte token
  const token = createSecureToken(32)
  const tokenHmac = createTokenHmac(token)
  
  // Set TTL based on token type (per security contracts)
  let expiryMinutes: number
  if (type === 'verify_email') {
    expiryMinutes = 1440 // 24 hours
  } else if (type === 'password_reset') {
    expiryMinutes = 30 // 30 minutes
  } else if (type === 'change_email') {
    expiryMinutes = 1440 // 24 hours
  } else {
    expiryMinutes = expiresInMinutes || 60
  }
  
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)
  
  // Store HMAC of token, not the token itself (per security contracts)
  await prisma.emailActionToken.create({
    data: {
      userId,
      type,
      tokenHash: tokenHmac,
      targetEmail,
      expiresAt,
    },
  })
  
  return token
}

// Verify token without consuming it (for validation purposes)
export async function verifyEmailActionToken(
  token: string,
  expectedType: TokenType
): Promise<{ userId: string; targetEmail?: string } | null> {
  const tokenHmac = createTokenHmac(token)

  // Find valid token by HMAC without consuming it
  const emailToken = await prisma.emailActionToken.findFirst({
    where: {
      tokenHash: tokenHmac,
      type: expectedType,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
  })

  if (!emailToken) {
    return null
  }

  return {
    userId: emailToken.userId,
    targetEmail: emailToken.targetEmail || undefined,
  }
}

// Verify and consume email action token (single-use per security contracts)
export async function verifyAndConsumeEmailActionToken(
  token: string,
  expectedType: TokenType
): Promise<{ userId: string; targetEmail?: string } | null> {
  const tokenHmac = createTokenHmac(token)

  // Find valid token by HMAC
  const emailToken = await prisma.emailActionToken.findFirst({
    where: {
      tokenHash: tokenHmac,
      type: expectedType,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
  })

  if (!emailToken) {
    return null
  }

  // Mark token as consumed (single-use per security contracts)
  await prisma.emailActionToken.update({
    where: { id: emailToken.id },
    data: { consumedAt: new Date() },
  })

  return {
    userId: emailToken.userId,
    targetEmail: emailToken.targetEmail || undefined,
  }
}

// Clean up expired tokens
export async function cleanupExpiredTokens(): Promise<void> {
  await prisma.emailActionToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { consumedAt: { not: null } },
      ],
    },
  })
}

// Revoke all tokens for a user of a specific type
export async function revokeUserTokens(userId: string, type: TokenType): Promise<void> {
  await prisma.emailActionToken.updateMany({
    where: {
      userId,
      type,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  })
}