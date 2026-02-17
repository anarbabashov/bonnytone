# Authentication System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Core Components](#core-components)
4. [Security Implementation](#security-implementation)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Email System](#email-system)
8. [Testing](#testing)
9. [Environment Configuration](#environment-configuration)

## System Overview

The Bonny Tone Radio platform implements a comprehensive authentication system for user accounts. Registered users get access to personalized features like exclusive mix/DJ reminders and track favoriting.

### Implemented Features
- Email-based registration with verification flow
- JWT access tokens (10min) + rotating refresh tokens (30 days)
- Token reuse detection with family-based revocation
- MFA (TOTP) with backup codes
- Password reset and email change flows
- Rate limiting with Redis/memory fallback
- Multi-provider email system (dev file-based, Postmark)
- Audit logging for authentication events

## Architecture & Technology Stack

### Frontend
- **Next.js 13** App Router with TypeScript
- **Radix UI** + **shadcn/ui** component library
- **Tailwind CSS** for styling
- **Zustand** for state management
- **next-themes** for dark/light mode
- **Zod** for form validation

### Backend
- **Next.js API Routes** (App Router)
- **Prisma** ORM with **PostgreSQL**
- **argon2** for password hashing
- **jose** + **jsonwebtoken** for JWT
- **rate-limiter-flexible** with optional **ioredis**
- **otplib** for TOTP/MFA
- **postmark** for production email

### Testing
- **Jest** for unit/integration tests
- **Playwright** for E2E tests
- **@testing-library/react** for component tests

## Core Components

### Authentication Pages (`app/auth/`)
```
app/auth/
├── login/page.tsx           # Login form with MFA support
├── register/page.tsx        # Registration with validation
├── verify-email/page.tsx    # Email verification handler
├── forgot-password/page.tsx # Password reset request
├── reset-password/page.tsx  # Password reset completion
└── layout.tsx               # Auth pages layout
```

### API Endpoints (`app/api/auth/`)
```
app/api/auth/
├── register/route.ts           # User registration
├── login/route.ts              # Authentication
├── logout/route.ts             # Session termination
├── refresh/route.ts            # Token refresh with rotation
├── me/route.ts                 # Current user info
├── verify-email/route.ts       # Email verification
├── resend-verification/route.ts # Resend verification email
├── forgot-password/route.ts    # Password reset request
└── reset-password/route.ts     # Password reset completion
```

### Account Management (`app/api/account/`)
```
app/api/account/
├── change-password/route.ts    # Change password
├── change-email/init/route.ts  # Initiate email change
├── change-email/confirm/route.ts # Confirm email change
├── mfa/setup/route.ts          # MFA setup (generate secret + QR)
├── mfa/confirm/route.ts        # Confirm MFA with code
└── mfa/disable/route.ts        # Disable MFA
```

### Monitoring (`app/api/monitoring/`)
```
app/api/monitoring/
├── health/route.ts    # Health check
├── metrics/route.ts   # Prometheus-style metrics
└── alerts/route.ts    # Active security alerts
```

### Core Libraries (`lib/auth/`)
```
lib/auth/
├── crypto.ts          # Argon2id hashing, HMAC, secure tokens
├── jwt.ts             # JWT creation and verification (ES256/HS512)
├── session.ts         # Session management, token rotation, reuse detection
├── cookies.ts         # Secure cookie handling
├── guards.ts          # Authentication guards
├── middleware.ts       # API route middleware (auth + parsing + security)
├── rates.ts           # Rate limiting configuration
├── email.ts           # Email templates and sending
├── tokens.ts          # Email action tokens (verify, reset, change)
├── mfa.ts             # TOTP, QR codes, backup codes
├── csrf.ts            # Security headers
├── parser.ts          # Strict JSON parsing
└── AuthContext.tsx     # React auth context and useAuth hook
```

## Security Implementation

### Password Security
- **Argon2id** with 128MB memory, 4 iterations, 2 parallelism
- Automatic rehashing on login when parameters are outdated
- Unique salt per password

### JWT Token Security
- ES256 (Elliptic Curve) or HS512 (HMAC-SHA512) algorithms
- 10-minute access token expiry
- Issuer/audience claim validation
- Algorithm confusion prevention

### Refresh Token Rotation
- Tokens rotate on every use
- Family-based tracking for reuse detection
- Reuse triggers: revoke entire token family + revoke session + audit log + alert
- Rotated tokens kept for forensics

### Rate Limiting
- Login: 20 attempts/15min per IP, 10/15min per email
- Registration: 3/min per IP, 10/day per email
- Escalating backoff with exponential penalties

### MFA (TOTP)
- RFC 6238 compliant (Google Authenticator, Authy compatible)
- QR code generation for setup
- 8 backup codes (SHA256 hashed)
- 30-second window tolerance

## API Endpoints

### POST /api/auth/register
Create a new user account with email verification.

**Request:**
```json
{ "email": "user@example.com", "password": "SecurePass123!", "displayName": "User" }
```

**Responses:** `201` success, `409` email exists, `429` rate limited

### POST /api/auth/login
Authenticate and create session.

**Request:**
```json
{ "email": "user@example.com", "password": "SecurePass123!", "mfaCode": "123456" }
```

**Responses:** `200` with token + user, `400` MFA required / email not verified, `403` blocked, `429` rate limited

### POST /api/auth/refresh
Refresh access token using refresh token cookie. Rotates refresh token on every call.

**Responses:** `200` with new access token, `401` invalid/reused token

### POST /api/auth/logout
Revoke current session.

### GET /api/auth/me
Get current authenticated user info.

### POST /api/auth/verify-email
Verify email address with token. Auto-logs in the user.

### POST /api/auth/resend-verification
Resend verification email.

### POST /api/auth/forgot-password
Request password reset email. Always returns success to prevent user enumeration.

### POST /api/auth/reset-password
Complete password reset with token. Revokes all user sessions.

## Database Schema

### User
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| email | String | Unique |
| passwordHash | String | Argon2id |
| displayName | String? | Optional |
| avatarUrl | String? | Optional |
| emailVerifiedAt | DateTime? | Null until verified |
| isBlocked | Boolean | Default false |
| mfaEnabled | Boolean | Default false |
| mfaSecretEnc | String? | Encrypted TOTP secret |

### Session
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| userId | String | FK to User |
| ip | String? | Client IP |
| userAgent | String? | Parsed browser/OS |
| expiresAt | DateTime | Session expiry |
| revokedAt | DateTime? | Null if active |

### RefreshToken
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| userId | String | FK to User |
| sessionId | String | FK to Session |
| tokenHash | String | Unique, HMAC'd |
| tokenFamily | String | For reuse detection |
| expiresAt | DateTime | Token expiry |
| rotatedAt | DateTime? | When rotated |
| revokedAt | DateTime? | When revoked |
| reusedAt | DateTime? | When reuse detected |

### EmailActionToken
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| userId | String | FK to User |
| type | Enum | verify_email, password_reset, change_email |
| tokenHash | String | Unique |
| targetEmail | String? | For email change |
| expiresAt | DateTime | TTL: 24h verify, 30m reset, 24h change |
| consumedAt | DateTime? | Single-use |

### LoginAttempt
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| email | String | Indexed |
| ip | String | Indexed |
| outcome | String | success, invalid_credentials, user_blocked |

### AuditLog
| Column | Type | Notes |
|--------|------|-------|
| id | CUID | Primary key |
| userId | String? | FK to User |
| actor | String | Who performed action |
| action | String | Event type |
| meta | JSON | Additional metadata |

## Email System

### Providers
- **dev**: Saves `.eml` files to `.mailbox/` directory for local development
- **postmark**: Production email via Postmark API

### Templates
| Template | Subject | Expiry |
|----------|---------|--------|
| verify_email | Verify your email address - Bonnytone | 24 hours |
| password_reset | Reset your password - Bonnytone | 30 minutes |
| email_change_confirm | Confirm your new email address - Bonnytone | 24 hours |
| email_changed_notification | Email address changed - Bonnytone | N/A |
| login_alert | New login detected - Bonnytone | N/A |

### Development Workflow
```bash
# Emails are saved to .mailbox/
ls .mailbox/
# Files named: {timestamp}-{template}-{email}.eml
```

## Testing

### Test Structure
```
__tests__/
├── unit/
│   ├── crypto.test.ts         # Password hashing, token generation
│   ├── jwt.test.ts            # JWT creation/verification
│   ├── session.test.ts        # Session lifecycle, token rotation
│   └── zod-schemas.test.ts    # DTO validation
├── integration/
│   └── auth-endpoints.test.ts # Full endpoint testing
├── e2e/
│   └── email-flows.test.ts    # Registration → verification → reset
└── security/
    └── security-validation.test.ts # Cookie, JWT, timing validation
```

### Running Tests
```bash
npm test                # Unit tests
npm run test:e2e        # Playwright E2E tests
npm run test:coverage   # Coverage report
```

## Environment Configuration

### Required Variables
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/bonnytone"

JWT_ISSUER="bonnytone"
JWT_AUDIENCE="bonnytone.app"
JWT_ALGORITHM="ES256"
JWT_ACCESS_TTL="600"
JWT_REFRESH_TTL="2592000"
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
TOKEN_HMAC_SECRET="base64-32-byte-secret"

EMAIL_FROM="Bonnytone <no-reply@bonnytone.org>"
EMAIL_PROVIDER="dev"
APP_URL="http://localhost:3000"
```

### Optional Variables
```env
POSTMARK_TOKEN="..."              # For production email
REDIS_URL="redis://localhost:6379" # For production rate limiting
COOKIE_DOMAIN=".bonnytone.org"    # For production cookies
ALERT_WEBHOOK_URL="..."           # Slack/Discord alerts
```
