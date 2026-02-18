# Security Implementation Guide

## Security Architecture Overview

The Bonny Tone Radio authentication system implements **defense-in-depth security** with multiple layers of protection:

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                           │
├─────────────────────────────────────────────────────────────┤
│ • HTTPS/TLS Encryption                                     │
│ • Secure Cookie Flags (HttpOnly, Secure, SameSite)        │
│ • Content Security Policy (CSP)                           │
│ • Input Validation & Sanitization                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│ • JWT Token Security (ES256/HS512)                        │
│ • Token Rotation & Reuse Detection                        │
│ • Multi-Factor Authentication (TOTP)                      │
│ • Rate Limiting & DDoS Protection                         │
│ • CSRF Protection Strategy                                │
│ • Session Management Security                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER                            │
├─────────────────────────────────────────────────────────────┤
│ • Argon2id Password Hashing                               │
│ • Secure Token Storage & Hashing                          │
│ • Database Query Protection                               │
│ • Audit Logging & Monitoring                              │
│ • Encryption at Rest & in Transit                         │
└─────────────────────────────────────────────────────────────┘
```

## Cryptographic Security

### Password Security Implementation

#### Argon2id Configuration
```typescript
// lib/auth/crypto.ts
import { hash, verify, needsRehash } from 'argon2';

const ARGON2_CONFIG = {
  type: 2,          // Argon2id (hybrid variant)
  memoryCost: 2**17, // 128MB memory usage
  timeCost: 4,       // 4 iterations
  parallelism: 2,    // 2 threads
  hashLength: 32,    // 32-byte hash output
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_CONFIG);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await verify(hash, password);
  } catch (error) {
    // Constant-time failure
    return false;
  }
}

// Security: Check if hash needs upgrading due to improved parameters
export function needsRehash(hash: string): boolean {
  return needsRehash(hash, ARGON2_CONFIG);
}
```

**Security Properties:**
- **Memory-Hard Function**: Requires 128MB RAM, making GPU attacks expensive
- **Time-Cost Resistant**: 4 iterations balance security vs. performance
- **Salt Generation**: Unique salt per password prevents rainbow table attacks
- **Automatic Upgrading**: Weak hashes are rehashed on login with improved parameters
- **Timing Attack Resistance**: Consistent verification time regardless of outcome

#### Token Generation Security
```typescript
// Cryptographically secure random token generation
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function createSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

// HMAC token hashing for storage
export function hmacTokenHash(token: string, secret?: string): string {
  const hmacSecret = secret || process.env.TOKEN_HMAC_SECRET;
  return crypto.createHmac('sha256', hmacSecret).update(token).digest('hex');
}
```

**Token Security Features:**
- **Cryptographically Secure**: Uses `crypto.randomBytes()` for true randomness
- **URL-Safe Encoding**: Base64url encoding prevents URL encoding issues
- **HMAC Protection**: Tokens are HMAC'd before database storage
- **Sufficient Entropy**: 256-bit tokens (32 bytes) provide adequate security
- **No Predictable Patterns**: Each token is completely random

### JWT Security Implementation

#### Token Structure & Validation
```typescript
// lib/auth/jwt.ts
export interface AccessTokenPayload {
  sub: string;      // Subject (User ID)
  sid: string;      // Session ID
  iss: string;      // Issuer
  aud: string;      // Audience
  iat: number;      // Issued At
  exp: number;      // Expires At
  type: 'access';   // Token Type
  scope: string;    // Permission Scope
}

export async function verifyAccessJwt(token: string): Promise<AccessTokenPayload | null> {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
      algorithms: [process.env.JWT_ALGORITHM as Algorithm],
      clockTolerance: 30, // 30 second clock skew tolerance
    }) as AccessTokenPayload;

    // Additional validation
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return payload;
  } catch (error) {
    logger.warn('JWT verification failed', { error: error.message });
    return null;
  }
}
```

**JWT Security Controls:**
- **Algorithm Specification**: Prevents algorithm confusion attacks
- **Issuer/Audience Validation**: Prevents token reuse across systems
- **Short Expiration**: 10-minute access tokens limit exposure window
- **Type Validation**: Prevents access/refresh token confusion
- **Clock Skew Tolerance**: 30-second tolerance for distributed systems
- **Secure Algorithms**: ES256 (Elliptic Curve) or HS512 (HMAC-SHA512)

#### Algorithm Confusion Prevention
```typescript
// Prevent algorithm confusion attacks
const ALLOWED_ALGORITHMS = ['ES256', 'HS512'];

function validateAlgorithm(algorithm: string): boolean {
  return ALLOWED_ALGORITHMS.includes(algorithm);
}

// Reject 'none' algorithm and other weak algorithms
export async function verifyToken(token: string): Promise<any | null> {
  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());

  if (!validateAlgorithm(header.alg)) {
    throw new Error('Invalid or insecure algorithm');
  }

  if (header.alg === 'none') {
    throw new Error('Unsigned tokens are not allowed');
  }

  // Proceed with verification...
}
```

### Refresh Token Security Architecture

#### Token Rotation with Family Tracking
```typescript
// lib/auth/session.ts
export async function rotateRefreshToken(refreshTokenId: string) {
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { id: refreshTokenId },
    include: { session: true }
  });

  // CRITICAL: Check for token reuse
  if (tokenRecord.rotatedAt) {
    // 🚨 SECURITY VIOLATION DETECTED
    await handleTokenReuseViolation(tokenRecord);
    return null;
  }

  // Mark current token as rotated (keep for forensics)
  await prisma.refreshToken.update({
    where: { id: refreshTokenId },
    data: { rotatedAt: new Date() }
  });

  // Create new token in same family
  const newTokenId = generateSecureId();
  const newRefreshJwt = await issueRefreshJwt(
    tokenRecord.userId,
    newTokenId,
    tokenRecord.sessionId
  );

  await prisma.refreshToken.create({
    data: {
      id: newTokenId,
      userId: tokenRecord.userId,
      sessionId: tokenRecord.sessionId,
      tokenHash: hmacTokenHash(newRefreshJwt),
      tokenFamily: tokenRecord.tokenFamily, // Same family for tracking
      expiresAt: getRefreshTokenExpiry()
    }
  });

  return {
    accessToken: await issueAccessJwt(tokenRecord.userId, tokenRecord.sessionId),
    refreshToken: newRefreshJwt
  };
}
```

#### Token Reuse Detection & Response
```typescript
async function handleTokenReuseViolation(tokenRecord: any) {
  // Log the security violation
  await logAuthEvent('token_reuse', tokenRecord.userId, tokenRecord.sessionId, undefined, {
    tokenFamily: tokenRecord.tokenFamily,
    originalRotatedAt: tokenRecord.rotatedAt.toISOString(),
    detectedAt: new Date().toISOString()
  });

  // Mark token as reused for forensics
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: {
      reusedAt: new Date(),
      revokedAt: new Date()
    }
  });

  // SECURITY RESPONSE: Revoke entire token family
  await prisma.refreshToken.updateMany({
    where: {
      tokenFamily: tokenRecord.tokenFamily,
      revokedAt: null
    },
    data: { revokedAt: new Date() }
  });

  // SECURITY RESPONSE: Revoke session
  await prisma.session.update({
    where: { id: tokenRecord.sessionId },
    data: { revokedAt: new Date() }
  });

  // Emit security metrics
  authMetrics.tokenReuse(tokenRecord.sessionId, tokenRecord.userId);

  // Alert security team
  await alertSecurityTeam('critical_token_reuse', {
    userId: tokenRecord.userId,
    sessionId: tokenRecord.sessionId,
    tokenFamily: tokenRecord.tokenFamily,
    timestamp: new Date().toISOString()
  });
}
```

**Token Rotation Security Benefits:**
- **Forward Secrecy**: Old tokens become invalid immediately
- **Replay Attack Detection**: Reused tokens trigger security response
- **Family-Based Revocation**: Compromise of one token invalidates all related tokens
- **Forensic Trail**: Rotated tokens kept for security analysis
- **Automatic Response**: No manual intervention required for security violations

## Multi-Factor Authentication (MFA)

### TOTP Implementation
```typescript
// lib/auth/mfa.ts
import * as speakeasy from 'speakeasy';

export function generateMFASecret(): { secret: string; qrCode: string } {
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME}`,
    issuer: 'Bonnytone',
    length: 32
  });

  return {
    secret: secret.base32,
    qrCode: secret.otpauth_url
  };
}

export function verifyTOTP(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 time steps (±60 seconds)
    time: Math.floor(Date.now() / 1000)
  });
}

// Encrypt MFA secret for database storage
export function encryptMFASecret(secret: string): string {
  const cipher = crypto.createCipher('aes-256-gcm', process.env.MFA_ENCRYPTION_KEY);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decryptMFASecret(encryptedSecret: string): string {
  const decipher = crypto.createDecipher('aes-256-gcm', process.env.MFA_ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedSecret, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

**MFA Security Features:**
- **TOTP Standard**: RFC 6238 compliant Time-based OTP
- **Time Window**: 2-step tolerance (±60 seconds) for clock skew
- **Secret Encryption**: MFA secrets encrypted at rest
- **QR Code Generation**: Easy mobile app setup
- **Backup Codes**: Recovery codes for device loss (recommended addition)

### MFA Integration in Login Flow
```typescript
// Integration with login process
export async function POST(request: NextRequest) {
  // ... basic authentication ...

  // Check if MFA is enabled for user
  if (user.mfaEnabled) {
    if (!data.mfaCode) {
      return NextResponse.json(
        { error: 'MFA code is required', requiresMFA: true },
        { status: 400 }
      );
    }

    // Decrypt and verify MFA secret
    const decryptedSecret = decryptMFASecret(user.mfaSecretEnc);
    const isMFAValid = verifyTOTP(decryptedSecret, data.mfaCode);

    if (!isMFAValid) {
      // Log failed MFA attempt
      await logAuthEvent('mfa_failed', user.id, null, ip, {
        email: user.email,
        providedCode: data.mfaCode
      });

      // Apply MFA failure penalty
      await penalizeMFAFailure(user.email, ip);

      return NextResponse.json(
        { error: 'Invalid MFA code' },
        { status: 401 }
      );
    }

    // Log successful MFA
    await logAuthEvent('mfa_success', user.id, null, ip);
  }

  // ... continue with session creation ...
}
```

## Rate Limiting & DDoS Protection

### Multi-Layer Rate Limiting
```typescript
// lib/auth/rates.ts
export const rateLimits = {
  // Login protection
  loginEmail: {
    points: 5,         // 5 attempts
    duration: 60,      // per minute
    blockDuration: 900 // 15 minute penalty
  },
  loginIP: {
    points: 10,        // 10 attempts
    duration: 60,      // per minute
    blockDuration: 300 // 5 minute penalty
  },

  // Registration protection
  registerIP: {
    points: 3,         // 3 registrations
    duration: 60,      // per minute
    blockDuration: 1800 // 30 minute penalty
  },
  registerEmail: {
    points: 10,        // 10 attempts
    duration: 86400,   // per day
    blockDuration: 86400 // 24 hour penalty
  },

  // Email action protection
  emailVerification: {
    points: 3,         // 3 emails
    duration: 3600,    // per hour
    blockDuration: 3600 // 1 hour penalty
  }
};
```

#### Smart Rate Limiting Implementation
```typescript
export async function checkRateLimit(
  limiter: RateLimiterRedis | RateLimiterMemory,
  key: string
): Promise<RateLimitResult> {
  try {
    await limiter.consume(key);
    return { success: true };
  } catch (rejRes) {
    // Calculate retry time
    const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 1;

    // Log rate limit hit
    logger.warn('Rate limit exceeded', {
      key,
      remainingPoints: rejRes.remainingPoints,
      retryAfter
    });

    // Emit metrics
    authMetrics.rateLimitHit(limiter.keyPrefix, key);

    return {
      success: false,
      retryAfter,
      remainingPoints: rejRes.remainingPoints
    };
  }
}
```

#### Progressive Penalties
```typescript
// Implement escalating penalties for repeated violations
export async function penalizeFailedLogin(email: string, ip: string) {
  // Apply immediate rate limit consumption
  await Promise.all([
    checkRateLimit(loginLimiterEmail, email),
    checkRateLimit(loginLimiterIP, ip)
  ]);

  // Record failed attempt for analysis
  await prisma.loginAttempt.create({
    data: {
      email,
      ip,
      outcome: 'invalid_credentials',
      userAgent: request.headers.get('user-agent')
    }
  });

  // Check for brute force patterns
  const recentFailures = await prisma.loginAttempt.count({
    where: {
      email,
      outcome: 'invalid_credentials',
      createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    }
  });

  // Escalating response based on failure count
  if (recentFailures > 10) {
    // Potential brute force attack
    await alertSecurityTeam('brute_force_detected', {
      email,
      ip,
      failureCount: recentFailures
    });

    // Consider temporary account lock (implement carefully)
    if (recentFailures > 20) {
      await flagAccountForReview(email, 'suspected_brute_force');
    }
  }
}
```

### DDoS Protection Strategy
```typescript
// Advanced rate limiting for DDoS protection
const ddosProtection = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ddos_protection',
  points: 100,          // 100 requests
  duration: 60,         // per minute
  blockDuration: 600,   // 10 minute penalty

  // Custom key generation for distributed attacks
  keyGenerator: (req) => {
    // Combine IP with user agent hash for sophisticated attackers
    const ip = getClientIp(req);
    const uaHash = crypto.createHash('sha256')
      .update(req.headers.get('user-agent') || '')
      .digest('hex')
      .substring(0, 8);
    return `${ip}:${uaHash}`;
  }
});
```

## CSRF Protection Strategy

### Stateless CSRF Protection
```typescript
// lib/auth/csrf.ts
// We use a stateless approach suitable for our JWT-based architecture

export function validateCSRFProtection(request: NextRequest): boolean {
  const contentType = request.headers.get('content-type');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // 1. Require application/json content type
  if (!contentType?.includes('application/json')) {
    return false;
  }

  // 2. Require Authorization header (not automatic like cookies)
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  // 3. Validate origin/referer for same-origin requests
  const expectedOrigins = [
    process.env.APP_URL,
    process.env.ALLOWED_ORIGINS?.split(',') || []
  ].flat().filter(Boolean);

  if (origin && !expectedOrigins.some(allowed => origin.startsWith(allowed))) {
    return false;
  }

  // 4. Additional headers that indicate legitimate API usage
  const customHeader = request.headers.get('x-requested-with');
  if (customHeader !== 'XMLHttpRequest' && !request.headers.get('authorization')) {
    return false;
  }

  return true;
}

// CSRF protection middleware for sensitive endpoints
export function withCSRFProtection(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, ...args) => {
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      if (!validateCSRFProtection(request)) {
        return NextResponse.json(
          { error: 'CSRF protection validation failed' },
          { status: 403 }
        );
      }
    }

    return handler(request, ...args);
  };
}
```

**CSRF Protection Rationale:**
- **JSON-Only APIs**: `Content-Type: application/json` prevents simple form-based CSRF
- **Authorization Headers**: Not sent automatically by browsers in CSRF attacks
- **Origin Validation**: Validates request origin matches expected domains
- **Custom Headers**: Additional validation for legitimate API clients
- **No Traditional Tokens**: Stateless approach suitable for JWT-based auth

## Session Security

### Secure Cookie Configuration
```typescript
// lib/auth/cookies.ts
const COOKIE_CONFIG = {
  httpOnly: true,           // Prevent XSS access
  secure: IS_PRODUCTION,    // HTTPS only in production
  sameSite: 'lax' as const, // CSRF protection
  path: '/',                // Site-wide availability
  domain: process.env.COOKIE_DOMAIN, // Subdomain sharing if needed
  priority: 'high'          // High priority for auth cookies
};

export function setAccessTokenCookie(response: NextResponse, token: string) {
  response.cookies.set('access_token', token, {
    ...COOKIE_CONFIG,
    maxAge: parseInt(process.env.JWT_ACCESS_TTL || '600'), // 10 minutes
  });
}

export function setRefreshTokenCookie(response: NextResponse, token: string) {
  response.cookies.set('refresh_token', token, {
    ...COOKIE_CONFIG,
    maxAge: parseInt(process.env.JWT_REFRESH_TTL || '2592000'), // 30 days
  });
}

export function clearAuthCookies(response: NextResponse) {
  const clearConfig = {
    ...COOKIE_CONFIG,
    maxAge: 0,
    expires: new Date(0)
  };

  response.cookies.set('access_token', '', clearConfig);
  response.cookies.set('refresh_token', '', clearConfig);
  response.cookies.set('session_id', '', clearConfig);
}
```

### Session Management Security
```typescript
// lib/auth/session.ts
export async function createSession(
  userId: string,
  ip: string,
  userAgent?: string
): Promise<SessionInfo> {
  // Parse user agent for device fingerprinting
  const parsedUA = parseUserAgent(userAgent);

  // Create session record
  const session = await prisma.session.create({
    data: {
      userId,
      ip,
      userAgent: `${parsedUA.browser} ${parsedUA.version} on ${parsedUA.os}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    }
  });

  // Generate token family for refresh token security
  const tokenFamily = generateSecureId();
  const refreshTokenId = generateSecureId();

  // Create refresh token
  const refreshToken = await issueRefreshJwt(userId, refreshTokenId, session.id);

  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      userId,
      sessionId: session.id,
      tokenHash: hmacTokenHash(refreshToken),
      tokenFamily,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  // Create access token
  const accessToken = await issueAccessJwt(userId, session.id);

  // Log session creation
  await logAuthEvent('session_created', userId, session.id, ip, {
    userAgent: parsedUA.browser + ' ' + parsedUA.version,
    os: parsedUA.os
  });

  return {
    sessionId: session.id,
    accessToken,
    refreshToken
  };
}

// Secure session cleanup
export async function cleanupExpiredSessions() {
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  // Clean expired sessions
  await prisma.session.updateMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { lt: cutoffDate } }
      ]
    },
    data: { revokedAt: new Date() }
  });

  // Clean expired refresh tokens
  await prisma.refreshToken.updateMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { lt: cutoffDate } }
      ]
    },
    data: { revokedAt: new Date() }
  });

  // Clean old email action tokens
  await prisma.emailActionToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { consumedAt: { lt: cutoffDate } }
      ]
    }
  });
}
```

## Input Validation & Sanitization

### Comprehensive Input Validation
```typescript
// lib/zod.ts - Secure validation schemas
export const EmailSchema = z.string()
  .email('Invalid email format')
  .max(254, 'Email too long') // RFC 5321 limit
  .transform(email => email.toLowerCase().trim());

export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain uppercase, lowercase, number, and special character');

export const DisplayNameSchema = z.string()
  .min(1, 'Display name required')
  .max(100, 'Display name too long')
  .regex(/^[a-zA-Z0-9\s\-'\.]+$/, 'Invalid characters in display name')
  .transform(name => name.trim());

// Token validation with strict format requirements
export const TokenSchema = z.string()
  .min(32, 'Token too short')
  .max(256, 'Token too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid token format');

// MFA code validation
export const MFACodeSchema = z.string()
  .length(6, 'MFA code must be 6 digits')
  .regex(/^\d{6}$/, 'MFA code must contain only digits');
```

### XSS Prevention
```typescript
// lib/auth/email.ts - Email template security
import DOMPurify from 'isomorphic-dompurify';

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeEmailContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'div'],
    ALLOWED_ATTR: ['href']
  });
}

// Safe template rendering
export function renderEmailTemplate(template: string, data: Record<string, any>): string {
  let rendered = template;

  for (const [key, value] of Object.entries(data)) {
    const escapedValue = escapeHtml(String(value || ''));
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), escapedValue);
  }

  return rendered;
}
```

### SQL Injection Prevention
```typescript
// Using Prisma ORM for type-safe, injection-proof queries

// ✅ SAFE: Prisma parameterized query
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email } // Automatically parameterized
  });
}

// ✅ SAFE: Prisma with complex conditions
export async function findRecentLoginAttempts(email: string, hours: number) {
  return prisma.loginAttempt.findMany({
    where: {
      email,
      createdAt: {
        gte: new Date(Date.now() - hours * 60 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

// ❌ NEVER DO THIS: Raw SQL with string interpolation
// const query = `SELECT * FROM users WHERE email = '${email}'`; // DANGEROUS!

// ✅ IF raw SQL needed: Use parameterized queries
export async function customQuery(email: string) {
  return prisma.$queryRaw`
    SELECT id, email, created_at
    FROM users
    WHERE email = ${email}
    AND email_verified_at IS NOT NULL
  `;
}
```

## Observability & Security Monitoring

### Security Event Logging
```typescript
// lib/observability/index.ts
export async function logAuthEvent(
  action: string,
  userId?: string,
  sessionId?: string,
  ip?: string,
  metadata?: Record<string, any>
) {
  const eventData = {
    action,
    userId,
    sessionId,
    ip,
    userAgent: metadata?.userAgent,
    timestamp: new Date().toISOString(),
    metadata: JSON.stringify(metadata || {})
  };

  try {
    // Store in database for audit trail
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        actor: userId || 'system',
        meta: metadata || {},
      }
    });

    // Structured logging for monitoring systems
    logger.info('Auth event', eventData);

    // Security-specific events for alerting
    if (SECURITY_EVENTS.includes(action)) {
      await handleSecurityEvent(action, eventData);
    }

  } catch (error) {
    // Never fail auth flow due to logging issues
    logger.error('Failed to log auth event', { error, eventData });
  }
}

// Critical security events that require immediate attention
const SECURITY_EVENTS = [
  'token_reuse',
  'mfa_bypass_attempt',
  'suspicious_login_pattern',
  'rate_limit_breach',
  'account_takeover_indicators'
];
```

### Real-time Security Metrics
```typescript
// lib/observability/metrics.ts
export const authMetrics = {
  loginSuccess: (method: string, userType: string) => {
    promClient.register.getSingleMetric('auth_login_success_total')?.inc({
      method,
      user_type: userType
    });
  },

  loginFailed: (reason: string, method: string) => {
    promClient.register.getSingleMetric('auth_login_fail_total')?.inc({
      reason,
      method
    });
  },

  tokenReuse: (sessionId: string, userId: string) => {
    promClient.register.getSingleMetric('auth_token_reuse_total')?.inc();

    // Immediate alert for token reuse
    alertSecurityTeam('critical_token_reuse', {
      sessionId,
      userId,
      timestamp: new Date().toISOString()
    });
  },

  suspiciousActivity: (type: string, severity: 'low' | 'medium' | 'high') => {
    promClient.register.getSingleMetric('auth_suspicious_activity_total')?.inc({
      type,
      severity
    });

    if (severity === 'high') {
      alertSecurityTeam('suspicious_activity', { type, severity });
    }
  }
};
```

### Automated Security Alerting
```typescript
// lib/observability/alerts.ts
export async function alertSecurityTeam(
  alertType: string,
  data: Record<string, any>
) {
  const alert = {
    type: alertType,
    severity: getAlertSeverity(alertType),
    timestamp: new Date().toISOString(),
    data,
    source: 'auth-system'
  };

  // Multiple alert channels for redundancy
  const promises = [];

  // Slack/Discord webhook
  if (process.env.ALERT_WEBHOOK_URL) {
    promises.push(sendWebhookAlert(process.env.ALERT_WEBHOOK_URL, alert));
  }

  // Email alert
  if (process.env.SECURITY_EMAIL) {
    promises.push(sendEmailAlert(process.env.SECURITY_EMAIL, alert));
  }

  // PagerDuty/OpsGenie (for critical alerts)
  if (alert.severity === 'critical' && process.env.PAGERDUTY_API_KEY) {
    promises.push(sendPagerDutyAlert(alert));
  }

  await Promise.allSettled(promises);
}

function getAlertSeverity(alertType: string): string {
  const severityMap = {
    token_reuse: 'critical',
    brute_force_detected: 'high',
    suspicious_login_pattern: 'medium',
    rate_limit_breach: 'medium',
    mfa_bypass_attempt: 'high',
    account_takeover_indicators: 'critical'
  };

  return severityMap[alertType] || 'low';
}
```

## Production Security Checklist

### Environment Security
- [ ] **HTTPS Enabled**: All traffic encrypted with TLS 1.2+
- [ ] **Environment Variables**: All secrets in environment variables, not code
- [ ] **Database Encryption**: Encryption at rest and in transit enabled
- [ ] **Redis Security**: Redis AUTH enabled, no public access
- [ ] **Network Security**: Firewall rules restrict database/cache access
- [ ] **Secret Rotation**: Regular rotation of JWT secrets, API keys
- [ ] **Backup Security**: Encrypted backups with access controls

### Application Security
- [ ] **Security Headers**: CSP, HSTS, X-Frame-Options configured
- [ ] **Cookie Security**: Secure, HttpOnly, SameSite flags set
- [ ] **Rate Limiting**: Redis-backed rate limiting in production
- [ ] **Input Validation**: All inputs validated with Zod schemas
- [ ] **Error Handling**: Generic error messages, detailed logs
- [ ] **Dependency Security**: Regular dependency updates, vulnerability scans

### Monitoring & Alerting
- [ ] **Security Monitoring**: Real-time monitoring of auth events
- [ ] **Alert Configuration**: Critical alerts go to security team
- [ ] **Log Retention**: Audit logs retained per compliance requirements
- [ ] **Metrics Dashboard**: Security metrics visualized and monitored
- [ ] **Incident Response**: Documented incident response procedures
- [ ] **Regular Audits**: Periodic security audits and penetration testing

### Compliance & Governance
- [ ] **Privacy Policy**: Clear data handling and retention policies
- [ ] **GDPR Compliance**: User data rights and deletion procedures
- [ ] **Audit Trail**: Comprehensive audit logging for all auth events
- [ ] **Access Controls**: Principle of least privilege for system access
- [ ] **Data Classification**: Sensitive data properly classified and protected
- [ ] **Regular Reviews**: Periodic review of security controls and policies

This security implementation provides defense-in-depth protection suitable for production environments handling sensitive user authentication data.