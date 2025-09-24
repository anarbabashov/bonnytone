# Troubleshooting & Maintenance Guide

## Quick Diagnostic Commands

### System Health Check
```bash
# Check all core services
npm run health:check

# Individual component health
curl localhost:3000/api/health/db      # Database connectivity
curl localhost:3000/api/health/redis   # Redis connectivity (if used)
curl localhost:3000/api/health/email   # Email provider status
curl localhost:3000/api/health/auth    # Auth system status
```

### Authentication Flow Testing
```bash
# Test complete auth flow
npm run test:auth-flow

# Test individual endpoints
curl -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"debug@test.com","password":"Test123!","displayName":"Debug User"}'

curl -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"debug@test.com","password":"Test123!"}' \
  -c cookies.txt -v

curl -X GET localhost:3000/api/auth/me \
  -b cookies.txt -v
```

## Common Issues & Solutions

### 1. Email Not Sending

#### Symptoms
- Registration completes but no verification email received
- Password reset requests don't send emails
- `.mailbox` directory empty in development

#### Diagnosis
```bash
# Check email provider configuration
echo "EMAIL_PROVIDER: $EMAIL_PROVIDER"
echo "EMAIL_FROM: $EMAIL_FROM"

# For development mode
ls -la .mailbox/
cat .mailbox/*.eml | head -20

# For production providers
# Postmark
echo "POSTMARK_TOKEN: ${POSTMARK_TOKEN:0:10}..." # Show first 10 chars only

# SendGrid
echo "SENDGRID_API_KEY: ${SENDGRID_API_KEY:0:10}..."
```

#### Solutions

**Development Issues:**
```bash
# Ensure .mailbox directory exists and is writable
mkdir -p .mailbox
chmod 755 .mailbox

# Check for filesystem permissions
touch .mailbox/test.txt && rm .mailbox/test.txt || echo "Permission denied"

# Verify EMAIL_PROVIDER is set to 'dev'
grep EMAIL_PROVIDER .env.local
```

**Production Issues:**
```bash
# Test Postmark configuration
curl -X POST "https://api.postmarkapp.com/email" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "X-Postmark-Server-Token: $POSTMARK_TOKEN" \
  -d '{
    "From": "'"$EMAIL_FROM"'",
    "To": "test@example.com",
    "Subject": "Test Email",
    "TextBody": "This is a test email"
  }'

# Check Postmark account status
curl -X GET "https://api.postmarkapp.com/server" \
  -H "Accept: application/json" \
  -H "X-Postmark-Server-Token: $POSTMARK_TOKEN"
```

**Common Fixes:**
```typescript
// lib/auth/email.ts - Add debugging
export async function sendEmail(template: string, to: string, data: any) {
  console.log('Sending email:', { template, to, provider: process.env.EMAIL_PROVIDER });

  try {
    const result = await emailProvider.send(template, to, data);
    console.log('Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}
```

### 2. JWT Token Issues

#### Symptoms
- "Invalid JWT token" errors
- Users logged out unexpectedly
- Authentication fails after deployment

#### Diagnosis
```bash
# Check JWT configuration
node -e "
console.log('JWT_ISSUER:', process.env.JWT_ISSUER);
console.log('JWT_AUDIENCE:', process.env.JWT_AUDIENCE);
console.log('JWT_ALGORITHM:', process.env.JWT_ALGORITHM);
console.log('JWT_ACCESS_TTL:', process.env.JWT_ACCESS_TTL);
"

# Validate JWT keys exist (don't log the actual keys!)
node -e "
console.log('JWT_PRIVATE_KEY exists:', !!process.env.JWT_PRIVATE_KEY);
console.log('JWT_PUBLIC_KEY exists:', !!process.env.JWT_PUBLIC_KEY);
console.log('TOKEN_HMAC_SECRET exists:', !!process.env.TOKEN_HMAC_SECRET);
"

# Test JWT creation and verification
node -e "
const { issueAccessJwt, verifyAccessJwt } = require('./lib/auth/jwt');
(async () => {
  try {
    const token = await issueAccessJwt('test-user', 'test-session');
    console.log('Token created successfully');
    const payload = await verifyAccessJwt(token);
    console.log('Token verified:', !!payload);
  } catch (error) {
    console.error('JWT test failed:', error.message);
  }
})();
"
```

#### Solutions

**Missing Environment Variables:**
```bash
# Generate new JWT keys (ES256)
openssl ecparam -genkey -name prime256v1 -noout -out jwt_private.key
openssl ec -in jwt_private.key -pubout -out jwt_public.key

# Add to .env.local (single line, with \n for line breaks)
echo "JWT_PRIVATE_KEY=\"$(cat jwt_private.key | tr '\n' '\\n')\"" >> .env.local
echo "JWT_PUBLIC_KEY=\"$(cat jwt_public.key | tr '\n' '\\n')\"" >> .env.local

# Generate HMAC secret (32 bytes, base64 encoded)
openssl rand -base64 32
echo "TOKEN_HMAC_SECRET=\"$(openssl rand -base64 32)\"" >> .env.local
```

**Algorithm Mismatch:**
```typescript
// Check and fix algorithm configuration
// .env.local
JWT_ALGORITHM=ES256  // For elliptic curve keys
// OR
JWT_ALGORITHM=HS512  // For HMAC secret

// lib/auth/jwt.ts - Ensure consistency
const algorithm = process.env.JWT_ALGORITHM as Algorithm || 'ES256';
```

**Clock Skew Issues:**
```typescript
// lib/auth/jwt.ts - Add clock tolerance
export async function verifyAccessJwt(token: string) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
    algorithms: [process.env.JWT_ALGORITHM],
    clockTolerance: 60, // Allow 60 seconds of clock skew
  });
}
```

### 3. Database Connection Issues

#### Symptoms
- "Database connection failed" errors
- Slow database queries
- Connection pool exhaustion

#### Diagnosis
```bash
# Test database connection
npx prisma db pull

# Check database status
psql $DATABASE_URL -c "SELECT NOW();"

# Check connection pool stats
node -e "
const { prisma } = require('./lib/prisma');
console.log('Database URL configured:', !!process.env.DATABASE_URL);
// Note: Don't log the actual DATABASE_URL as it contains credentials
"

# Monitor database connections
psql $DATABASE_URL -c "
SELECT
  state,
  COUNT(*) as connection_count
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;
"
```

#### Solutions

**Connection String Issues:**
```bash
# Verify DATABASE_URL format
# postgresql://username:password@hostname:port/database?schema=public

# Test with minimal connection
psql "postgresql://user:pass@host:5432/dbname" -c "SELECT 1;"
```

**Connection Pool Configuration:**
```typescript
// lib/prisma.ts - Optimize connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Add connection pool settings to DATABASE_URL
// postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20
```

**Migration Issues:**
```bash
# Check migration status
npx prisma migrate status

# Reset database (CAUTION: Development only)
npx prisma migrate reset --force

# Deploy pending migrations
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate
```

### 4. Rate Limiting Issues

#### Symptoms
- Legitimate users getting rate limited
- Rate limiting not working (attackers getting through)
- "Too many requests" errors

#### Diagnosis
```bash
# Check Redis connection (if using Redis)
redis-cli ping

# Check rate limiting configuration
node -e "
const { checkRateLimit, loginLimiterEmail } = require('./lib/auth/rates');
console.log('Rate limiter configuration:', loginLimiterEmail);
"

# Test rate limiting
for i in {1..10}; do
  curl -X POST localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "Status: %{http_code}\n" -s -o /dev/null
  sleep 1
done
```

#### Solutions

**Redis Connection Issues:**
```bash
# Check Redis connectivity
redis-cli -h localhost -p 6379 ping

# Test Redis authentication (if enabled)
redis-cli -h localhost -p 6379 -a $REDIS_PASSWORD ping

# Check Redis memory usage
redis-cli info memory
```

**Rate Limiting Configuration:**
```typescript
// lib/auth/rates.ts - Adjust rate limits
export const rateLimits = {
  loginEmail: {
    points: 10,        // Increase from 5 to 10 for less strict limiting
    duration: 60,      // Keep 1 minute window
    blockDuration: 300 // Reduce from 900 to 300 (5 minutes)
  }
};

// Add more granular rate limiting
export const registerLimiterEmail = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'register_email',
  points: 5,           // 5 registration attempts
  duration: 86400,     // per day
  blockDuration: 3600, // 1 hour block
  execEvenly: true,    // Spread requests evenly
});
```

### 5. Session Management Issues

#### Symptoms
- Users randomly logged out
- "Invalid session" errors
- Refresh token rotation not working

#### Diagnosis
```bash
# Check session in database
psql $DATABASE_URL -c "
SELECT
  s.id,
  s.user_id,
  s.expires_at,
  s.revoked_at,
  COUNT(rt.id) as refresh_token_count
FROM sessions s
LEFT JOIN refresh_tokens rt ON s.id = rt.session_id
WHERE s.created_at > NOW() - INTERVAL '1 day'
GROUP BY s.id
ORDER BY s.created_at DESC
LIMIT 10;
"

# Check refresh token status
psql $DATABASE_URL -c "
SELECT
  token_family,
  COUNT(*) as total_tokens,
  COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked_tokens,
  COUNT(CASE WHEN rotated_at IS NOT NULL THEN 1 END) as rotated_tokens,
  MAX(created_at) as latest_token
FROM refresh_tokens
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY token_family
ORDER BY latest_token DESC
LIMIT 10;
"
```

#### Solutions

**Session Cleanup:**
```typescript
// Add session cleanup job
// lib/auth/maintenance.ts
export async function cleanupExpiredSessions() {
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
      expiresAt: { lt: new Date() }
    },
    data: { revokedAt: new Date() }
  });

  console.log('Session cleanup completed');
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
```

**Token Reuse Investigation:**
```sql
-- Check for suspicious token reuse patterns
SELECT
  rt.user_id,
  rt.token_family,
  rt.rotated_at,
  rt.reused_at,
  s.ip,
  al.created_at as event_time
FROM refresh_tokens rt
JOIN sessions s ON rt.session_id = s.id
LEFT JOIN audit_logs al ON al.user_id = rt.user_id
  AND al.action = 'token_reuse'
WHERE rt.reused_at IS NOT NULL
  AND rt.created_at > NOW() - INTERVAL '24 hours'
ORDER BY rt.reused_at DESC;
```

### 6. Performance Issues

#### Symptoms
- Slow authentication responses
- High database CPU usage
- Memory leaks in Node.js process

#### Diagnosis
```bash
# Check Node.js memory usage
node -e "
console.log('Memory usage:');
console.log(process.memoryUsage());
"

# Monitor database performance
psql $DATABASE_URL -c "
SELECT
  schemaname,
  tablename,
  n_tup_ins + n_tup_upd + n_tup_del as writes,
  seq_scan + idx_scan as reads,
  seq_scan / (seq_scan + idx_scan + 1) * 100 as seq_scan_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY writes + reads DESC;
"

# Check slow queries
psql $DATABASE_URL -c "
SELECT
  query,
  calls,
  total_time,
  mean_time,
  min_time,
  max_time
FROM pg_stat_statements
WHERE query ILIKE '%users%' OR query ILIKE '%sessions%'
ORDER BY mean_time DESC
LIMIT 10;
"
```

#### Solutions

**Database Optimization:**
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified
ON users(email) WHERE email_verified_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_active
ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_lookup
ON refresh_tokens(token_hash, expires_at) WHERE revoked_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_time
ON audit_logs(user_id, created_at);

-- Analyze table statistics
ANALYZE users, sessions, refresh_tokens, audit_logs;
```

**Connection Pool Optimization:**
```typescript
// lib/prisma.ts - Optimize for production
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=20&pool_timeout=20&connect_timeout=60'
    }
  },
  log: process.env.NODE_ENV === 'development' ?
    ['query', 'error', 'warn'] :
    ['error']
});

// Add connection pool monitoring
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

**Memory Optimization:**
```typescript
// lib/auth/session.ts - Optimize queries
export async function findActiveSession(sessionId: string) {
  return prisma.session.findFirst({
    where: {
      id: sessionId,
      expiresAt: { gt: new Date() },
      revokedAt: null
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      // Don't select unnecessary fields
    }
  });
}
```

## Maintenance Tasks

### Daily Maintenance
```bash
#!/bin/bash
# daily-maintenance.sh

echo "Starting daily maintenance..."

# 1. Clean up expired sessions
node -e "require('./lib/auth/maintenance').cleanupExpiredSessions()"

# 2. Check system health
curl -f localhost:3000/api/health/db || echo "Database health check failed"
curl -f localhost:3000/api/health/redis || echo "Redis health check failed"

# 3. Check for suspicious activity
psql $DATABASE_URL -c "
SELECT COUNT(*) as failed_logins_last_24h
FROM login_attempts
WHERE outcome = 'invalid_credentials'
AND created_at > NOW() - INTERVAL '24 hours';"

# 4. Rotate logs
find logs/ -name "*.log" -mtime +7 -delete

echo "Daily maintenance completed"
```

### Weekly Maintenance
```bash
#!/bin/bash
# weekly-maintenance.sh

echo "Starting weekly maintenance..."

# 1. Database maintenance
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# 2. Check database size and growth
psql $DATABASE_URL -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::text)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::text) DESC;
"

# 3. Security audit
node scripts/security-audit.js

# 4. Performance monitoring
node scripts/performance-check.js

echo "Weekly maintenance completed"
```

### Monthly Maintenance
```bash
#!/bin/bash
# monthly-maintenance.sh

echo "Starting monthly maintenance..."

# 1. Archive old audit logs (older than 90 days)
psql $DATABASE_URL -c "
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';
"

# 2. Archive old login attempts (older than 30 days)
psql $DATABASE_URL -c "
DELETE FROM login_attempts
WHERE created_at < NOW() - INTERVAL '30 days';
"

# 3. Clean up old email action tokens
psql $DATABASE_URL -c "
DELETE FROM email_action_tokens
WHERE (expires_at < NOW() OR consumed_at IS NOT NULL)
AND created_at < NOW() - INTERVAL '7 days';
"

# 4. Generate security report
node scripts/monthly-security-report.js

# 5. Check for dependency updates
npm audit
npm outdated

echo "Monthly maintenance completed"
```

## Security Incident Response

### Suspected Token Reuse Attack
```bash
# 1. Immediate investigation
psql $DATABASE_URL -c "
SELECT
  rt.user_id,
  rt.token_family,
  rt.reused_at,
  s.ip,
  u.email
FROM refresh_tokens rt
JOIN sessions s ON rt.session_id = s.id
JOIN users u ON rt.user_id = u.id
WHERE rt.reused_at > NOW() - INTERVAL '1 hour'
ORDER BY rt.reused_at DESC;
"

# 2. Check for patterns
psql $DATABASE_URL -c "
SELECT
  ip,
  COUNT(*) as reuse_events,
  COUNT(DISTINCT user_id) as affected_users
FROM (
  SELECT DISTINCT rt.user_id, s.ip
  FROM refresh_tokens rt
  JOIN sessions s ON rt.session_id = s.id
  WHERE rt.reused_at > NOW() - INTERVAL '24 hours'
) sub
GROUP BY ip
HAVING COUNT(*) > 1
ORDER BY reuse_events DESC;
"

# 3. Immediate response actions
# - Alert security team
# - Consider blocking suspicious IPs
# - Force password reset for affected users (if needed)
```

### Brute Force Attack Response
```bash
# 1. Identify attack source
psql $DATABASE_URL -c "
SELECT
  ip,
  email,
  COUNT(*) as attempts,
  MIN(created_at) as first_attempt,
  MAX(created_at) as last_attempt
FROM login_attempts
WHERE outcome = 'invalid_credentials'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip, email
HAVING COUNT(*) > 10
ORDER BY attempts DESC;
"

# 2. Check rate limiting effectiveness
redis-cli --scan --pattern "rl:login*" | xargs redis-cli mget

# 3. Block persistent attackers (if needed)
# Add to firewall or application-level blocking
```

### Email Provider Issues
```bash
# 1. Switch to backup email provider
# Update environment variable
export EMAIL_PROVIDER="backup_provider"

# 2. Check bounce rates
# Query email provider APIs for bounce/complaint rates

# 3. Verify DNS settings
dig TXT your-domain.com | grep -E "(spf|dkim|dmarc)"
```

## Monitoring & Alerting Setup

### Key Metrics to Monitor
```typescript
// metrics-config.ts
export const criticalMetrics = {
  // Authentication metrics
  'auth_login_success_rate': { threshold: 0.95, condition: 'below' },
  'auth_login_response_time_p95': { threshold: 1000, condition: 'above' }, // 1 second
  'auth_token_reuse_total': { threshold: 0, condition: 'above' }, // Any reuse is critical

  // System health metrics
  'database_connection_pool_usage': { threshold: 0.8, condition: 'above' },
  'memory_usage_percentage': { threshold: 0.85, condition: 'above' },
  'api_error_rate': { threshold: 0.05, condition: 'above' }, // 5%

  // Security metrics
  'rate_limit_violations_per_hour': { threshold: 100, condition: 'above' },
  'failed_login_attempts_per_hour': { threshold: 1000, condition: 'above' },
  'suspicious_activity_events': { threshold: 0, condition: 'above' }
};
```

### Health Check Endpoints
```typescript
// app/api/health/auth/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabaseHealth(),
    redis: await checkRedisHealth(),
    email: await checkEmailProviderHealth(),
    jwt: await checkJWTConfiguration(),
    rateLimit: await checkRateLimitingHealth()
  };

  const allHealthy = Object.values(checks).every(check => check.status === 'healthy');

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  }, {
    status: allHealthy ? 200 : 503
  });
}
```

### Log Analysis Queries
```bash
# Find authentication patterns
grep "auth_event" logs/app.log | jq -r '.action' | sort | uniq -c | sort -nr

# Analyze error patterns
grep "ERROR" logs/app.log | jq -r '.message' | sort | uniq -c | sort -nr

# Check for security events
grep -E "(token_reuse|brute_force|suspicious)" logs/app.log | jq '.'

# Performance analysis
grep "auth.*duration" logs/app.log | jq -r '.duration' | awk '{sum+=$1; count++} END {print "Average:", sum/count "ms"}'
```

## Recovery Procedures

### Database Recovery
```bash
# 1. Point-in-time recovery (PostgreSQL)
pg_restore --clean --create --if-exists \
  --dbname=artistmgmt_recovery \
  backup_file.dump

# 2. Migrate recovered database to latest schema
DATABASE_URL="postgresql://...recovery..." npx prisma migrate deploy

# 3. Verify data integrity
psql $DATABASE_URL -c "
SELECT
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT
  'sessions' as table_name, COUNT(*) as count FROM sessions
UNION ALL
SELECT
  'refresh_tokens' as table_name, COUNT(*) as count FROM refresh_tokens;
"
```

### Security Incident Recovery
```bash
# 1. Revoke all active sessions
psql $DATABASE_URL -c "
UPDATE sessions
SET revoked_at = NOW()
WHERE revoked_at IS NULL;
"

# 2. Revoke all refresh tokens
psql $DATABASE_URL -c "
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE revoked_at IS NULL;
"

# 3. Force all users to re-authenticate
# Users will need to log in again with their passwords

# 4. Rotate JWT secrets
# Generate new JWT keys and update environment variables
openssl ecparam -genkey -name prime256v1 -noout -out jwt_private_new.key
openssl ec -in jwt_private_new.key -pubout -out jwt_public_new.key
```

### Configuration Recovery
```bash
# 1. Restore from known good configuration
cp config/production.env.backup .env.local

# 2. Validate configuration
node scripts/validate-config.js

# 3. Test authentication flow
npm run test:auth-flow

# 4. Deploy with health checks
npm run build && npm run start
```

This troubleshooting and maintenance guide covers the most common issues and provides systematic approaches to diagnosing and resolving problems with the authentication system.