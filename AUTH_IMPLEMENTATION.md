# Authentication System Implementation

## Overview

This document describes the complete authentication system implementation for the Artist Management Dashboard. The system provides a full-featured authentication flow with email verification, password reset, and secure session management.

## Architecture

### Tech Stack
- **Frontend**: Next.js 13 App Router, TypeScript, shadcn/ui components
- **Backend**: Next.js API routes with Prisma ORM
- **Database**: PostgreSQL
- **Email System**: Multi-provider support (dev, Postmark, SendGrid, SES)
- **Security**: JWT tokens, bcrypt password hashing, rate limiting
- **Testing**: Playwright E2E tests

### Directory Structure
```
app/
├── auth/
│   ├── login/
│   ├── register/
│   ├── verify-email/
│   └── reset-password/
├── api/auth/
│   ├── login/route.ts
│   ├── register/route.ts
│   ├── verify-email/route.ts
│   └── reset-password/route.ts
components/
├── auth/
│   ├── login-form.tsx
│   ├── register-form.tsx
│   ├── verify-email-form.tsx
│   └── reset-password-form.tsx
lib/
├── auth/
│   ├── crypto.ts         # Password hashing
│   ├── email.ts          # Email templates & sending
│   ├── tokens.ts         # JWT & verification tokens
│   └── rates.ts          # Rate limiting
└── zod.ts               # Form validation schemas
```

## Core Components

### 1. Registration System (`/auth/register`)

**UI Component**: `components/auth/register-form.tsx`
- Clean, minimalistic form design with shadcn/ui components
- Real-time validation feedback
- Fields: email, displayName, password, confirmPassword
- Loading states and error handling

**API Endpoint**: `app/api/auth/register/route.ts`
- Validates input using Zod schema
- Rate limiting: 3 attempts/minute per IP, 10/day per email
- Checks for existing users (409 conflict response)
- Creates user with hashed password
- Generates email verification token
- Sends verification email
- Returns 201 success without auto-login

**Features**:
- Email uniqueness validation
- Strong password requirements
- Comprehensive error handling
- Security metrics and logging
- Development email capture

### 2. Email Verification System

**Email Templates**: Generated in `lib/auth/email.ts`
- Multi-format support (HTML + plain text)
- Professional styling with ArtistMgmt branding
- Secure verification links with tokens
- 24-hour expiration

**Development Mode**:
- Emails saved to `.mailbox/` directory in EML format
- Filename pattern: `{timestamp}-{template}-{email}.eml`
- Console logging for visibility

**Production Providers**:
- **Postmark**: Template-based sending
- **SendGrid**: API integration (planned)
- **AWS SES**: Regional support (planned)

### 3. Login System (`/auth/login`)

**UI Component**: `components/auth/login-form.tsx`
- Email/password form with remember me option
- Forgot password link integration
- Loading states and validation

**API Endpoint**: `app/api/auth/login/route.ts`
- Email verification requirement check
- Password validation with bcrypt
- JWT token generation (access + refresh)
- Secure cookie setting
- Rate limiting protection

### 4. Password Reset System

**UI Components**:
- `components/auth/reset-password-form.tsx`: Initial reset request
- Password reset confirmation form (in reset-password page)

**Flow**:
1. User requests reset with email
2. System sends reset link (30-minute expiration)
3. User clicks link and sets new password
4. Password updated with new hash

### 5. Email Verification Flow

**UI Component**: `components/auth/verify-email-form.tsx`
- Token processing from URL parameters
- Success/error state handling
- Redirect to login on success

**Process**:
1. User clicks verification link from email
2. Token validated and user marked as verified
3. User redirected to login page
4. Login now permitted for verified users

## Security Features

### Password Security
- **Hashing**: bcrypt with salt rounds
- **Requirements**: Minimum length, complexity rules
- **Storage**: Only hashed passwords stored, never plaintext

### Rate Limiting
- **Registration**: 3 attempts/minute per IP, 10/day per email
- **Login**: Configurable limits per IP/email
- **Memory fallback**: Works without Redis in development

### Token Security
- **JWT Tokens**: ES256 signature algorithm
- **Verification Tokens**: Cryptographically secure random generation
- **Expiration**: Access tokens (10min), refresh tokens (30d), email tokens (24h)
- **Secure Cookies**: HttpOnly, SameSite, Secure flags

### Input Validation
- **Zod Schemas**: Comprehensive input validation
- **Email Format**: RFC-compliant email validation
- **Password Strength**: Configurable requirements
- **XSS Protection**: All user inputs sanitized

## Environment Configuration

### Required Variables
```env
# Database
DATABASE_URL="postgresql://..."

# JWT Configuration
JWT_ISSUER="artistmgmt"
JWT_AUDIENCE="artistmgmt.app"
JWT_ACCESS_TTL="600"                 # 10 minutes
JWT_REFRESH_TTL="2592000"            # 30 days
JWT_ALGORITHM="ES256"
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
TOKEN_HMAC_SECRET="base64-32B+"

# Email Configuration
EMAIL_FROM="ArtistMgmt <no-reply@artistmgmt.org>"
EMAIL_PROVIDER="dev"                 # dev|postmark|sendgrid|ses
POSTMARK_TOKEN="..."
SENDGRID_API_KEY="..."
SES_REGION="us-east-1"

# Application
APP_URL="http://localhost:3000"
COOKIE_DOMAIN=".artistmgmt.org"
NODE_ENV="development"
```

### Critical Configuration Notes
- **EMAIL_PROVIDER**: Must not contain inline comments
- **JWT Keys**: ES256 requires proper key pair generation
- **Database**: PostgreSQL with proper user permissions

## Testing

### Playwright E2E Tests
**File**: `tests/e2e/registration.spec.ts`

**Test Coverage**:
- Complete registration flow validation
- Email generation verification
- Duplicate registration handling
- Form validation testing
- Error state verification

**Helper Functions**:
```typescript
cleanMailbox()           # Clears .mailbox before tests
waitForEmail(timeout)    # Waits for email files
readEmailContent(path)   # Reads EML content
```

**Test Configuration**:
- Runs on port 3006 to avoid conflicts
- Automatic server startup/shutdown
- Screenshot capture for debugging
- Email file system integration

## Database Schema

### Users Table
```sql
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  displayName       String
  passwordHash      String
  emailVerifiedAt   DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  // Additional fields...
}
```

### Email Tokens Table
```sql
model EmailActionToken {
  id          String    @id @default(cuid())
  userId      String
  type        TokenType
  tokenHash   String    @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())
}
```

## Email Templates

### Verification Email
- **Subject**: "Verify your email address - ArtistMgmt"
- **Content**: Welcome message with verification button
- **Expiry**: 24 hours
- **Styling**: Professional HTML with fallback text

### Password Reset Email
- **Subject**: "Reset your password - ArtistMgmt"
- **Content**: Security-focused reset instructions
- **Expiry**: 30 minutes
- **Security**: Clear warning about ignoring if not requested

### Email Change Confirmation
- **Subject**: "Confirm your new email address - ArtistMgmt"
- **Content**: Old/new email confirmation
- **Expiry**: 24 hours

## Error Handling

### Frontend Error States
- Network errors with retry options
- Validation errors with field-specific messaging
- Rate limit warnings with timeout information
- Server errors with user-friendly messages

### Backend Error Responses
- **400**: Invalid input with detailed validation errors
- **409**: Conflict (email exists, already verified)
- **429**: Rate limit exceeded with retry-after
- **500**: Internal server error (logged, not exposed)

## Development Workflow

### Local Development
1. Start PostgreSQL database
2. Set `EMAIL_PROVIDER="dev"` in `.env.local`
3. Run `npm run dev` to start development server
4. Check `.mailbox/` directory for generated emails
5. Use Playwright tests for validation

### Testing Registration Flow
```bash
# Run specific test
npx playwright test tests/e2e/registration.spec.ts --headed

# Run with debugging
npx playwright test tests/e2e/registration.spec.ts --debug

# Check email generation
ls -la .mailbox/
```

### Email Debugging
- Check `.mailbox/` directory for EML files
- Verify EMAIL_PROVIDER configuration
- Restart server after environment changes
- Check console logs for email generation confirmations

## Known Issues & Solutions

### Email Provider Configuration
**Issue**: Environment variable with inline comments
```env
# WRONG
EMAIL_PROVIDER="dev"                 # postmark|sendgrid|ses|dev

# CORRECT  
EMAIL_PROVIDER="dev"
```

**Solution**: Remove inline comments, restart server

### Server Environment Caching
**Issue**: Environment changes not reflected
**Solution**: Kill and restart development server

### JSON Parsing in API Tests
**Issue**: Escaped characters in curl requests
**Solution**: Use Playwright browser testing instead

## Future Enhancements

### Planned Features
- Multi-factor authentication (MFA)
- Social login providers (Google, GitHub)
- Session management dashboard
- Advanced security notifications
- Account lockout after failed attempts

### Performance Optimizations
- Redis integration for rate limiting
- Email queue for bulk operations
- Database connection pooling
- CDN integration for static assets

### Security Improvements
- CAPTCHA integration
- Advanced bot detection
- Suspicious activity monitoring
- Audit logging enhancement

## Maintenance

### Regular Tasks
- Monitor rate limiting effectiveness
- Review authentication logs
- Update security dependencies
- Test email deliverability
- Database cleanup of expired tokens

### Security Monitoring
- Failed login attempt patterns
- Unusual registration spikes
- Email bounce rates
- Token usage analytics

This implementation provides a robust, secure, and user-friendly authentication system that serves as the foundation for the Artist Management Dashboard's user management needs.