import { SignJWT, jwtVerify, JWTPayload, importPKCS8, importSPKI } from 'jose'

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS512'
const JWT_ISSUER = process.env.JWT_ISSUER || 'bonnytone'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'bonnytone.app'
const JWT_ACCESS_TTL = parseInt(process.env.JWT_ACCESS_TTL || '600') // 10 minutes
const JWT_REFRESH_TTL = parseInt(process.env.JWT_REFRESH_TTL || '2592000') // 30 days

// JWT keys based on algorithm
let JWT_PRIVATE_KEY: any
let JWT_PUBLIC_KEY: any
let JWT_SECRET: Uint8Array | undefined

async function initializeJwtKeys() {
  if (JWT_ALGORITHM === 'ES256') {
    const privateKeyPem = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') || ''
    const publicKeyPem = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || ''
    
    if (!privateKeyPem || !publicKeyPem) {
      throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set for ES256')
    }
    
    JWT_PRIVATE_KEY = await importPKCS8(privateKeyPem, JWT_ALGORITHM)
    JWT_PUBLIC_KEY = await importSPKI(publicKeyPem, JWT_ALGORITHM)
  } else {
    // HS512 fallback
    JWT_SECRET = new TextEncoder().encode(process.env.TOKEN_HMAC_SECRET || 'fallback-secret')
  }
}

// Initialize keys
initializeJwtKeys().catch(console.error)

export interface AccessTokenPayload extends JWTPayload {
  sub: string // userId (required by contract)
  iss: string // issuer (required by contract) 
  aud: string // audience (required by contract)
  sid: string // session ID (required by contract)
  scope?: string // scope (required by contract)
  type: 'access'
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string // userId
  iss: string // issuer
  aud: string // audience
  sid: string // session ID
  jti: string // token ID for reuse detection
  type: 'refresh'
}

// Create access token (alias for spec compliance)
export async function issueAccessJwt(userId: string, sessionId: string, scope: string = 'user'): Promise<string> {
  await initializeJwtKeys() // Ensure keys are initialized
  const now = Math.floor(Date.now() / 1000)
  const key = JWT_ALGORITHM === 'ES256' ? JWT_PRIVATE_KEY : JWT_SECRET
  
  return new SignJWT({
    sub: userId,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sid: sessionId,
    scope,
    type: 'access',
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_ACCESS_TTL)
    .sign(key)
}

// Create access token (legacy name for backward compatibility)
export async function createAccessToken(userId: string, sessionId: string, scope: string = 'user'): Promise<string> {
  return issueAccessJwt(userId, sessionId, scope)
}

// Create refresh token
export async function createRefreshToken(userId: string, tokenId: string, sessionId: string): Promise<string> {
  await initializeJwtKeys() // Ensure keys are initialized
  const now = Math.floor(Date.now() / 1000)
  const key = JWT_ALGORITHM === 'ES256' ? JWT_PRIVATE_KEY : JWT_SECRET
  
  return new SignJWT({
    sub: userId,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sid: sessionId,
    jti: tokenId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_REFRESH_TTL)
    .sign(key)
}

// Verify access token (alias for spec compliance)
export async function verifyAccessJwt(token: string): Promise<AccessTokenPayload | null> {
  try {
    await initializeJwtKeys() // Ensure keys are initialized
    const key = JWT_ALGORITHM === 'ES256' ? JWT_PUBLIC_KEY : JWT_SECRET
    
    const { payload } = await jwtVerify(token, key, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    
    if (payload.type !== 'access') {
      return null
    }
    
    return payload as AccessTokenPayload
  } catch {
    return null
  }
}

// Verify access token (legacy name for backward compatibility)
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  return verifyAccessJwt(token)
}

// Verify refresh token
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    await initializeJwtKeys() // Ensure keys are initialized
    const key = JWT_ALGORITHM === 'ES256' ? JWT_PUBLIC_KEY : JWT_SECRET
    
    const { payload } = await jwtVerify(token, key, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    
    if (payload.type !== 'refresh') {
      return null
    }
    
    return payload as RefreshTokenPayload
  } catch {
    return null
  }
}

// Get token expiration dates
export function getAccessTokenExpiry(): Date {
  return new Date(Date.now() + JWT_ACCESS_TTL * 1000)
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + JWT_REFRESH_TTL * 1000)
}