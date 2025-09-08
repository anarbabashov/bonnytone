/**
 * Unit Tests for Crypto Functions
 * 
 * Tests password hashing, token generation, HMAC operations,
 * and all cryptographic utilities used in the auth system.
 */

import {
  hashPassword,
  verifyPassword,
  needsRehash,
  createSecureToken,
  hashToken,
  verifyHashedToken,
  randomToken,
  hmacTokenHash,
} from '@/lib/auth/crypto'

describe('Password Hashing', () => {
  const testPassword = 'SecurePassword123!'
  let hashedPassword: string

  beforeAll(async () => {
    hashedPassword = await hashPassword(testPassword)
  })

  test('should hash password with Argon2id', async () => {
    const hash = await hashPassword(testPassword)
    
    expect(hash).toBeDefined()
    expect(hash).toMatch(/^\$argon2id\$/)
    expect(hash.length).toBeGreaterThan(50)
    
    // Each hash should be unique due to salt
    const hash2 = await hashPassword(testPassword)
    expect(hash).not.toBe(hash2)
  })

  test('should verify correct password', async () => {
    const isValid = await verifyPassword(hashedPassword, testPassword)
    expect(isValid).toBe(true)
  })

  test('should reject incorrect password', async () => {
    const isValid = await verifyPassword(hashedPassword, 'WrongPassword')
    expect(isValid).toBe(false)
  })

  test('should reject empty password', async () => {
    const isValid = await verifyPassword(hashedPassword, '')
    expect(isValid).toBe(false)
  })

  test('should handle malformed hash gracefully', async () => {
    const isValid = await verifyPassword('invalid-hash', testPassword)
    expect(isValid).toBe(false)
  })

  test('should detect old hashes that need rehashing', () => {
    // Simulate old hash with lower memory cost
    const oldHash = '$argon2id$v=19$m=4096,t=3,p=1$salt$hash'
    expect(needsRehash(oldHash)).toBe(true)
  })

  test('should not rehash current hashes', () => {
    // Current hash should not need rehashing
    expect(needsRehash(hashedPassword)).toBe(false)
  })

  test('should handle invalid hash format in needsRehash', () => {
    expect(needsRehash('invalid-hash')).toBe(true)
    expect(needsRehash('')).toBe(true)
    expect(needsRehash('$argon2id$invalid')).toBe(true)
  })
})

describe('Secure Token Generation', () => {
  test('should generate secure random token', () => {
    const token = createSecureToken()
    
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  test('should generate tokens of specified length', () => {
    const token16 = createSecureToken(16)
    const token32 = createSecureToken(32)
    const token64 = createSecureToken(64)
    
    // Base64 encoding increases length, but should be proportional
    expect(token32.length).toBeGreaterThan(token16.length)
    expect(token64.length).toBeGreaterThan(token32.length)
  })

  test('should generate unique tokens', () => {
    const tokens = new Set()
    
    // Generate 100 tokens and ensure they're all unique
    for (let i = 0; i < 100; i++) {
      const token = createSecureToken(32)
      expect(tokens.has(token)).toBe(false)
      tokens.add(token)
    }
    
    expect(tokens.size).toBe(100)
  })

  test('should generate URL-safe tokens', () => {
    const token = createSecureToken(32)
    
    // Should not contain URL-unsafe characters after base64url encoding
    expect(token).not.toMatch(/[+/=]/)
  })
})

describe('Token Hashing', () => {
  const testToken = 'test-token-123'
  let hashedToken: string

  beforeAll(() => {
    hashedToken = hashToken(testToken)
  })

  test('should hash token with SHA-256', () => {
    const hash = hashToken(testToken)
    
    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
    
    // Same token should produce same hash
    expect(hashToken(testToken)).toBe(hash)
  })

  test('should produce different hashes for different tokens', () => {
    const hash1 = hashToken('token1')
    const hash2 = hashToken('token2')
    
    expect(hash1).not.toBe(hash2)
  })

  test('should verify hashed token correctly', () => {
    expect(verifyHashedToken(testToken, hashedToken)).toBe(true)
    expect(verifyHashedToken('wrong-token', hashedToken)).toBe(false)
  })

  test('should handle empty tokens', () => {
    const emptyHash = hashToken('')
    expect(emptyHash).toBeDefined()
    expect(verifyHashedToken('', emptyHash)).toBe(true)
    expect(verifyHashedToken('non-empty', emptyHash)).toBe(false)
  })
})

describe('Random Token Generation', () => {
  test('should generate random token with default length', () => {
    const token = randomToken()
    
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  test('should generate tokens of specified byte length', () => {
    const token16 = randomToken(16)
    const token32 = randomToken(32)
    
    expect(token16).toBeDefined()
    expect(token32).toBeDefined()
    expect(token32.length).toBeGreaterThan(token16.length)
  })

  test('should generate unique random tokens', () => {
    const tokens = new Set()
    
    for (let i = 0; i < 50; i++) {
      const token = randomToken(16)
      expect(tokens.has(token)).toBe(false)
      tokens.add(token)
    }
    
    expect(tokens.size).toBe(50)
  })

  test('should generate hex-encoded tokens', () => {
    const token = randomToken(16)
    
    // Should be valid hex string
    expect(token).toMatch(/^[0-9a-f]+$/)
  })
})

describe('HMAC Token Hashing', () => {
  const testToken = 'test-token-for-hmac'
  const testSecret = 'test-secret-key-32-bytes-exactly'

  beforeAll(() => {
    // Set test secret in environment
    process.env.TOKEN_HMAC_SECRET = testSecret
  })

  test('should generate HMAC hash for token', () => {
    const hash = hmacTokenHash(testToken)
    
    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
    
    // Same token should produce same hash
    expect(hmacTokenHash(testToken)).toBe(hash)
  })

  test('should use custom secret when provided', () => {
    const customSecret = 'custom-secret-key-for-testing-only'
    const hash1 = hmacTokenHash(testToken)
    const hash2 = hmacTokenHash(testToken, customSecret)
    
    expect(hash1).not.toBe(hash2)
  })

  test('should produce different hashes for different tokens', () => {
    const hash1 = hmacTokenHash('token1')
    const hash2 = hmacTokenHash('token2')
    
    expect(hash1).not.toBe(hash2)
  })

  test('should handle empty token', () => {
    const hash = hmacTokenHash('')
    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
  })

  test('should be deterministic with same inputs', () => {
    const token = 'consistent-token'
    const secret = 'consistent-secret'
    
    const hash1 = hmacTokenHash(token, secret)
    const hash2 = hmacTokenHash(token, secret)
    const hash3 = hmacTokenHash(token, secret)
    
    expect(hash1).toBe(hash2)
    expect(hash2).toBe(hash3)
  })
})

describe('Crypto Performance', () => {
  test('password hashing should complete within reasonable time', async () => {
    const start = Date.now()
    await hashPassword('TestPassword123')
    const duration = Date.now() - start
    
    // Should complete within 2 seconds (reasonable for Argon2id)
    expect(duration).toBeLessThan(2000)
  }, 5000)

  test('password verification should be fast', async () => {
    const password = 'TestPassword123'
    const hash = await hashPassword(password)
    
    const start = Date.now()
    await verifyPassword(hash, password)
    const duration = Date.now() - start
    
    // Verification should be faster than hashing
    expect(duration).toBeLessThan(1000)
  })

  test('token operations should be fast', () => {
    const iterations = 1000
    const start = Date.now()
    
    for (let i = 0; i < iterations; i++) {
      const token = createSecureToken(32)
      hashToken(token)
      randomToken(16)
      hmacTokenHash(token)
    }
    
    const duration = Date.now() - start
    
    // Should complete 1000 operations within 1 second
    expect(duration).toBeLessThan(1000)
  })
})

describe('Edge Cases and Error Handling', () => {
  test('should handle very long passwords', async () => {
    const longPassword = 'a'.repeat(1000)
    const hash = await hashPassword(longPassword)
    
    expect(hash).toBeDefined()
    expect(await verifyPassword(hash, longPassword)).toBe(true)
    expect(await verifyPassword(hash, 'a'.repeat(999))).toBe(false)
  })

  test('should handle Unicode passwords', async () => {
    const unicodePassword = '🔐💎🚀测试密码'
    const hash = await hashPassword(unicodePassword)
    
    expect(hash).toBeDefined()
    expect(await verifyPassword(hash, unicodePassword)).toBe(true)
    expect(await verifyPassword(hash, '🔐💎🚀测试')).toBe(false)
  })

  test('should handle special characters in passwords', async () => {
    const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    const hash = await hashPassword(specialPassword)
    
    expect(hash).toBeDefined()
    expect(await verifyPassword(hash, specialPassword)).toBe(true)
  })

  test('should handle zero-length token generation', () => {
    const token = createSecureToken(0)
    expect(token).toBe('')
  })

  test('should handle large token generation', () => {
    const token = createSecureToken(256)
    expect(token).toBeDefined()
    expect(token.length).toBeGreaterThan(300) // Base64 encoding overhead
  })
})