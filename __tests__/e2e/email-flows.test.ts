/**
 * E2E Email Flow Tests
 * 
 * Tests complete email flows using dev transport,
 * token extraction, and state verification.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { sendEmail } from '@/lib/auth/email'
import { createEmailActionToken, verifyEmailActionToken } from '@/lib/auth/tokens'
import { POST as registerHandler } from '@/app/api/auth/register/route'
import { POST as verifyEmailHandler } from '@/app/api/auth/verify-email/route'
import { POST as forgotPasswordHandler } from '@/app/api/auth/forgot-password/route'
import { POST as resetPasswordHandler } from '@/app/api/auth/reset-password/route'
import { NextRequest } from 'next/server'

// Mock Prisma for E2E tests
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    emailActionToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    loginAttempt: {
      create: jest.fn(),
    },
  },
}))

// Mock rate limiting
jest.mock('@/lib/auth/rates', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true }),
  getClientIp: jest.fn().mockReturnValue('192.168.1.1'),
}))

// Mock observability
jest.mock('@/lib/observability', () => ({
  logAuthEvent: jest.fn(),
}))

jest.mock('@/lib/observability/metrics', () => ({
  authMetrics: {
    registerSuccess: jest.fn(),
    emailSent: jest.fn(),
    httpResponse: jest.fn(),
  },
  timeAuthRequest: jest.fn((endpoint, method, fn) => fn()),
}))

const { prisma } = require('@/lib/prisma')

// Email dev transport directory
const EMAIL_DEV_DIR = path.join(process.cwd(), 'tmp', 'emails')

// Helper to create NextRequest
function createRequest(method: string, body?: any) {
  const url = 'http://localhost:3000/api/auth/test'
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
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

// Helper to read latest email file
async function readLatestEmail(): Promise<{ subject: string; content: string; token?: string } | null> {
  try {
    await fs.mkdir(EMAIL_DEV_DIR, { recursive: true })
    const files = await fs.readdir(EMAIL_DEV_DIR)
    
    if (files.length === 0) {
      return null
    }
    
    // Get most recent .eml file
    const emailFiles = files.filter(f => f.endsWith('.eml'))
    if (emailFiles.length === 0) {
      return null
    }
    
    emailFiles.sort()
    const latestFile = emailFiles[emailFiles.length - 1]
    const emailPath = path.join(EMAIL_DEV_DIR, latestFile)
    
    const content = await fs.readFile(emailPath, 'utf-8')
    
    // Extract subject
    const subjectMatch = content.match(/Subject: (.+)/)
    const subject = subjectMatch ? subjectMatch[1].trim() : ''
    
    // Extract token from email content (look for token parameter)
    const tokenMatch = content.match(/token=([a-zA-Z0-9_-]+)/)
    const token = tokenMatch ? tokenMatch[1] : undefined
    
    return { subject, content, token }
  } catch (error) {
    console.error('Error reading email:', error)
    return null
  }
}

// Helper to clear email directory
async function clearEmails() {
  try {
    await fs.mkdir(EMAIL_DEV_DIR, { recursive: true })
    const files = await fs.readdir(EMAIL_DEV_DIR)
    
    for (const file of files) {
      await fs.unlink(path.join(EMAIL_DEV_DIR, file))
    }
  } catch (error) {
    // Directory might not exist, that's OK
  }
}

describe('Email Verification Flow', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await clearEmails()
    
    // Ensure we're using dev email provider
    process.env.EMAIL_PROVIDER = 'dev'
  })

  test('complete registration → verify email flow', async () => {
    const testUser = {
      id: 'user_123',
      email: 'newuser@example.com',
      displayName: 'Test User',
      emailVerifiedAt: null,
    }

    const mockToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'verify_email',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      consumedAt: null,
    }

    // Mock database responses
    prisma.user.findUnique.mockResolvedValue(null) // No existing user
    prisma.user.create.mockResolvedValue(testUser)
    prisma.emailActionToken.create.mockResolvedValue(mockToken)

    // Mock password hashing
    const crypto = require('@/lib/auth/crypto')
    crypto.hashPassword = jest.fn().mockResolvedValue('$argon2id$hashed')

    // Step 1: Register user
    const registerRequest = createRequest('POST', {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      displayName: 'Test User',
    })

    const registerResponse = await registerHandler(registerRequest)
    const registerData = await getJsonResponse(registerResponse)

    expect(registerResponse.status).toBe(201)
    expect(registerData.ok).toBe(true)
    
    // Wait for email to be written
    await new Promise(resolve => setTimeout(resolve, 100))

    // Step 2: Check verification email was sent
    const email = await readLatestEmail()
    expect(email).toBeDefined()
    expect(email!.subject).toContain('Verify')
    expect(email!.content).toContain('newuser@example.com')
    expect(email!.token).toBeDefined()

    // Step 3: Verify email with extracted token
    prisma.emailActionToken.findFirst.mockResolvedValue(mockToken)
    prisma.user.findUnique.mockResolvedValue(testUser) // User not verified yet
    prisma.user.update.mockResolvedValue({ ...testUser, emailVerifiedAt: new Date() })
    prisma.emailActionToken.update.mockResolvedValue({})

    // Mock token verification
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)

    const verifyRequest = createRequest('POST', {
      token: email!.token,
    })

    const verifyResponse = await verifyEmailHandler(verifyRequest)
    const verifyData = await getJsonResponse(verifyResponse)

    expect(verifyResponse.status).toBe(200)
    expect(verifyData.message).toBe('Email verified successfully')

    // Verify database calls
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_123' },
      data: { emailVerifiedAt: expect.any(Date) },
    })

    expect(prisma.emailActionToken.update).toHaveBeenCalledWith({
      where: { id: 'token_123' },
      data: { consumedAt: expect.any(Date) },
    })
  })

  test('should handle verification of already verified email', async () => {
    const verifiedUser = {
      id: 'user_123',
      email: 'verified@example.com',
      emailVerifiedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Verified yesterday
    }

    const mockToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'verify_email',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      consumedAt: null,
    }

    prisma.emailActionToken.findFirst.mockResolvedValue(mockToken)
    prisma.user.findUnique.mockResolvedValue(verifiedUser)

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)

    const verifyRequest = createRequest('POST', {
      token: 'some-token',
    })

    const verifyResponse = await verifyEmailHandler(verifyRequest)
    const verifyData = await getJsonResponse(verifyResponse)

    expect(verifyResponse.status).toBe(400)
    expect(verifyData.error).toBe('Email is already verified')
  })

  test('should reject expired verification token', async () => {
    const expiredToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'verify_email',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
      consumedAt: null,
    }

    prisma.emailActionToken.findFirst.mockResolvedValue(expiredToken)

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)

    const verifyRequest = createRequest('POST', {
      token: 'expired-token',
    })

    const verifyResponse = await verifyEmailHandler(verifyRequest)
    const verifyData = await getJsonResponse(verifyResponse)

    expect(verifyResponse.status).toBe(400)
    expect(verifyData.error).toBe('Invalid or expired verification token')
  })
})

describe('Password Reset Flow', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await clearEmails()
    process.env.EMAIL_PROVIDER = 'dev'
  })

  test('complete forgot password → reset password flow', async () => {
    const existingUser = {
      id: 'user_123',
      email: 'user@example.com',
      displayName: 'Existing User',
    }

    const resetToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'password_reset',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      consumedAt: null,
    }

    // Step 1: Request password reset
    prisma.user.findUnique.mockResolvedValue(existingUser)
    prisma.emailActionToken.create.mockResolvedValue(resetToken)

    const forgotRequest = createRequest('POST', {
      email: 'user@example.com',
    })

    const forgotResponse = await forgotPasswordHandler(forgotRequest)
    const forgotData = await getJsonResponse(forgotResponse)

    expect(forgotResponse.status).toBe(200)
    expect(forgotData.message).toContain('password reset link has been sent')

    // Wait for email to be written
    await new Promise(resolve => setTimeout(resolve, 100))

    // Step 2: Check reset email was sent
    const email = await readLatestEmail()
    expect(email).toBeDefined()
    expect(email!.subject).toContain('Password Reset')
    expect(email!.content).toContain('user@example.com')
    expect(email!.token).toBeDefined()

    // Step 3: Reset password with extracted token
    prisma.emailActionToken.findFirst.mockResolvedValue(resetToken)
    prisma.user.findUnique.mockResolvedValue(existingUser)
    prisma.emailActionToken.update.mockResolvedValue({})
    prisma.user.update.mockResolvedValue({})

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)
    crypto.hashPassword = jest.fn().mockResolvedValue('$argon2id$new-hash')

    const resetRequest = createRequest('POST', {
      token: email!.token,
      password: 'NewSecurePassword123!',
    })

    const resetResponse = await resetPasswordHandler(resetRequest)
    const resetData = await getJsonResponse(resetResponse)

    expect(resetResponse.status).toBe(200)
    expect(resetData.message).toBe('Password has been reset successfully')

    // Verify database calls
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_123' },
      data: { passwordHash: '$argon2id$new-hash' },
    })

    expect(prisma.emailActionToken.update).toHaveBeenCalledWith({
      where: { id: 'token_123' },
      data: { consumedAt: expect.any(Date) },
    })
  })

  test('should not send email for non-existent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    const forgotRequest = createRequest('POST', {
      email: 'nonexistent@example.com',
    })

    const forgotResponse = await forgotPasswordHandler(forgotRequest)
    const forgotData = await getJsonResponse(forgotResponse)

    // Should return success to prevent user enumeration
    expect(forgotResponse.status).toBe(200)
    expect(forgotData.message).toContain('password reset link has been sent')

    // Wait to ensure no email is sent
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check no email was sent
    const email = await readLatestEmail()
    expect(email).toBeNull()
  })

  test('should reject reset with consumed token', async () => {
    const consumedToken = {
      id: 'token_123',
      userId: 'user_123',
      type: 'password_reset',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      consumedAt: new Date(Date.now() - 30 * 60 * 1000), // Consumed 30 minutes ago
    }

    prisma.emailActionToken.findFirst.mockResolvedValue(consumedToken)

    const crypto = require('@/lib/auth/crypto')
    crypto.verifyHashedToken = jest.fn().mockReturnValue(true)

    const resetRequest = createRequest('POST', {
      token: 'consumed-token',
      password: 'NewSecurePassword123!',
    })

    const resetResponse = await resetPasswordHandler(resetRequest)
    const resetData = await getJsonResponse(resetResponse)

    expect(resetResponse.status).toBe(400)
    expect(resetData.error).toBe('Invalid or expired reset token')
  })
})

describe('Email Templates and Content', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await clearEmails()
    process.env.EMAIL_PROVIDER = 'dev'
  })

  test('should generate correct verification email template', async () => {
    await sendEmail('verify_email', 'test@example.com', {
      token: 'test-verification-token',
      displayName: 'Test User',
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const email = await readLatestEmail()
    expect(email).toBeDefined()
    expect(email!.subject).toContain('Verify your email address')
    expect(email!.content).toContain('test@example.com')
    expect(email!.content).toContain('Test User')
    expect(email!.content).toContain('test-verification-token')
    expect(email!.content).toContain('http') // Should contain verification link
  })

  test('should generate correct password reset email template', async () => {
    await sendEmail('password_reset', 'user@example.com', {
      token: 'test-reset-token',
      displayName: 'User Name',
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const email = await readLatestEmail()
    expect(email).toBeDefined()
    expect(email!.subject).toContain('Password Reset')
    expect(email!.content).toContain('user@example.com')
    expect(email!.content).toContain('User Name')
    expect(email!.content).toContain('test-reset-token')
    expect(email!.content).toContain('reset your password')
  })

  test('should generate correct email change confirmation template', async () => {
    await sendEmail('email_change_confirm', 'newemail@example.com', {
      token: 'test-change-token',
      displayName: 'User Name',
      newEmail: 'newemail@example.com',
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const email = await readLatestEmail()
    expect(email).toBeDefined()
    expect(email!.subject).toContain('Confirm email address change')
    expect(email!.content).toContain('newemail@example.com')
    expect(email!.content).toContain('User Name')
    expect(email!.content).toContain('test-change-token')
  })

  test('should generate correct email changed notification template', async () => {
    await sendEmail('email_changed_notification', 'oldemail@example.com', {
      displayName: 'User Name',
      newEmail: 'newemail@example.com',
      timestamp: new Date().toISOString(),
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const email = await readLatestEmail()
    expect(email).toBeDefined()
    expect(email!.subject).toContain('Email address changed')
    expect(email!.content).toContain('oldemail@example.com')
    expect(email!.content).toContain('newemail@example.com')
    expect(email!.content).toContain('User Name')
  })

  test('should generate correct login alert template', async () => {
    await sendEmail('login_alert', 'user@example.com', {
      displayName: 'User Name',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      timestamp: new Date().toISOString(),
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const email = await readLatestEmail()
    expect(email).toBeDefined()
    expect(email!.subject).toContain('New login to your account')
    expect(email!.content).toContain('user@example.com')
    expect(email!.content).toContain('User Name')
    expect(email!.content).toContain('192.168.1.100')
    expect(email!.content).toContain('Mozilla/5.0')
  })
})

describe('Token Security in Emails', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await clearEmails()
    process.env.EMAIL_PROVIDER = 'dev'
  })

  test('email tokens should be URL-safe', async () => {
    await sendEmail('verify_email', 'test@example.com', {
      token: 'test-token-with-special-chars_123',
      displayName: 'Test User',
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const email = await readLatestEmail()
    expect(email).toBeDefined()
    expect(email!.token).toBeDefined()
    
    // Token should not contain URL-unsafe characters
    expect(email!.token).not.toMatch(/[+/=\s]/)
    expect(email!.token).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  test('should handle missing template data gracefully', async () => {
    // Send email with incomplete data
    await sendEmail('verify_email', 'test@example.com', {
      token: 'test-token',
      // Missing displayName
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const email = await readLatestEmail()
    expect(email).toBeDefined()
    expect(email!.content).toContain('test-token')
    // Should handle missing displayName gracefully
    expect(email!.content).not.toContain('undefined')
    expect(email!.content).not.toContain('null')
  })

  test('should escape HTML in template data', async () => {
    await sendEmail('verify_email', 'test@example.com', {
      token: 'test-token',
      displayName: '<script>alert("xss")</script>',
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const email = await readLatestEmail()
    expect(email).toBeDefined()
    
    // Script tags should be escaped or removed
    expect(email!.content).not.toContain('<script>')
    expect(email!.content).not.toContain('alert("xss")')
  })
})

describe('Email Dev Transport Functionality', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await clearEmails()
    process.env.EMAIL_PROVIDER = 'dev'
  })

  test('should create .eml files in dev mode', async () => {
    await sendEmail('verify_email', 'test@example.com', {
      token: 'test-token',
      displayName: 'Test User',
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // Check file was created
    const files = await fs.readdir(EMAIL_DEV_DIR)
    const emlFiles = files.filter(f => f.endsWith('.eml'))
    
    expect(emlFiles.length).toBeGreaterThan(0)
    
    // Check file format
    const emailPath = path.join(EMAIL_DEV_DIR, emlFiles[0])
    const content = await fs.readFile(emailPath, 'utf-8')
    
    expect(content).toContain('To: test@example.com')
    expect(content).toContain('From:')
    expect(content).toContain('Subject:')
    expect(content).toContain('Date:')
  })

  test('should handle multiple concurrent emails', async () => {
    const promises = [
      sendEmail('verify_email', 'user1@example.com', { token: 'token1', displayName: 'User 1' }),
      sendEmail('password_reset', 'user2@example.com', { token: 'token2', displayName: 'User 2' }),
      sendEmail('login_alert', 'user3@example.com', { displayName: 'User 3', ip: '192.168.1.1' }),
    ]

    await Promise.all(promises)
    await new Promise(resolve => setTimeout(resolve, 200))

    const files = await fs.readdir(EMAIL_DEV_DIR)
    const emlFiles = files.filter(f => f.endsWith('.eml'))
    
    expect(emlFiles.length).toBe(3)
  })
})

afterAll(async () => {
  // Clean up test emails
  await clearEmails()
})