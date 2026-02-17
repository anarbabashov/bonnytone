# Bonny Tone Radio — Authentication System Documentation

## Documentation Suite

| Document | Purpose | Target Audience |
|----------|---------|-----------------|
| **[Authentication System Guide](./AUTHENTICATION_SYSTEM.md)** | Complete system overview, architecture, and API reference | All developers |
| **[Developer Onboarding Guide](./DEVELOPER_ONBOARDING.md)** | Quick start guide and common development tasks | New developers |
| **[Security Implementation Guide](./SECURITY_GUIDE.md)** | Detailed security architecture and best practices | Security engineers |
| **[Troubleshooting & Maintenance](./TROUBLESHOOTING_MAINTENANCE.md)** | Diagnostic procedures and maintenance tasks | DevOps, support |

## Quick Start

### New Developer Setup
```bash
# 1. Environment setup
cp .env.example .env.local
npm install

# 2. Database setup
npx prisma migrate dev
npx prisma generate

# 3. Start development
npm run dev

# 4. Test authentication
curl -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","displayName":"Test User"}'
```

## Architecture Summary

The authentication system provides secure user accounts for the Bonny Tone Radio platform. Registered users get access to personalized features like mix/DJ reminders and track favoriting.

```
Frontend (Next.js + React)
├── Authentication Pages (/auth/*)
├── Protected Routes with Guards
└── Real-time Form Validation

Backend (Next.js API Routes)
├── JWT Access Tokens (10min)
├── Rotating Refresh Tokens (30 days)
├── Multi-Factor Authentication (TOTP)
├── Rate Limiting
└── Audit Logging

Database (PostgreSQL + Prisma)
├── User Management
├── Session Tracking
├── Token Rotation & Reuse Detection
└── Security Audit Trail

Email System (Multi-provider)
├── Development: .mailbox files
├── Production: Postmark
└── HTML/Text templates
```

## Implemented Security Features

- **Argon2id Password Hashing** with automatic upgrading
- **JWT Token Security** with ES256/HS512 algorithms
- **Token Rotation & Reuse Detection** with family-based revocation
- **Multi-Factor Authentication** (TOTP) with backup codes
- **Rate Limiting** with Redis/memory fallback
- **Secure Cookies** with HttpOnly, SameSite, Secure flags
- **Comprehensive Audit Logging** for all authentication events
- **Input Validation** with Zod schema validation

## Development Workflow

**Adding a New Protected Route:**
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

**Testing Authentication:**
```bash
npm test               # Unit tests
npm run test:e2e       # E2E tests (Playwright)
```
