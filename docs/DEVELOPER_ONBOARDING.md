# Developer Onboarding Guide - Authentication System

## Quick Start (5 minutes)

### 1. Environment Setup
```bash
# Clone and install
git clone <repo-url>
cd bonnytone-radio
npm install

# Set up environment
cp .env.example .env.local

# Essential variables for auth development:
DATABASE_URL="postgresql://localhost:5432/artistmgmt_dev"
JWT_ISSUER="bonnytone"
JWT_AUDIENCE="bonnytone.app"
EMAIL_PROVIDER="dev"
APP_URL="http://localhost:3000"
```

### 2. Database Setup
```bash
# Start PostgreSQL (if using Docker)
docker run --name postgres-dev -p 5432:5432 -e POSTGRES_DB=artistmgmt_dev -d postgres:14

# Run migrations
npx prisma migrate dev
npx prisma generate
```

### 3. Test Auth System
```bash
# Start development server
npm run dev

# Test registration (in another terminal)
curl -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","displayName":"Test User"}'

# Check email was generated
ls .mailbox/  # Should see .eml file

# You're ready to develop! 🎉
```

## Understanding the Codebase

### Key Directories
```
/app/auth/           # Authentication UI pages (Next.js App Router)
/app/api/auth/       # API endpoints for authentication
/lib/auth/           # Core authentication logic
/lib/observability/  # Logging, metrics, monitoring
/__tests__/          # Comprehensive test suite
/docs/              # Documentation (you are here!)
```

### Authentication Flow (New Developer Perspective)

#### 1. Registration Process
**What happens when a user registers?**

```typescript
// 1. User submits form at /auth/register
// 2. Form data validated with Zod schemas (lib/zod.ts)
{
  email: "user@example.com",      // Must be valid email
  password: "SecurePass123!",     // Strong password required
  displayName: "John Doe"         // Optional
}

// 3. API endpoint handles request (app/api/auth/register/route.ts)
export async function POST(request: NextRequest) {
  // Rate limiting check
  await checkRateLimit(registerLimiterIP, ip);

  // Validate input with Zod
  const data = RegisterDto.parse(await request.json());

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email }
  });

  // Hash password with Argon2id
  const passwordHash = await hashPassword(data.password);

  // Create user in database
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName }
  });

  // Generate email verification token
  const token = await createEmailActionToken(user.id, 'verify_email');

  // Send verification email
  await sendEmail('verify_email', user.email, { token, displayName });

  // Return success (no sensitive data)
  return NextResponse.json({ ok: true, message: "Check your email..." });
}
```

#### 2. Email Verification Process
**How email verification works:**

```typescript
// 1. Email sent with verification link
// Development: Saved to .mailbox/verify_email_timestamp.eml
// Production: Sent via Postmark/SendGrid/SES

// 2. User clicks link: /auth/verify-email?token=abc123
// 3. API endpoint validates token (app/api/auth/verify-email/route.ts)
export async function POST(request: NextRequest) {
  const { token } = VerifyEmailDto.parse(await request.json());

  // Find and validate token
  const tokenRecord = await prisma.emailActionToken.findFirst({
    where: {
      type: 'verify_email',
      consumedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  // Verify token hash
  const isValidToken = verifyHashedToken(token, tokenRecord.tokenHash);

  // Mark user as verified
  await prisma.user.update({
    where: { id: tokenRecord.userId },
    data: { emailVerifiedAt: new Date() }
  });

  // Mark token as consumed
  await prisma.emailActionToken.update({
    where: { id: tokenRecord.id },
    data: { consumedAt: new Date() }
  });

  // Auto-login user after verification
  const sessionInfo = await createSession(user.id, ip, userAgent);

  return NextResponse.json({
    message: "Email verified successfully",
    token: sessionInfo.accessToken,
    user: { id, email, displayName, emailVerifiedAt }
  });
}
```

#### 3. Login Process
**Understanding the login flow:**

```typescript
// 1. User submits login form at /auth/login
// 2. API endpoint handles authentication (app/api/auth/login/route.ts)
export async function POST(request: NextRequest) {
  // Rate limiting (prevent brute force)
  await checkRateLimit(loginLimiterEmail, email);
  await checkRateLimit(loginLimiterIP, ip);

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: data.email }
  });

  // Verify password with Argon2id
  const isValidPassword = await verifyPassword(user.passwordHash, data.password);

  // Check if user is blocked
  if (user.isBlocked) {
    return NextResponse.json(
      { error: "Account is blocked" },
      { status: 403 }
    );
  }

  // Check email verification
  if (!user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Email not verified" },
      { status: 400 }
    );
  }

  // Handle MFA if enabled
  if (user.mfaEnabled && !data.mfaCode) {
    return NextResponse.json(
      { error: "MFA code is required", requiresMFA: true },
      { status: 400 }
    );
  }

  // Verify MFA code if provided
  if (user.mfaEnabled && data.mfaCode) {
    const isValidMFA = await verifyTOTP(user.mfaSecretEnc, data.mfaCode);
    if (!isValidMFA) {
      return NextResponse.json(
        { error: "Invalid MFA code" },
        { status: 401 }
      );
    }
  }

  // Check if password needs rehashing (security upgrade)
  if (needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(data.password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });
  }

  // Create session with JWT tokens
  const sessionInfo = await createSession(user.id, ip, userAgent);

  // Set secure cookies
  const response = NextResponse.json({
    token: sessionInfo.accessToken,
    user: { id, email, displayName, emailVerifiedAt }
  });

  setAccessTokenCookie(response, sessionInfo.accessToken);
  setRefreshTokenCookie(response, sessionInfo.refreshToken);
  setSessionCookie(response, sessionInfo.sessionId);

  return response;
}
```

### Token Security Deep Dive

#### JWT Access Tokens
**What's inside an access token?**

```typescript
// JWT Payload Structure
{
  sub: "user_123",              // Subject (User ID)
  sid: "session_456",           // Session ID
  iss: "bonnytone",           // Issuer
  aud: "bonnytone.app",       // Audience
  iat: 1640995200,             // Issued At
  exp: 1640995800,             // Expires At (10 minutes)
  type: "access",              // Token Type
  scope: "user"                // Permission Scope
}

// How to verify an access token
const payload = await verifyAccessJwt(token);
if (!payload) {
  return NextResponse.json({ error: "Invalid token" }, { status: 401 });
}
// payload.sub contains the user ID
// payload.sid contains the session ID
```

#### Refresh Token Security
**Understanding token rotation:**

```typescript
// When user refreshes tokens (app/api/auth/refresh/route.ts)
export async function POST(request: NextRequest) {
  // Get refresh token from cookie
  const refreshToken = getRefreshTokenFromCookies(request);

  // Verify JWT structure
  const payload = await verifyRefreshJwt(refreshToken);

  // Find token in database
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { id: payload.jti },
    include: { session: true }
  });

  // CHECK FOR REUSE (Critical security check!)
  if (tokenRecord.rotatedAt) {
    // 🚨 SECURITY VIOLATION: Token was already rotated
    // This means someone is trying to reuse an old token

    // Mark as reused for forensics
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { reusedAt: new Date(), revokedAt: new Date() }
    });

    // REVOKE ALL TOKENS IN THE SAME FAMILY
    await prisma.refreshToken.updateMany({
      where: { tokenFamily: tokenRecord.tokenFamily, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    // REVOKE THE SESSION
    await prisma.session.update({
      where: { id: tokenRecord.sessionId },
      data: { revokedAt: new Date() }
    });

    // LOG SECURITY EVENT
    await logAuthEvent('token_reuse', tokenRecord.userId, tokenRecord.sessionId);

    // ALERT SECURITY TEAM
    await alertSecurityTeam('token_reuse_detected', {
      userId: tokenRecord.userId,
      tokenFamily: tokenRecord.tokenFamily,
      ip: getClientIp(request)
    });

    return NextResponse.json(
      { error: "Invalid refresh token" },
      { status: 401 }
    );
  }

  // Token is valid, proceed with rotation

  // 1. Mark current token as rotated
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { rotatedAt: new Date() }
  });

  // 2. Create new token in same family (for reuse detection)
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
      tokenHash: hashToken(newRefreshJwt),
      tokenFamily: tokenRecord.tokenFamily, // Same family!
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  // 3. Issue new access token
  const newAccessJwt = await issueAccessJwt(tokenRecord.userId, tokenRecord.sessionId);

  // 4. Set new cookies
  const response = NextResponse.json({ token: newAccessJwt });
  setAccessTokenCookie(response, newAccessJwt);
  setRefreshTokenCookie(response, newRefreshJwt);

  return response;
}
```

## Common Development Tasks

### Adding a New Auth Endpoint

#### 1. Create the API Route
```typescript
// app/api/auth/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guards';
import { MyEndpointDto } from '@/lib/zod';
import { logAuthEvent } from '@/lib/observability';

export const dynamic = 'force-dynamic'; // Important for auth routes

export async function POST(request: NextRequest) {
  try {
    // 1. Validate authentication (if required)
    const authResult = await authGuard(request, {
      requireEmailVerified: true,
      requireNotBlocked: true
    });

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const data = MyEndpointDto.parse(body);

    // 3. Implement your logic here
    // ...

    // 4. Log the event for audit trail
    await logAuthEvent('my_action', authResult.userId, authResult.sessionId);

    // 5. Return response
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('My endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 2. Add Request/Response DTOs
```typescript
// lib/zod.ts
export const MyEndpointDto = z.object({
  someField: z.string().min(1).max(100),
  anotherField: z.string().email(),
});

export type MyEndpointRequest = z.infer<typeof MyEndpointDto>;
```

#### 3. Add Tests
```typescript
// __tests__/integration/my-endpoint.test.ts
describe('POST /api/auth/my-endpoint', () => {
  test('should handle valid request', async () => {
    const request = createRequest('POST', {
      someField: 'valid-value',
      anotherField: 'test@example.com'
    });

    const response = await myEndpointHandler(request);
    const data = await getJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  test('should reject invalid input', async () => {
    const request = createRequest('POST', {
      someField: '',  // Invalid: empty string
      anotherField: 'invalid-email'
    });

    const response = await myEndpointHandler(request);
    expect(response.status).toBe(400);
  });
});
```

### Adding a New Email Template

#### 1. Create Template Function
```typescript
// lib/auth/email.ts
export async function sendMyNotificationEmail(
  to: string,
  data: {
    displayName: string;
    customData: string;
  }
) {
  const subject = `Custom Notification - ${APP_NAME}`;

  const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Hello ${escapeHtml(data.displayName)}!</h1>
      <p>This is your custom notification.</p>
      <p>Custom data: ${escapeHtml(data.customData)}</p>
      <hr>
      <p>Best regards,<br>The ${APP_NAME} Team</p>
    </div>
  `;

  const textTemplate = `
Hello ${data.displayName}!

This is your custom notification.
Custom data: ${data.customData}

Best regards,
The ${APP_NAME} Team
  `.trim();

  return await sendEmail('my_notification', to, {
    subject,
    htmlTemplate,
    textTemplate,
    ...data
  });
}
```

#### 2. Add to Email Provider Templates
```typescript
// lib/auth/email.ts - Add to emailTemplates object
export const emailTemplates = {
  // ... existing templates
  my_notification: {
    subject: (data: any) => `Custom Notification - ${APP_NAME}`,
    html: (data: any) => `<h1>Hello ${escapeHtml(data.displayName)}!</h1>...`,
    text: (data: any) => `Hello ${data.displayName}!\n\n...`,
  }
};
```

#### 3. Test the Email Template
```typescript
// __tests__/e2e/email-flows.test.ts
test('should generate correct my notification email template', async () => {
  await sendEmail('my_notification', 'test@example.com', {
    displayName: 'Test User',
    customData: 'test-data'
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  const email = await readLatestEmail();
  expect(email).toBeDefined();
  expect(email!.subject).toContain('Custom Notification');
  expect(email!.content).toContain('test@example.com');
  expect(email!.content).toContain('Test User');
  expect(email!.content).toContain('test-data');
});
```

### Debugging Authentication Issues

#### Enable Debug Logging
```typescript
// Add to .env.local for detailed auth logging
DEBUG="auth:*"
LOG_LEVEL="debug"

// Or programmatically in your code
import { logger } from '@/lib/observability';

logger.debug('Authentication attempt', {
  email: user.email,
  ip: getClientIp(request),
  userAgent: request.headers.get('user-agent')
});
```

#### Common Debugging Scenarios

**Issue: "Invalid JWT token"**
```typescript
// Debugging JWT verification
const token = getAccessTokenFromCookies(request);
console.log('Token from cookie:', token);

const payload = await verifyAccessJwt(token);
console.log('Token payload:', payload);

if (!payload) {
  // Check JWT configuration
  console.log('JWT_ISSUER:', process.env.JWT_ISSUER);
  console.log('JWT_AUDIENCE:', process.env.JWT_AUDIENCE);
  console.log('JWT_ALGORITHM:', process.env.JWT_ALGORITHM);
}
```

**Issue: "Email not sending"**
```typescript
// Check email provider configuration
console.log('EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);

// For dev mode, check .mailbox directory
const fs = require('fs');
const mailboxFiles = fs.readdirSync('.mailbox');
console.log('Email files:', mailboxFiles);

// Test email sending directly
try {
  await sendEmail('test', 'debug@test.com', {
    displayName: 'Debug User'
  });
  console.log('Email sent successfully');
} catch (error) {
  console.error('Email sending failed:', error);
}
```

**Issue: "Rate limiting not working"**
```typescript
// Check rate limiter configuration
import { checkRateLimit, loginLimiterEmail } from '@/lib/auth/rates';

const result = await checkRateLimit(loginLimiterEmail, 'test@example.com');
console.log('Rate limit result:', result);

// Check Redis connection (if using Redis)
const redis = require('@/lib/redis');
await redis.ping();
console.log('Redis connected');
```

## Security Best Practices for Developers

### 1. Never Log Sensitive Data
```typescript
// ❌ DON'T DO THIS
console.log('User login attempt:', {
  email: user.email,
  password: requestData.password  // 🚨 NEVER log passwords!
});

// ✅ DO THIS
console.log('User login attempt:', {
  email: user.email,
  ip: getClientIp(request),
  timestamp: new Date().toISOString()
});
```

### 2. Always Validate Input
```typescript
// ❌ DON'T DO THIS
const userData = await request.json();
const user = await prisma.user.create({ data: userData }); // Dangerous!

// ✅ DO THIS
const body = await request.json();
const userData = RegisterDto.parse(body); // Validates with Zod
const user = await prisma.user.create({ data: userData });
```

### 3. Use Type-Safe Database Queries
```typescript
// ❌ DON'T DO THIS
const user = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`; // Potential SQL injection

// ✅ DO THIS
const user = await prisma.user.findUnique({
  where: { email }
}); // Type-safe and SQL injection proof
```

### 4. Handle Errors Securely
```typescript
// ❌ DON'T DO THIS
catch (error) {
  return NextResponse.json({ error: error.message }); // May expose sensitive info
}

// ✅ DO THIS
catch (error) {
  logger.error('Authentication error', { error: error.message, stack: error.stack });
  return NextResponse.json(
    { error: 'Authentication failed' }, // Generic error message
    { status: 500 }
  );
}
```

### 5. Rate Limit All Auth Endpoints
```typescript
// ✅ Always add rate limiting to auth endpoints
export async function POST(request: NextRequest) {
  // Check rate limits FIRST
  const ipLimit = await checkRateLimit(myEndpointLimiterIP, getClientIp(request));
  if (!ipLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  // Then proceed with business logic
  // ...
}
```

## Testing Your Changes

### Running the Test Suite
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Security tests
npm run test:security

# Run all tests
npm run test:all
```

### Manual Testing Checklist
- [ ] Registration flow works end-to-end
- [ ] Email verification completes successfully
- [ ] Login works with verified account
- [ ] Password reset flow works
- [ ] MFA setup and login works (if implemented)
- [ ] Rate limiting triggers correctly
- [ ] Refresh token rotation works
- [ ] Token reuse detection triggers security response
- [ ] Logout clears all sessions
- [ ] Protected routes require authentication

### Performance Testing
```bash
# Test auth endpoint performance
npx autocannon -c 10 -d 5 -m POST \
  -H "Content-Type: application/json" \
  -b '{"email":"test@example.com","password":"Test123!"}' \
  http://localhost:3000/api/auth/login
```

## Getting Help

### Documentation Resources
- **Main Auth Documentation**: `/docs/AUTHENTICATION_SYSTEM.md`
- **API Reference**: Check individual route files for detailed comments
- **Database Schema**: `/prisma/schema.prisma`
- **Test Examples**: `/__tests__/` directory

### Common Questions

**Q: How do I add a new protected route?**
A: Use the `authGuard` or `withAuth` higher-order function:

```typescript
import { withAuth } from '@/lib/auth/guards';

export const GET = withAuth(
  async (request: NextRequest, context: AuthContext) => {
    // context.userId and context.sessionId available
    return NextResponse.json({ message: 'Protected content' });
  },
  { requireEmailVerified: true }
);
```

**Q: How do I test email flows in development?**
A: Set `EMAIL_PROVIDER=dev` and check the `.mailbox/` directory for `.eml` files.

**Q: How do I add custom fields to the user registration?**
A: 1) Update the Prisma schema, 2) Update Zod validation DTOs, 3) Update the registration API endpoint.

**Q: How do I customize email templates?**
A: Edit the template functions in `/lib/auth/email.ts` or add new ones following the existing pattern.

**Q: How do I handle environment-specific configuration?**
A: Use environment variables in `.env.local` for development and set them in your production deployment.

---

Welcome to the team! This authentication system is designed to be secure, maintainable, and developer-friendly. When in doubt, check the existing patterns in the codebase or ask questions.