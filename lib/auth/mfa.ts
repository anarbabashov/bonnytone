import { createHash, randomBytes } from 'crypto'
import { authenticator } from 'otplib'

// Use otplib for TOTP implementation (as per spec)
authenticator.options = {
  window: 1, // Allow 1 step tolerance (30 seconds before/after)
  digits: 6,
  step: 30,
}

// Fallback constants for manual implementation
const TOTP_WINDOW = 30 // 30 seconds
const TOTP_DIGITS = 6

// Simple base32 encoding
function toBase32(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31]
  }

  return output
}

// Generate MFA secret using otplib
export function generateMFASecret(): string {
  return authenticator.generateSecret()
}

// Encrypt MFA secret for storage
export function encryptMFASecret(secret: string, userSecret: string): string {
  // Simple XOR encryption (in production, use proper encryption like AES)
  const key = createHash('sha256').update(userSecret).digest()
  const encrypted = Buffer.from(secret).map((byte, i) => byte ^ key[i % key.length])
  return Buffer.from(encrypted).toString('base64')
}

// Decrypt MFA secret
export function decryptMFASecret(encryptedSecret: string, userSecret: string): string {
  const key = createHash('sha256').update(userSecret).digest()
  const encrypted = Buffer.from(encryptedSecret, 'base64')
  const decrypted = encrypted.map((byte, i) => byte ^ key[i % key.length])
  return decrypted.toString()
}

// Simple base32 decoding
function fromBase32(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let index = 0
  const output = Buffer.alloc(Math.ceil(base32.length * 5 / 8))

  for (let i = 0; i < base32.length; i++) {
    const char = base32[i].toUpperCase()
    const charIndex = alphabet.indexOf(char)
    if (charIndex === -1) continue

    value = (value << 5) | charIndex
    bits += 5

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255
      bits -= 8
    }
  }

  return output.slice(0, index)
}

// Generate TOTP code using otplib
export function generateTOTPCode(secret: string): string {
  return authenticator.generate(secret)
}

// Verify TOTP code using otplib
export function verifyTOTPCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code, secret })
  } catch {
    return false
  }
}

// Generate QR code URL for authenticator apps using otplib
export function generateMFAQRCodeUrl(
  secret: string,
  userEmail: string,
  issuer: string = 'Bonnytone'
): string {
  return authenticator.keyuri(userEmail, issuer, secret)
}

// Generate backup codes
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = []
  
  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase()
    codes.push(code.match(/.{2}/g)?.join('-') || code)
  }
  
  return codes
}

// Hash backup codes for storage
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(code => {
    return createHash('sha256').update(code.toLowerCase()).digest('hex')
  })
}

// Verify backup code
export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const hashedCode = createHash('sha256').update(code.toLowerCase()).digest('hex')
  return hashedCodes.includes(hashedCode)
}