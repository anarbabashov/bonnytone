# Authentication Implementation Notes

## Overview

This document describes the authentication system implementation for the Bonny Tone Radio platform. The system provides registration, email verification, login, password management, MFA, and secure session management.

## Tech Stack
- **Frontend**: Next.js 13 App Router, TypeScript, shadcn/ui
- **Backend**: Next.js API routes, Prisma ORM, PostgreSQL
- **Email**: Multi-provider (dev file-based, Postmark)
- **Security**: Argon2id hashing, JWT (ES256/HS512), rate limiting
- **Testing**: Jest unit/integration, Playwright E2E

## Directory Structure
```
app/
├── auth/                    # Auth UI pages
│   ├── login/
│   ├── register/
│   ├── verify-email/
│   ├── forgot-password/
│   └── reset-password/
├── api/auth/                # Auth API endpoints
│   ├── register/route.ts
│   ├── login/route.ts
│   ├── logout/route.ts
│   ├── refresh/route.ts
│   ├── me/route.ts
│   ├── verify-email/route.ts
│   ├── resend-verification/route.ts
│   ├── forgot-password/route.ts
│   └── reset-password/route.ts
├── api/account/             # Account management
│   ├── change-password/
│   ├── change-email/
│   └── mfa/
└── api/monitoring/          # Health, metrics, alerts
components/auth/             # Auth form components
lib/auth/                    # Core auth logic
lib/observability/           # Logging, metrics, alerts
```

## Authentication Flows

### Registration
1. User submits form (`/auth/register`)
2. Input validated with Zod (`RegisterDto`)
3. Rate limiting checked (3/min per IP, 10/day per email)
4. Existing user check (409 on conflict)
5. Password hashed with Argon2id
6. User created in database
7. Email verification token generated (24h TTL)
8. Verification email sent
9. Returns 201 (no auto-login)

### Email Verification
1. User clicks link from email (`/auth/verify-email?token=...`)
2. Token validated and consumed (single-use)
3. User marked as verified (`emailVerifiedAt` set)
4. Session created, user auto-logged in
5. Access + refresh tokens set in cookies

### Login
1. Rate limiting checked (20/15min per IP, 10/15min per email)
2. User looked up by email
3. Email verification required
4. Account block check
5. Password verified with Argon2id
6. MFA check (if enabled, requires TOTP code)
7. Password rehash if parameters outdated
8. Session created with JWT tokens
9. Secure cookies set (HttpOnly, SameSite, Secure in prod)

### Token Refresh
1. Refresh token read from cookie
2. JWT structure verified
3. Token record found in database
4. **Reuse detection**: if `rotatedAt` is set, token was already used — revoke entire family + session + alert
5. Current token marked as rotated
6. New refresh token created in same family
7. New access token issued
8. Cookies updated

### Password Reset
1. User requests reset (`/auth/forgot-password`)
2. Always returns success (prevents user enumeration)
3. Reset token sent via email (30min TTL)
4. User submits new password with token (`/auth/reset-password`)
5. Token consumed, password updated
6. All user sessions revoked

## Email System

### Development Mode
Emails saved as `.eml` files in `.mailbox/` directory with format:
```
{timestamp}-{template}-{email}.eml
```

### Production
Postmark API integration with HTML + plain text templates.

### Templates
- `verify_email` — Welcome + verification link (24h)
- `password_reset` — Reset link (30min)
- `email_change_confirm` — Confirm new email (24h)
- `email_changed_notification` — Notify old email
- `login_alert` — New login notification

## Testing

### E2E Tests (`tests/e2e/registration.spec.ts`)
- Complete registration flow
- Email generation verification
- Duplicate registration handling
- Form validation

Runs on port 3006 with automatic server management.

### Test Helpers
- `cleanMailbox()` — Clears `.mailbox/` before tests
- `waitForEmail(timeout)` — Waits for email files
- `readEmailContent(path)` — Reads EML content

## Known Issues & Solutions

### Email Provider Configuration
```env
# WRONG — inline comments break the value
EMAIL_PROVIDER="dev"                 # postmark|sendgrid|ses|dev

# CORRECT
EMAIL_PROVIDER="dev"
```

### Server Environment Caching
Environment changes require killing and restarting the dev server.
