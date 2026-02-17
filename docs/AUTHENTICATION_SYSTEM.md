# Authentication System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Core Components](#core-components)
4. [Security Implementation](#security-implementation)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Email System](#email-system)
8. [Testing Strategy](#testing-strategy)
9. [Development Workflow](#development-workflow)
10. [Production Deployment](#production-deployment)
11. [Troubleshooting](#troubleshooting)

## System Overview

The Artist Management Dashboard implements a **comprehensive, enterprise-grade authentication system** designed for security, scalability, and developer experience. The system provides:

- **Complete User Lifecycle**: Registration, email verification, login, password management
- **Advanced Security**: JWT tokens, refresh token rotation, reuse detection, MFA support
- **Professional Email System**: Multi-provider support with template system
- **Comprehensive Audit**: Rate limiting, security monitoring, detailed logging
- **Developer Experience**: Type-safe APIs, comprehensive testing, clear documentation

### Key Features
- ✅ **Email-based Registration** with verification flow
- ✅ **JWT Access Tokens** (10min) + **Rotating Refresh Tokens** (30 days)
- ✅ **Token Reuse Detection** with family-based revocation
- ✅ **Optional MFA (TOTP)** integration
- ✅ **Password Reset & Email Change** flows
- ✅ **Rate Limiting** with Redis/memory fallback
- ✅ **Multi-provider Email System** (Dev, Postmark, SendGrid, SES)
- ✅ **Comprehensive Observability** (metrics, alerts, audit logs)

## Architecture & Technology Stack

### Frontend Technologies
```typescript
// Next.js 13 App Router with TypeScript
"next": "13.x"
"typescript": "^5.0.0"

// UI Components & Styling
"@radix-ui/react-*": "^1.0.0"    // Accessible primitives
"tailwindcss": "^3.0.0"          // Utility-first CSS
"next-themes": "^0.2.0"          // Dark/light mode

// State Management
"zustand": "^4.0.0"              // Lightweight state management

// Form Validation
"zod": "^3.0.0"                  // Schema validation
```

### Backend Technologies
```typescript
// Runtime & Framework
"node": ">=18.0.0"
"next": "13.x"                   // Full-stack React framework

// Database & ORM
"postgresql": "^14.0.0"          // Primary database
"@prisma/client": "^5.0.0"       // Type-safe database access
"prisma": "^5.0.0"               // Database toolkit

// Authentication & Security
"argon2": "^0.31.0"              // Password hashing
"jsonwebtoken": "^9.0.0"         // JWT tokens
"rate-limiter-flexible": "^3.0.0" // Rate limiting
"ioredis": "^5.0.0"              // Redis client (optional)

// Email System
"@postmark/postmark": "^3.0.0"   // Postmark integration
"aws-sdk": "^3.0.0"              // AWS SES (optional)
"@sendgrid/mail": "^7.0.0"       // SendGrid (optional)

// Observability
"pino": "^8.0.0"                 // Structured logging
"ua-parser-js": "^1.0.0"         // User agent parsing
```

### Testing Technologies
```typescript
// Testing Framework
"jest": "^29.0.0"                // Unit testing
"@playwright/test": "^1.40.0"    // E2E testing
"@testing-library/react": "^13.0.0" // Component testing

// Mocking & Utilities
"@testing-library/jest-dom": "^6.0.0"
"jest-environment-jsdom": "^29.0.0"
```

## Core Components

### 1. Authentication Routes (`app/auth/`)

```
app/auth/
├── login/page.tsx           # Login form with MFA support
├── register/page.tsx        # Registration form with validation
├── verify-email/page.tsx    # Email verification handler
├── forgot-password/page.tsx # Password reset request
├── reset-password/page.tsx  # Password reset completion
└── layout.tsx              # Auth pages layout
```

**Key Features:**
- **Real-time Validation**: Form validation with instant feedback
- **Loading States**: Professional UX with loading indicators
- **Error Handling**: User-friendly error messages
- **Responsive Design**: Mobile-first responsive layouts
- **Accessibility**: ARIA labels, keyboard navigation

### 2. API Endpoints (`app/api/auth/`)

```
app/api/auth/
├── register/route.ts        # User registration
├── login/route.ts          # Authentication
├── logout/route.ts         # Session termination
├── refresh/route.ts        # Token refresh
├── me/route.ts             # Current user info
├── verify-email/route.ts   # Email verification
├── forgot-password/route.ts # Password reset request
├── reset-password/route.ts # Password reset completion
└── resend-verification/route.ts # Resend verification email
```

### 3. Core Libraries (`lib/auth/`)

```
lib/auth/
├── crypto.ts              # Password hashing, token generation
├── jwt.ts                 # JWT creation and verification
├── session.ts             # Session management, token rotation
├── cookies.ts             # Secure cookie handling
├── guards.ts              # Authentication middleware
├── rates.ts               # Rate limiting configuration
├── email.ts               # Email templates and sending
├── tokens.ts              # Email action tokens
├── mfa.ts                 # Multi-factor authentication
└── csrf.ts                # CSRF protection strategy
```

## Security Implementation

### Password Security
```typescript
// Argon2id Configuration (crypto.ts)
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    type: 2,          // Argon2id (hybrid variant)
    memoryCost: 2**17, // 128MB memory
    timeCost: 4,       // 4 iterations
    parallelism: 2,    // 2 threads
  })
}
```

**Security Features:**
- **Argon2id Hashing**: Memory-hard function resistant to GPU attacks
- **Automatic Rehashing**: Upgrades weak hashes on login
- **Salt Generation**: Unique salt per password
- **Timing Resistance**: Consistent verification timing

### JWT Token Security
```typescript
// JWT Configuration
{
  issuer: process.env.JWT_ISSUER,           // "bonnytone"
  audience: process.env.JWT_AUDIENCE,       // "bonnytone.app"
  algorithm: "ES256",                       // Elliptic Curve Digital Signature
  accessTokenTTL: 600,                      // 10 minutes
  refreshTokenTTL: 2592000,                 // 30 days
}
```

**Token Features:**
- **Short-lived Access**: 10-minute expiry reduces exposure
- **Secure Algorithms**: ES256/HS512 (no algorithm confusion)
- **Comprehensive Claims**: iss, aud, sub, sid, scope validation
- **Rotation Security**: Refresh tokens rotate on every use

### Refresh Token Security
```typescript
// Token Rotation with Reuse Detection (session.ts)
if (refreshTokenRecord.rotatedAt) {
  // SECURITY VIOLATION: Token reuse detected
  await revokeTokenFamily(tokenFamily);    // Revoke all related tokens
  await revokeSession(sessionId);          // Terminate session
  logSecurityEvent('token_reuse');         // Alert security team
  return null; // Force re-authentication
}
```

**Rotation Features:**
- **Family Tracking**: Groups related tokens for security
- **Reuse Detection**: Detects replay attacks immediately
- **Automatic Revocation**: Kills entire token chain on violation
- **Security Alerting**: Triggers monitoring alerts

### Rate Limiting Strategy
```typescript
// Rate Limiting Configuration (rates.ts)
export const rateLimits = {
  login: {
    email: { points: 5, duration: 60 },     // 5 attempts/minute per email
    ip: { points: 10, duration: 60 },       // 10 attempts/minute per IP
  },
  register: {
    ip: { points: 3, duration: 60 },        // 3 registrations/minute per IP
    email: { points: 10, duration: 86400 }, // 10 attempts/day per email
  },
  email: {
    perUser: { points: 3, duration: 3600 }, // 3 emails/hour per user
  }
}
```

## API Endpoints

### Registration Flow

#### POST /api/auth/register
**Purpose**: Create new user account with email verification

**Request Body:**
```typescript
{
  email: string           // Valid email address
  password: string        // Strong password (8+ chars, mixed case, numbers)
  displayName?: string    // Optional display name
}
```

**Response:**
```typescript
// Success (201)
{
  ok: true,
  message: "Registration successful. Please check your email to verify your account."
}

// Error (409 - Email exists)
{
  error: "User with this email already exists"
}

// Error (429 - Rate limited)
{
  error: "Too many registration attempts. Please try again later."
}
```

**Security Features:**
- Email uniqueness validation
- Password strength requirements
- Rate limiting (3/min per IP, 10/day per email)
- Audit logging with IP tracking
- Automatic email verification token generation

#### POST /api/auth/verify-email
**Purpose**: Verify email address and activate account

**Request Body:**
```typescript
{
  token: string  // Email verification token from email
}
```

**Response:**
```typescript
// Success (200)
{
  message: "Email verified successfully",
  token: "jwt_access_token",      // Auto-login after verification
  user: {
    id: string,
    email: string,
    displayName: string,
    emailVerifiedAt: Date
  }
}
```

### Authentication Flow

#### POST /api/auth/login
**Purpose**: Authenticate user and create session

**Request Body:**
```typescript
{
  email: string
  password: string
  mfaCode?: string      // Required if user has MFA enabled
}
```

**Response:**
```typescript
// Success (200)
{
  token: "jwt_access_token",
  user: {
    id: string,
    email: string,
    displayName: string,
    emailVerifiedAt: Date
  }
}

// MFA Required (400)
{
  error: "MFA code is required",
  requiresMFA: true
}

// Account Blocked (403)
{
  error: "Account is blocked. Please contact support."
}
```

**Security Features:**
- Email verification requirement
- Password rehashing on login (if needed)
- MFA integration (TOTP)
- Rate limiting (5/min per email, 10/min per IP)
- Failed login penalty system
- Session creation with JWT + refresh tokens

#### POST /api/auth/refresh
**Purpose**: Refresh access token using refresh token

**Request**: Uses `refresh_token` cookie

**Response:**
```typescript
// Success (200)
{
  token: "new_jwt_access_token"
}
// Note: New refresh token set in cookie

// Token Reuse Detected (401)
{
  error: "Invalid refresh token"
}
// Note: All related tokens and session revoked
```

**Security Features:**
- Token rotation on every refresh
- Reuse detection with family revocation
- Automatic session cleanup on violations
- Security event logging and alerting

### Password Management

#### POST /api/auth/forgot-password
**Purpose**: Request password reset email

**Request Body:**
```typescript
{
  email: string
}
```

**Response:**
```typescript
// Always returns success (prevent user enumeration)
{
  message: "If an account with that email exists, a password reset link has been sent."
}
```

#### POST /api/auth/reset-password
**Purpose**: Complete password reset with token

**Request Body:**
```typescript
{
  token: string,        // Reset token from email
  newPassword: string   // New strong password
}
```

**Response:**
```typescript
// Success (200)
{
  message: "Password reset successful. Please log in with your new password."
}

// Invalid/Expired Token (400)
{
  error: "Invalid or expired reset token"
}
```

**Security Features:**
- Token expiration (30 minutes)
- One-time token consumption
- All user sessions revoked on reset
- Secure token validation
- Audit logging for security events

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id                TEXT PRIMARY KEY,
  email             TEXT UNIQUE NOT NULL,
  display_name      TEXT,
  password_hash     TEXT NOT NULL,
  email_verified_at TIMESTAMP,
  is_blocked        BOOLEAN DEFAULT FALSE,
  mfa_enabled       BOOLEAN DEFAULT FALSE,
  mfa_secret_enc    TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  ip         TEXT,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Refresh Tokens Table
```sql
CREATE TABLE refresh_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  session_id   TEXT NOT NULL REFERENCES sessions(id),
  token_hash   TEXT UNIQUE NOT NULL,
  token_family TEXT NOT NULL,      -- For reuse detection
  expires_at   TIMESTAMP NOT NULL,
  rotated_at   TIMESTAMP,          -- When token was rotated
  revoked_at   TIMESTAMP,          -- When token was revoked
  reused_at    TIMESTAMP,          -- When reuse was detected
  created_at   TIMESTAMP DEFAULT NOW()
);
```

### Email Action Tokens Table
```sql
CREATE TABLE email_action_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,         -- 'verify_email', 'password_reset', 'email_change'
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id         TEXT PRIMARY KEY,
  action     TEXT NOT NULL,         -- Event type (login_success, token_reuse, etc.)
  user_id    TEXT REFERENCES users(id),
  actor      TEXT NOT NULL,         -- Who performed the action
  meta       JSONB,                 -- Additional event metadata
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Login Attempts Table
```sql
CREATE TABLE login_attempts (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  ip         TEXT NOT NULL,
  outcome    TEXT NOT NULL,         -- 'success', 'invalid_credentials', 'user_blocked'
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Email System

### Provider Configuration
```typescript
// Email Provider Setup (email.ts)
export const emailProviders = {
  dev: {
    send: async (template, to, data) => {
      // Write .eml files to .mailbox/ directory
      await writeEmailToFile(template, to, data);
    }
  },
  postmark: {
    send: async (template, to, data) => {
      // Send via Postmark API
      await postmarkClient.sendEmailWithTemplate({...});
    }
  },
  sendgrid: {
    send: async (template, to, data) => {
      // Send via SendGrid API
      await sgMail.send({...});
    }
  }
}
```

### Email Templates

#### Verification Email Template
```typescript
// Template: verify_email
{
  subject: "Verify your email address - Bonnytone",
  htmlTemplate: `
    <h1>Welcome to Bonnytone!</h1>
    <p>Please verify your email address to complete your registration.</p>
    <a href="${verificationUrl}">Verify Email Address</a>
    <p>This link expires in 24 hours.</p>
  `,
  textTemplate: `
    Welcome to Bonnytone!
    Please verify your email: ${verificationUrl}
    This link expires in 24 hours.
  `
}
```

#### Password Reset Email Template
```typescript
// Template: password_reset
{
  subject: "Reset your password - Bonnytone",
  htmlTemplate: `
    <h1>Password Reset Request</h1>
    <p>Click the link below to reset your password.</p>
    <a href="${resetUrl}">Reset Password</a>
    <p>This link expires in 30 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `,
  // ... textTemplate
}
```

### Development Email Workflow
```bash
# Email files saved to .mailbox/
.mailbox/
├── 2024-01-15T10-30-45-123Z-verify_email-user@example.com.eml
├── 2024-01-15T10-35-20-456Z-password_reset-user@example.com.eml
└── 2024-01-15T10-40-15-789Z-login_alert-user@example.com.eml
```

**Development Features:**
- **File-based Storage**: Emails saved as .eml files for inspection
- **Unique Filenames**: Timestamp + template + email for easy identification
- **Multi-format**: Both HTML and text versions included
- **Token Extraction**: Easy to extract verification/reset tokens for testing

## Testing Strategy

### Unit Tests (`__tests__/unit/`)
```typescript
// Crypto Functions Testing
describe('Password Hashing', () => {
  test('should hash password with Argon2id');
  test('should verify correct password');
  test('should detect old hashes that need rehashing');
});

// JWT Security Testing
describe('JWT Token Creation', () => {
  test('should create access token with correct structure');
  test('should validate JWT audience claim');
  test('should reject tokens with tampered signatures');
});

// Session Management Testing
describe('Token Rotation', () => {
  test('should rotate refresh token successfully');
  test('should detect token reuse and revoke session');
  test('should maintain token family across rotations');
});
```

### Integration Tests (`__tests__/integration/`)
```typescript
// API Endpoint Testing
describe('POST /api/auth/login', () => {
  test('should login successfully with valid credentials');
  test('should reject invalid credentials');
  test('should handle rate limiting');
  test('should require MFA when enabled');
});

// Email Flow Testing
describe('Password Reset Flow', () => {
  test('complete forgot password → reset password flow');
  test('should reject expired token');
  test('should not send email for non-existent user');
});
```

### E2E Tests (`tests/e2e/`)
```typescript
// Playwright Browser Testing
describe('Registration Flow', () => {
  test('should complete registration flow successfully', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/auth/register');

    // Fill form and submit
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Check email was sent
    const emailFiles = await waitForEmail();
    expect(emailFiles.length).toBeGreaterThan(0);

    // Extract and use verification token
    const emailContent = await readEmailContent(emailFiles[0]);
    const token = extractTokenFromEmail(emailContent);

    // Verify email
    await page.goto(`/auth/verify-email?token=${token}`);
    expect(page.url()).toContain('/dashboard');
  });
});
```

### Security Tests (`__tests__/security/`)
```typescript
// Cookie Security Validation
describe('Cookie Security', () => {
  test('should set secure cookie flags in production');
  test('should use correct cookie domain');
  test('should properly clear all auth cookies');
});

// JWT Security Validation
describe('JWT Security', () => {
  test('should validate JWT audience claim');
  test('should reject tokens with tampered signatures');
  test('should prevent algorithm confusion attacks');
});
```

## Development Workflow

### Environment Setup
```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd artist-manager
npm install

# 2. Set up environment variables
cp .env.example .env.local

# Required Environment Variables:
DATABASE_URL="postgresql://user:pass@localhost:5432/bonnytone"
JWT_ISSUER="bonnytone"
JWT_AUDIENCE="bonnytone.app"
JWT_ACCESS_TTL="600"
JWT_REFRESH_TTL="2592000"
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
TOKEN_HMAC_SECRET="base64-32-byte-secret"
EMAIL_FROM="Bonnytone <no-reply@bonnytone.org>"
EMAIL_PROVIDER="dev"
APP_URL="http://localhost:3000"

# 3. Set up database
npx prisma migrate dev
npx prisma generate

# 4. Start development server
npm run dev
```

### Development Commands
```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server

# Database
npx prisma migrate dev  # Run database migrations
npx prisma studio      # Open database browser
npx prisma generate    # Regenerate Prisma client

# Testing
npm test               # Run unit tests
npm run test:e2e       # Run E2E tests
npm run test:security  # Run security tests

# Linting & Formatting
npm run lint           # ESLint
npm run typecheck      # TypeScript validation
```

### Testing Registration Flow
```bash
# 1. Start development server
npm run dev

# 2. Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "displayName": "Test User"
  }'

# 3. Check email was generated
ls .mailbox/
# Expected: verification email .eml file

# 4. Extract verification token from email
cat .mailbox/latest-email.eml | grep -o 'token=[^"]*' | cut -d= -f2

# 5. Verify email
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "extracted-token"}'

# 6. Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'
```

## Production Deployment

### Environment Configuration
```bash
# Production Environment Variables
NODE_ENV="production"
DATABASE_URL="postgresql://prod-user:prod-pass@prod-host:5432/bonnytone"

# JWT Configuration (Use strong, unique values)
JWT_ISSUER="bonnytone"
JWT_AUDIENCE="bonnytone.app"
JWT_ALGORITHM="ES256"
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[ES256 private key]\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n[ES256 public key]\n-----END PUBLIC KEY-----"
TOKEN_HMAC_SECRET="[base64-encoded 32-byte secret]"

# Email Configuration (Choose one provider)
EMAIL_PROVIDER="postmark"
EMAIL_FROM="Bonnytone <no-reply@bonnytone.org>"
POSTMARK_TOKEN="your-postmark-server-token"

# Security Configuration
COOKIE_DOMAIN=".bonnytone.org"
APP_URL="https://bonnytone.org"

# Redis (Recommended for production rate limiting)
REDIS_URL="redis://redis-host:6379"

# Monitoring & Alerts
ALERT_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
SECURITY_EMAIL="security@bonnytone.org"
```

### Database Setup
```bash
# 1. Create production database
createdb artistmgmt_prod

# 2. Run migrations
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# 3. Generate Prisma client
npx prisma generate
```

### Security Checklist
- [ ] **Environment Variables**: All secrets properly configured
- [ ] **HTTPS**: SSL certificates installed and configured
- [ ] **Database**: Proper user permissions and connection pooling
- [ ] **Redis**: Configured for rate limiting (optional but recommended)
- [ ] **Email Provider**: Production email service configured
- [ ] **Monitoring**: Error tracking and performance monitoring setup
- [ ] **Backup**: Database backup strategy implemented
- [ ] **Security Headers**: HTTPS, HSTS, CSP headers configured

## Troubleshooting

### Common Issues

#### Email Not Sending
```bash
# Check EMAIL_PROVIDER configuration
echo $EMAIL_PROVIDER

# For dev mode, check .mailbox directory
ls -la .mailbox/

# For production, check provider API keys
# Postmark: Verify POSTMARK_TOKEN
# SendGrid: Verify SENDGRID_API_KEY
```

#### JWT Token Issues
```bash
# Check JWT configuration
node -e "console.log('JWT_ISSUER:', process.env.JWT_ISSUER)"
node -e "console.log('JWT_AUDIENCE:', process.env.JWT_AUDIENCE)"

# Validate JWT keys for ES256
openssl ec -in jwt_private.key -text -noout
openssl ec -in jwt_private.key -pubout | openssl ec -pubin -text -noout
```

#### Database Connection Issues
```bash
# Test database connection
npx prisma db pull

# Check database migrations
npx prisma migrate status

# Reset database (CAUTION: Development only)
npx prisma migrate reset
```

#### Rate Limiting Issues
```bash
# Check Redis connection (if using Redis)
redis-cli ping

# Check rate limiting in logs
grep "rate_limit" logs/app.log

# Adjust rate limits in lib/auth/rates.ts if needed
```

### Debugging Authentication Flow

#### Enable Debug Logging
```typescript
// Add to .env.local
DEBUG=auth:*
LOG_LEVEL=debug

// Check logs for detailed auth flow
tail -f logs/auth.log | grep "auth_event"
```

#### Test Authentication Endpoints
```bash
# Test registration
curl -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"debug@test.com","password":"Test123!"}' \
  -v

# Test login
curl -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"debug@test.com","password":"Test123!"}' \
  -c cookies.txt -v

# Test protected endpoint
curl -X GET localhost:3000/api/auth/me \
  -b cookies.txt -v
```

#### Monitor Security Events
```sql
-- Check recent audit logs
SELECT * FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- Check failed login attempts
SELECT email, COUNT(*), MAX(created_at)
FROM login_attempts
WHERE outcome = 'invalid_credentials'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY email;

-- Check token reuse events
SELECT * FROM audit_logs
WHERE action = 'token_reuse'
  AND created_at > NOW() - INTERVAL '24 hours';
```

### Performance Monitoring

#### Key Metrics to Monitor
- **Authentication Success Rate**: > 99%
- **Average Response Time**: < 200ms
- **Rate Limit Hit Rate**: < 1%
- **Token Reuse Incidents**: 0 (investigate immediately)
- **Failed Login Attempts**: Monitor for spikes
- **Email Delivery Rate**: > 99%

#### Health Check Endpoints
```bash
# Database connectivity
curl localhost:3000/api/health/db

# Redis connectivity (if applicable)
curl localhost:3000/api/health/redis

# Email provider status
curl localhost:3000/api/health/email
```

---

This documentation provides a comprehensive guide to the authentication system. For questions or issues not covered here, please refer to the codebase comments or create an issue in the project repository.