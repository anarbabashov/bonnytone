# Auth Observability System

Comprehensive observability for authentication and security events with audit logging, metrics emission, and alerting.

## Architecture

### Core Components

1. **Audit Logging** (`/lib/observability/index.ts`)
   - Stores all auth events in database
   - Provides searchable security metrics
   - Real-time alert condition checking

2. **Metrics Collection** (`/lib/observability/metrics.ts`)
   - Prometheus-style metrics with proper labeling
   - Counter, gauge, and histogram support
   - JSON and Prometheus format export

3. **Alerting System** (`/lib/observability/alerts.ts`)
   - Rule-based security event detection
   - Configurable thresholds and cooldowns
   - Multi-channel alerting (webhook, email, log)

4. **Monitoring API** (`/app/api/monitoring/`)
   - `/metrics` - Prometheus scraping endpoint
   - `/alerts` - Active alerts and testing
   - `/health` - System health checks

## Tracked Events

### Authentication Events
- `login_success` / `login_failed`
- `register_success` / `register_failed` 
- `logout`
- `token_refresh` / `token_reuse`
- `password_reset_request` / `password_reset_complete`
- `email_verify_request` / `email_verify_complete`
- `email_change_request` / `email_change_complete`

### Security Events  
- `mfa_setup` / `mfa_disable`
- `session_revoked`
- `password_rehashed`
- `account_blocked` / `account_unblocked`
- `security_alert`

## Emitted Metrics

### Core Auth Metrics
```
auth_login_success_total{method="password", user_type="user"}
auth_login_fail_total{reason="invalid_credentials", method="password"}
auth_token_reuse_total{session_id="xxx", user_id="xxx"}
auth_email_sent_total{template="verify_email", provider="postmark"}
auth_register_success_total{method="email"}
auth_register_fail_total{reason="email_exists"}
auth_password_reset_total{stage="request"}
auth_email_verify_total{stage="complete"}
auth_mfa_events_total{event_type="setup"}
auth_session_events_total{event_type="created"}
auth_http_responses_total{status_code="401", endpoint="/api/auth/login"}
auth_rate_limit_hits_total{limiter_type="login", key_type="email"}
```

### Operational Metrics
```
auth_active_sessions_count{user_type="user"}
auth_request_duration_seconds{endpoint="/api/auth/login", method="POST"}
```

## Security Alerts

### Built-in Alert Rules

1. **High Login Failure Rate** (High Severity)
   - Trigger: >50 failed logins/minute
   - Actions: Webhook + Log

2. **Token Reuse Detected** (Critical Severity)
   - Trigger: Any refresh token reuse
   - Actions: Webhook + Email + Log

3. **High 401 Response Rate** (Medium Severity)
   - Trigger: >100 unauthorized responses/minute
   - Actions: Webhook + Log

4. **High 429 Response Rate** (Medium Severity)
   - Trigger: >20 rate limit hits/minute
   - Actions: Webhook + Log

5. **Suspicious Registration Pattern** (Medium Severity)
   - Trigger: >20 failed registrations/5min
   - Actions: Webhook + Log

6. **MFA Bypass Attempts** (High Severity)
   - Trigger: >15 MFA failures/5min
   - Actions: Webhook + Log

### Alert Configuration
```typescript
// Environment variables for alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx
SECURITY_EMAIL=security@company.com
EMAIL_FROM=alerts@company.com
```

## Usage Examples

### Basic Event Logging
```typescript
import { logAuthEvent } from '@/lib/observability'

// Log successful login
await logAuthEvent('login_success', userId, sessionId, ip, {
  email: user.email,
  method: 'password'
})

// Log security violation
await logAuthEvent('token_reuse', userId, sessionId, ip, {
  tokenFamily: 'family_123',
  severity: 'critical'
})
```

### Metrics Emission
```typescript
import { authMetrics } from '@/lib/observability/metrics'

// Simple counters
authMetrics.loginSuccess('password', 'user')
authMetrics.loginFailed('invalid_credentials')
authMetrics.tokenReuse(sessionId, userId)

// HTTP response tracking
authMetrics.httpResponse(401, '/api/auth/login')
authMetrics.rateLimitHit('login', 'email')

// Timing requests
import { timeAuthRequest } from '@/lib/observability/metrics'

export async function POST(request: NextRequest) {
  return timeAuthRequest('/api/auth/login', 'POST', async () => {
    // Your endpoint logic here
    return NextResponse.json({ success: true })
  })
}
```

### Alert Testing
```typescript
import { alerting } from '@/lib/observability/alerts'

// Test an alert rule
const alert = await alerting.testAlert('high_login_failure_rate')
console.log('Test alert triggered:', alert)
```

## Monitoring Setup

### Prometheus Integration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'artist-manager-auth'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/monitoring/metrics'
    scrape_interval: 30s
```

### Grafana Dashboard
Key metrics to monitor:
- Login success/failure rates
- Token reuse incidents
- HTTP error rates (401, 429)
- Session activity
- Email delivery metrics
- Active user sessions

### Alert Channels

#### Slack Integration
```bash
# Set webhook URL
export ALERT_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
```

#### Email Alerts
Uses existing email service for critical security notifications.

#### Custom Webhooks
Alerts sent as JSON payloads:
```json
{
  "alert_id": "alert_123",
  "rule_name": "high_login_failure_rate",
  "severity": "high", 
  "message": "Unusually high number of failed login attempts",
  "triggered_at": "2024-01-15T10:30:00Z",
  "metadata": {
    "condition": { /* alert condition */ },
    "actions": ["webhook", "log"]
  }
}
```

## Database Schema

Events stored in `audit_logs` table:
```sql
CREATE TABLE audit_logs (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  user_id     TEXT,
  session_id  TEXT,
  ip_address  TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  timestamp   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
```

## Production Deployment

### Required Environment Variables
```bash
# Alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx
SECURITY_EMAIL=security@company.com

# Metrics export (optional)
METRICS_AUTH_TOKEN=your-secret-token

# Redis for rate limiting (already configured)
REDIS_URL=redis://localhost:6379
```

### Performance Considerations

1. **Async Processing**: All observability calls are non-blocking
2. **Batched Metrics**: Metrics are buffered and flushed periodically
3. **Alert Cooldowns**: Prevents spam from repeated violations
4. **Database Indexing**: Optimized queries for time-series data
5. **Error Resilience**: Observability failures don't break auth flows

### Monitoring the Monitor

- Health check endpoint monitors database and Redis connectivity
- Self-monitoring of alert system performance
- Graceful degradation when external services unavailable
- Comprehensive error logging for troubleshooting

## Security Implications

- **No PII in Metrics**: Only aggregated counters, no personal data
- **Secure Token Handling**: Tokens hashed before storage
- **Access Control**: Metrics endpoints require authentication
- **Alert Rate Limiting**: Prevents DoS via alert spam
- **Audit Trail**: Complete history of all security events