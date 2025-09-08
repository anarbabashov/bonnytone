import { hash, verify } from 'argon2'
import { createHash, createHmac, randomBytes } from 'crypto'

// Argon2id password hashing with tuned params (per security contracts)
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    type: 2, // Argon2id (per security contracts)
    memoryCost: 2 ** 17, // 128MB (tuned for modern servers)
    timeCost: 4, // 4 iterations (tuned for security/performance balance)
    parallelism: 2, // 2 threads (tuned for modern CPUs)
  })
}

// Check if password hash needs rehashing due to param upgrades
export function needsRehash(hashedPassword: string): boolean {
  try {
    // Extract current parameters from hash
    // Format: $argon2id$v=19$m=131072,t=4,p=2$salt$hash
    const parts = hashedPassword.split('$')
    if (parts.length < 6 || parts[1] !== 'argon2id') return true
    
    const versionPart = parts[2] // v=19
    const paramsPart = parts[3] // m=131072,t=4,p=2
    
    if (!versionPart.startsWith('v=') || !paramsPart) return true
    
    const version = parseInt(versionPart.split('=')[1])
    const params = paramsPart.split(',')
    const memoryCost = parseInt(params.find(p => p.startsWith('m='))?.split('=')[1] || '0')
    const timeCost = parseInt(params.find(p => p.startsWith('t='))?.split('=')[1] || '0')
    const parallelism = parseInt(params.find(p => p.startsWith('p='))?.split('=')[1] || '0')
    
    // Check if parameters match current tuned values
    return (
      version !== 19 || // Argon2id version
      memoryCost < 2 ** 17 || // 128MB
      timeCost < 4 || // 4 iterations
      parallelism < 2 // 2 threads
    )
  } catch {
    // If parsing fails, assume rehashing is needed
    return true
  }
}

export async function verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
  try {
    return await verify(hashedPassword, password)
  } catch {
    return false
  }
}

// Generate cryptographically secure random tokens
export function randomToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex')
}

// HMAC token hashing for secure storage
export function hmacTokenHash(token: string, secret?: string): string {
  const secretKey = secret || process.env.TOKEN_HMAC_SECRET || 'default-secret'
  return createHmac('sha256', secretKey).update(token).digest('hex')
}

// Token hashing utilities (legacy support)
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyHashedToken(token: string, hashedToken: string): boolean {
  return hashToken(token) === hashedToken
}

export function createSecureToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex')
}

// HMAC utilities for token signing
export function signToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex')
}

export function verifyTokenSignature(token: string, signature: string, secret: string): boolean {
  const expectedSignature = signToken(token, secret)
  return signature === expectedSignature
}

// Generate random verification codes
export function generateVerificationCode(length: number = 6): string {
  const digits = '0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += digits[Math.floor(Math.random() * digits.length)]
  }
  return result
}