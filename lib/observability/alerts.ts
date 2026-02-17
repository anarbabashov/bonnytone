/**
 * Security Alerting System
 * 
 * Monitors auth metrics and triggers alerts for security incidents.
 * Integrates with external services like Slack, PagerDuty, email, etc.
 */

import { prisma } from '@/lib/prisma'
import { metrics } from './metrics'

export interface AlertRule {
  name: string
  description: string
  condition: AlertCondition
  severity: 'low' | 'medium' | 'high' | 'critical'
  cooldownMinutes: number
  actions: AlertAction[]
}

export interface AlertCondition {
  type: 'threshold' | 'rate' | 'percentage'
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '=='
  value: number
  timeWindowMinutes: number
  labels?: Record<string, string>
}

export interface AlertAction {
  type: 'webhook' | 'email' | 'log'
  config: Record<string, any>
}

export interface Alert {
  id: string
  ruleName: string
  severity: string
  message: string
  triggeredAt: Date
  resolvedAt?: Date
  metadata: Record<string, any>
}

class AlertingService {
  private alertRules: AlertRule[] = [
    {
      name: 'high_login_failure_rate',
      description: 'Unusually high number of failed login attempts',
      condition: {
        type: 'rate',
        metric: 'auth_login_fail_total',
        operator: '>',
        value: 50,
        timeWindowMinutes: 1,
      },
      severity: 'high',
      cooldownMinutes: 5,
      actions: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } },
        { type: 'log', config: {} },
      ],
    },
    {
      name: 'token_reuse_detected',
      description: 'Refresh token reuse attempts detected',
      condition: {
        type: 'threshold',
        metric: 'auth_token_reuse_total',
        operator: '>',
        value: 0,
        timeWindowMinutes: 1,
      },
      severity: 'critical',
      cooldownMinutes: 1,
      actions: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } },
        { type: 'email', config: { to: process.env.SECURITY_EMAIL } },
        { type: 'log', config: {} },
      ],
    },
    {
      name: 'high_401_response_rate',
      description: 'High rate of 401 Unauthorized responses',
      condition: {
        type: 'rate',
        metric: 'auth_http_responses_total',
        operator: '>',
        value: 100,
        timeWindowMinutes: 1,
        labels: { status_code: '401' },
      },
      severity: 'medium',
      cooldownMinutes: 5,
      actions: [
        { type: 'log', config: {} },
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } },
      ],
    },
    {
      name: 'high_429_response_rate',
      description: 'High rate of 429 Rate Limited responses',
      condition: {
        type: 'rate',
        metric: 'auth_http_responses_total',
        operator: '>',
        value: 20,
        timeWindowMinutes: 1,
        labels: { status_code: '429' },
      },
      severity: 'medium',
      cooldownMinutes: 10,
      actions: [
        { type: 'log', config: {} },
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } },
      ],
    },
    {
      name: 'suspicious_registration_pattern',
      description: 'Unusual spike in failed registrations',
      condition: {
        type: 'rate',
        metric: 'auth_register_fail_total',
        operator: '>',
        value: 20,
        timeWindowMinutes: 5,
      },
      severity: 'medium',
      cooldownMinutes: 15,
      actions: [
        { type: 'log', config: {} },
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } },
      ],
    },
    {
      name: 'session_anomaly',
      description: 'Unusual number of session revocations',
      condition: {
        type: 'rate',
        metric: 'auth_session_events_total',
        operator: '>',
        value: 10,
        timeWindowMinutes: 5,
        labels: { event_type: 'revoked' },
      },
      severity: 'low',
      cooldownMinutes: 30,
      actions: [
        { type: 'log', config: {} },
      ],
    },
    {
      name: 'mfa_bypass_attempts',
      description: 'Multiple MFA verification failures',
      condition: {
        type: 'rate',
        metric: 'auth_mfa_events_total',
        operator: '>',
        value: 15,
        timeWindowMinutes: 5,
        labels: { event_type: 'verify_fail' },
      },
      severity: 'high',
      cooldownMinutes: 10,
      actions: [
        { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } },
        { type: 'log', config: {} },
      ],
    },
  ]

  private activeAlerts = new Map<string, Date>()

  async checkAlerts(): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = []

    for (const rule of this.alertRules) {
      try {
        const isTriggered = await this.evaluateCondition(rule.condition)
        
        if (isTriggered && this.canTriggerAlert(rule)) {
          const alert = await this.triggerAlert(rule)
          triggeredAlerts.push(alert)
        }
      } catch (error) {
        console.error(`Failed to evaluate alert rule ${rule.name}:`, error)
      }
    }

    return triggeredAlerts
  }

  private async evaluateCondition(condition: AlertCondition): Promise<boolean> {
    try {
      const now = new Date()
      const windowStart = new Date(now.getTime() - condition.timeWindowMinutes * 60 * 1000)

      switch (condition.type) {
        case 'threshold':
          return await this.evaluateThresholdCondition(condition, windowStart, now)
        case 'rate':
          return await this.evaluateRateCondition(condition, windowStart, now)
        case 'percentage':
          return await this.evaluatePercentageCondition(condition, windowStart, now)
        default:
          return false
      }
    } catch (error) {
      console.error('Failed to evaluate condition:', error)
      return false
    }
  }

  private async evaluateThresholdCondition(
    condition: AlertCondition,
    windowStart: Date,
    windowEnd: Date
  ): Promise<boolean> {
    // For database-based metrics, query audit logs
    const eventCount = await this.getMetricValueFromDB(
      condition.metric,
      windowStart,
      windowEnd,
      condition.labels
    )

    return this.compareValues(eventCount, condition.operator, condition.value)
  }

  private async evaluateRateCondition(
    condition: AlertCondition,
    windowStart: Date,
    windowEnd: Date
  ): Promise<boolean> {
    const eventCount = await this.getMetricValueFromDB(
      condition.metric,
      windowStart,
      windowEnd,
      condition.labels
    )

    // Calculate rate per minute
    const windowMinutes = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60)
    const rate = eventCount / windowMinutes

    return this.compareValues(rate, condition.operator, condition.value)
  }

  private async evaluatePercentageCondition(
    condition: AlertCondition,
    windowStart: Date,
    windowEnd: Date
  ): Promise<boolean> {
    // Implementation for percentage-based conditions
    // e.g., failed logins as percentage of total logins
    return false // Placeholder
  }

  private async getMetricValueFromDB(
    metricName: string,
    windowStart: Date,
    windowEnd: Date,
    labels?: Record<string, string>
  ): Promise<number> {
    // Map metric names to audit log event types
    const metricToEventMap: Record<string, string[]> = {
      'auth_login_fail_total': ['login_failed'],
      'auth_token_reuse_total': ['token_reuse'],
      'auth_http_responses_total': ['login_failed', 'login_success'], // Approximate
      'auth_register_fail_total': ['register_failed'],
      'auth_session_events_total': ['session_revoked'],
      'auth_mfa_events_total': ['login_failed'], // With MFA context
    }

    const eventTypes = metricToEventMap[metricName]
    if (!eventTypes) {
      return 0
    }

    const whereClause: any = {
      action: { in: eventTypes },
      createdAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    }

    // Add label filtering based on metadata
    if (labels) {
      if (labels.status_code) {
        whereClause.meta = {
          path: ['httpStatus'],
          equals: parseInt(labels.status_code),
        }
      }
      if (labels.event_type) {
        whereClause.meta = {
          path: ['reason'],
          equals: labels.event_type,
        }
      }
    }

    const count = await prisma.auditLog.count({ where: whereClause })
    return count
  }

  private compareValues(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case '>': return actual > expected
      case '<': return actual < expected
      case '>=': return actual >= expected
      case '<=': return actual <= expected
      case '==': return actual === expected
      default: return false
    }
  }

  private canTriggerAlert(rule: AlertRule): boolean {
    const lastTriggered = this.activeAlerts.get(rule.name)
    if (!lastTriggered) {
      return true
    }

    const cooldownMs = rule.cooldownMinutes * 60 * 1000
    const timeSinceLastTrigger = Date.now() - lastTriggered.getTime()
    
    return timeSinceLastTrigger >= cooldownMs
  }

  private async triggerAlert(rule: AlertRule): Promise<Alert> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleName: rule.name,
      severity: rule.severity,
      message: `Security Alert: ${rule.description}`,
      triggeredAt: new Date(),
      metadata: {
        condition: rule.condition,
        actions: rule.actions.map(a => a.type),
      },
    }

    // Record in database
    try {
      await prisma.auditLog.create({
        data: {
          action: 'security_alert',
          actor: 'system',
          meta: {
            alertId: alert.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: alert.message,
          },
        },
      })
    } catch (error) {
      console.error('Failed to record alert in database:', error)
    }

    // Execute alert actions
    for (const action of rule.actions) {
      try {
        await this.executeAlertAction(action, alert)
      } catch (error) {
        console.error(`Failed to execute alert action ${action.type}:`, error)
      }
    }

    // Update cooldown
    this.activeAlerts.set(rule.name, alert.triggeredAt)

    return alert
  }

  private async executeAlertAction(action: AlertAction, alert: Alert): Promise<void> {
    switch (action.type) {
      case 'webhook':
        await this.sendWebhookAlert(action.config, alert)
        break
      case 'email':
        await this.sendEmailAlert(action.config, alert)
        break
      case 'log':
        this.logAlert(alert)
        break
    }
  }

  private async sendWebhookAlert(config: any, alert: Alert): Promise<void> {
    if (!config.url) {
      return
    }

    const payload = {
      alert_id: alert.id,
      rule_name: alert.ruleName,
      severity: alert.severity,
      message: alert.message,
      triggered_at: alert.triggeredAt.toISOString(),
      metadata: alert.metadata,
    }

    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BonnyToneRadio-SecurityAlerts/1.0',
      },
      body: JSON.stringify(payload),
    })
  }

  private async sendEmailAlert(config: any, alert: Alert): Promise<void> {
    if (!config.to || !process.env.EMAIL_FROM) {
      return
    }

    // Use existing email service
    const { sendEmail } = await import('@/lib/auth/email')
    
    await sendEmail('login_alert', config.to, {
      alertId: alert.id,
      ruleName: alert.ruleName,
      severity: alert.severity,
      message: alert.message,
      triggeredAt: alert.triggeredAt.toISOString(),
    })
  }

  private logAlert(alert: Alert): void {
    const severityEmoji: Record<string, string> = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    }

    console.warn(
      `${severityEmoji[alert.severity] || '⚠️'} [SECURITY ALERT] ${alert.ruleName}: ${alert.message}`,
      {
        alertId: alert.id,
        severity: alert.severity,
        triggeredAt: alert.triggeredAt.toISOString(),
        metadata: alert.metadata,
      }
    )
  }

  // Get active alerts
  async getActiveAlerts(): Promise<Alert[]> {
    const alerts = await prisma.auditLog.findMany({
      where: {
        action: 'security_alert',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return alerts.map(log => ({
      id: (log.meta as any)?.alertId as string || log.id,
      ruleName: (log.meta as any)?.ruleName as string || 'unknown',
      severity: (log.meta as any)?.severity as string || 'low',
      message: (log.meta as any)?.message as string || 'Security alert triggered',
      triggeredAt: log.createdAt,
      metadata: (log.meta as Record<string, any>) || {},
    }))
  }

  // Manual alert testing
  async testAlert(ruleName: string): Promise<Alert | null> {
    const rule = this.alertRules.find(r => r.name === ruleName)
    if (!rule) {
      throw new Error(`Alert rule ${ruleName} not found`)
    }

    return await this.triggerAlert({
      ...rule,
      name: `${rule.name}_test`,
      description: `Test alert: ${rule.description}`,
    })
  }
}

// Export singleton instance
export const alerting = new AlertingService()

// Background alert checking (run periodically)
export async function runAlertCheck(): Promise<void> {
  try {
    await alerting.checkAlerts()
  } catch (error) {
    console.error('Alert check failed:', error)
  }
}

// Start background alert monitoring
if (process.env.NODE_ENV === 'production') {
  setInterval(runAlertCheck, 60 * 1000) // Check every minute
}