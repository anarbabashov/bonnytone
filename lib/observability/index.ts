import { prisma } from '@/lib/prisma'

export interface AuthEvent {
  type: 'login_success' | 'login_failed' | 'register_success' | 'register_failed' |
        'logout' | 'token_refresh' | 'token_reuse' | 'password_reset_request' |
        'password_reset_complete' | 'email_verify_request' | 'email_verify_complete' |
        'email_change_request' | 'email_change_complete' | 'mfa_setup' | 'mfa_disable' |
        'session_revoked' | 'password_rehashed' | 'account_blocked' | 'account_unblocked'
  userId?: string
  sessionId?: string
  ip?: string
  userAgent?: string
  metadata?: Record<string, any>
  timestamp?: Date
}

export interface SecurityMetrics {
  auth_login_success_total: number
  auth_login_fail_total: number
  auth_token_reuse_total: number
  auth_email_sent_total: number
  auth_register_success_total: number
  auth_register_fail_total: number
  auth_password_reset_total: number
  auth_email_verify_total: number
  auth_mfa_setup_total: number
  auth_session_revoked_total: number
  auth_401_responses_total: number
  auth_429_responses_total: number
}

class ObservabilityService {
  private metricsBuffer: Map<keyof SecurityMetrics, number> = new Map()
  private alertThresholds = {
    login_failures_per_minute: 50,
    token_reuse_per_minute: 5,
    response_401_per_minute: 100,
    response_429_per_minute: 20,
  }

  async logAuthEvent(
    type: AuthEvent['type'],
    userId?: string,
    sessionId?: string,
    ip?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Store audit log in database
      await prisma.auditLog.create({
        data: {
          action: type,
          userId,
          actor: userId ? `user:${userId}` : 'system',
          meta: {
            sessionId,
            ipAddress: ip,
            ...metadata
          },
        },
      })

      // Emit metrics
      await this.emitMetric(type, metadata)

      // Check for alert conditions
      await this.checkAlertConditions(type, ip)

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUTH EVENT] ${type}`, {
          userId,
          sessionId,
          ip,
          metadata,
        })
      }
    } catch (error) {
      console.error('Failed to log auth event:', error)
      // Don't throw - observability failures shouldn't break auth flows
    }
  }

  async emitMetric(
    eventType: AuthEvent['type'],
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Map events to metrics
      const metricMap: Partial<Record<AuthEvent['type'], keyof SecurityMetrics>> = {
        login_success: 'auth_login_success_total',
        login_failed: 'auth_login_fail_total',
        token_reuse: 'auth_token_reuse_total',
        register_success: 'auth_register_success_total',
        register_failed: 'auth_register_fail_total',
        password_reset_request: 'auth_password_reset_total',
        email_verify_request: 'auth_email_verify_total',
        mfa_setup: 'auth_mfa_setup_total',
        session_revoked: 'auth_session_revoked_total',
      }

      const metricName = metricMap[eventType]
      if (metricName) {
        this.incrementMetric(metricName)
      }

      // Special handling for email sent metrics
      if (metadata?.emailType) {
        this.incrementMetric('auth_email_sent_total')
      }

      // HTTP response metrics (when available)
      if (metadata?.httpStatus === 401) {
        this.incrementMetric('auth_401_responses_total')
      }
      if (metadata?.httpStatus === 429) {
        this.incrementMetric('auth_429_responses_total')
      }

      // Flush metrics periodically (in production, use proper metrics backend)
      if (process.env.NODE_ENV === 'development') {
        this.flushMetricsToConsole()
      }
    } catch (error) {
      console.error('Failed to emit metric:', error)
    }
  }

  private incrementMetric(metricName: keyof SecurityMetrics): void {
    const current = this.metricsBuffer.get(metricName) || 0
    this.metricsBuffer.set(metricName, current + 1)
  }

  private flushMetricsToConsole(): void {
    if (this.metricsBuffer.size > 0) {
      console.log('[METRICS]', Object.fromEntries(this.metricsBuffer))
      this.metricsBuffer.clear()
    }
  }

  private async checkAlertConditions(
    eventType: AuthEvent['type'],
    ip?: string
  ): Promise<void> {
    try {
      const now = new Date()
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)

      // Check login failure spikes
      if (eventType === 'login_failed') {
        const recentFailures = await prisma.auditLog.count({
          where: {
            action: 'login_failed',
            createdAt: { gte: oneMinuteAgo },
          },
        })

        if (recentFailures >= this.alertThresholds.login_failures_per_minute) {
          await this.triggerAlert('HIGH_LOGIN_FAILURE_RATE', {
            count: recentFailures,
            threshold: this.alertThresholds.login_failures_per_minute,
            timeWindow: '1 minute',
          })
        }
      }

      // Check token reuse spikes
      if (eventType === 'token_reuse') {
        const recentReuse = await prisma.auditLog.count({
          where: {
            action: 'token_reuse',
            createdAt: { gte: oneMinuteAgo },
          },
        })

        if (recentReuse >= this.alertThresholds.token_reuse_per_minute) {
          await this.triggerAlert('HIGH_TOKEN_REUSE_RATE', {
            count: recentReuse,
            threshold: this.alertThresholds.token_reuse_per_minute,
            timeWindow: '1 minute',
          })
        }
      }

      // Check for suspicious IP patterns
      if (ip) {
        const ipEvents = await prisma.auditLog.count({
          where: {
            meta: { path: ['ipAddress'], equals: ip },
            action: { in: ['login_failed', 'register_failed'] },
            createdAt: { gte: oneMinuteAgo },
          },
        })

        if (ipEvents >= 20) {
          await this.triggerAlert('SUSPICIOUS_IP_ACTIVITY', {
            ip,
            count: ipEvents,
            timeWindow: '1 minute',
          })
        }
      }
    } catch (error) {
      console.error('Failed to check alert conditions:', error)
    }
  }

  private async triggerAlert(
    alertType: string,
    context: Record<string, any>
  ): Promise<void> {
    try {
      // Log alert
      console.warn(`[SECURITY ALERT] ${alertType}`, context)

      // Store alert in audit log
      await prisma.auditLog.create({
        data: {
          action: 'security_alert',
          actor: 'system',
          meta: { alertType, context },
        },
      })

      // In production, integrate with alerting service (PagerDuty, Slack, etc.)
      if (process.env.NODE_ENV === 'production') {
        await this.sendProductionAlert(alertType, context)
      }
    } catch (error) {
      console.error('Failed to trigger alert:', error)
    }
  }

  private async sendProductionAlert(
    alertType: string,
    context: Record<string, any>
  ): Promise<void> {
    // Integration with external alerting services
    // Example: Slack webhook, PagerDuty, email alerts, etc.
    
    const webhookUrl = process.env.ALERT_WEBHOOK_URL
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Security Alert: ${alertType}`,
            context,
            timestamp: new Date().toISOString(),
          }),
        })
      } catch (error) {
        console.error('Failed to send production alert:', error)
      }
    }
  }

  async getSecurityMetrics(timeRange: {
    from: Date
    to: Date
  }): Promise<{
    events: Array<{ eventType: string; count: number }>
    alerts: Array<{ alertType: string; count: number; lastOccurred: Date }>
    topIPs: Array<{ ip: string; eventCount: number }>
  }> {
    try {
      // Event counts by type
      const events = await prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          createdAt: {
            gte: timeRange.from,
            lte: timeRange.to,
          },
        },
        _count: { action: true },
      })

      // Security alerts
      const alertData = await prisma.auditLog.findMany({
        where: {
          action: 'security_alert',
          createdAt: {
            gte: timeRange.from,
            lte: timeRange.to,
          },
        },
        select: {
          meta: true,
          createdAt: true,
        },
      })

      // Process alerts
      const alertsMap = new Map<string, { count: number; lastOccurred: Date }>()
      alertData.forEach(alert => {
        const alertType = (alert.meta as any)?.alertType as string
        if (alertType) {
          const existing = alertsMap.get(alertType)
          alertsMap.set(alertType, {
            count: (existing?.count || 0) + 1,
            lastOccurred: existing 
              ? (alert.createdAt > existing.lastOccurred ? alert.createdAt : existing.lastOccurred)
              : alert.createdAt,
          })
        }
      })

      // Top IPs by event count
      // Note: IP data extraction from JSON meta is complex in Prisma, simplified for now
      const ipData: any[] = []

      return {
        events: events.map(e => ({
          eventType: e.action,
          count: e._count.action,
        })),
        alerts: Array.from(alertsMap.entries()).map(([alertType, data]) => ({
          alertType,
          count: data.count,
          lastOccurred: data.lastOccurred,
        })),
        topIPs: ipData,
      }
    } catch (error) {
      console.error('Failed to get security metrics:', error)
      throw error
    }
  }
}

// Export singleton instance
export const observability = new ObservabilityService()

// Convenience function for logging auth events
export const logAuthEvent = observability.logAuthEvent.bind(observability)

// Convenience function for emitting metrics
export const emitMetric = observability.emitMetric.bind(observability)

// Helper for logging HTTP response metrics
export function logHttpResponse(statusCode: number, eventType?: AuthEvent['type']): void {
  if (statusCode === 401 || statusCode === 429) {
    observability.logAuthEvent(eventType || 'login_failed', undefined, undefined, undefined, {
      httpStatus: statusCode,
    })
  }
}