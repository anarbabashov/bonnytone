/**
 * Metrics Collection System
 * 
 * Provides Prometheus-style metrics for auth events with proper labeling
 * and time-series data collection for monitoring and alerting.
 */

export interface MetricLabel {
  [key: string]: string
}

export interface TimestampedMetric {
  value: number
  timestamp: Date
  labels: MetricLabel
}

export interface MetricDefinition {
  name: string
  help: string
  type: 'counter' | 'gauge' | 'histogram'
  labels: string[]
}

class MetricsCollector {
  private counters = new Map<string, Map<string, number>>()
  private gauges = new Map<string, Map<string, number>>()
  private histograms = new Map<string, Map<string, number[]>>()
  
  private metricDefinitions: MetricDefinition[] = [
    {
      name: 'auth_login_success_total',
      help: 'Total successful login attempts',
      type: 'counter',
      labels: ['method', 'user_type'],
    },
    {
      name: 'auth_login_fail_total',
      help: 'Total failed login attempts',
      type: 'counter',
      labels: ['reason', 'method'],
    },
    {
      name: 'auth_token_reuse_total',
      help: 'Total refresh token reuse attempts (security violation)',
      type: 'counter',
      labels: ['session_id', 'user_id'],
    },
    {
      name: 'auth_email_sent_total',
      help: 'Total authentication emails sent',
      type: 'counter',
      labels: ['template', 'provider'],
    },
    {
      name: 'auth_register_success_total',
      help: 'Total successful user registrations',
      type: 'counter',
      labels: ['method'],
    },
    {
      name: 'auth_register_fail_total',
      help: 'Total failed registration attempts',
      type: 'counter',
      labels: ['reason'],
    },
    {
      name: 'auth_password_reset_total',
      help: 'Total password reset requests',
      type: 'counter',
      labels: ['stage'], // request, complete, expired
    },
    {
      name: 'auth_email_verify_total',
      help: 'Total email verification attempts',
      type: 'counter',
      labels: ['stage'], // request, complete, expired
    },
    {
      name: 'auth_mfa_events_total',
      help: 'Total MFA-related events',
      type: 'counter',
      labels: ['event_type'], // setup, disable, verify_success, verify_fail
    },
    {
      name: 'auth_session_events_total',
      help: 'Total session-related events',
      type: 'counter',
      labels: ['event_type'], // created, refreshed, revoked, expired
    },
    {
      name: 'auth_http_responses_total',
      help: 'Total HTTP responses by status code',
      type: 'counter',
      labels: ['status_code', 'endpoint'],
    },
    {
      name: 'auth_rate_limit_hits_total',
      help: 'Total rate limit violations',
      type: 'counter',
      labels: ['limiter_type', 'key_type'], // login_email, login_ip, etc.
    },
    {
      name: 'auth_active_sessions_count',
      help: 'Current number of active sessions',
      type: 'gauge',
      labels: ['user_type'],
    },
    {
      name: 'auth_request_duration_seconds',
      help: 'Auth request processing time in seconds',
      type: 'histogram',
      labels: ['endpoint', 'method'],
    },
  ]

  incrementCounter(
    metricName: string,
    labels: MetricLabel = {},
    value: number = 1
  ): void {
    const labelKey = this.createLabelKey(labels)
    
    if (!this.counters.has(metricName)) {
      this.counters.set(metricName, new Map())
    }
    
    const metricMap = this.counters.get(metricName)!
    const currentValue = metricMap.get(labelKey) || 0
    metricMap.set(labelKey, currentValue + value)
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[METRIC] ${metricName}{${this.formatLabels(labels)}} ${currentValue + value}`)
    }
  }

  setGauge(metricName: string, labels: MetricLabel = {}, value: number): void {
    const labelKey = this.createLabelKey(labels)
    
    if (!this.gauges.has(metricName)) {
      this.gauges.set(metricName, new Map())
    }
    
    this.gauges.get(metricName)!.set(labelKey, value)
  }

  observeHistogram(
    metricName: string,
    labels: MetricLabel = {},
    value: number
  ): void {
    const labelKey = this.createLabelKey(labels)
    
    if (!this.histograms.has(metricName)) {
      this.histograms.set(metricName, new Map())
    }
    
    const metricMap = this.histograms.get(metricName)!
    if (!metricMap.has(labelKey)) {
      metricMap.set(labelKey, [])
    }
    
    metricMap.get(labelKey)!.push(value)
    
    // Keep only recent observations (sliding window)
    const observations = metricMap.get(labelKey)!
    if (observations.length > 1000) {
      observations.splice(0, observations.length - 1000)
    }
  }

  private createLabelKey(labels: MetricLabel): string {
    const sortedEntries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))
    return JSON.stringify(sortedEntries)
  }

  private formatLabels(labels: MetricLabel): string {
    return Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(', ')
  }

  // Get metrics in Prometheus format
  getPrometheusMetrics(): string {
    const lines: string[] = []
    
    // Add metric definitions
    this.metricDefinitions.forEach(def => {
      lines.push(`# HELP ${def.name} ${def.help}`)
      lines.push(`# TYPE ${def.name} ${def.type}`)
    })
    
    // Add counter metrics
    Array.from(this.counters.entries()).forEach(([metricName, labelMap]) => {
      Array.from(labelMap.entries()).forEach(([labelKey, value]) => {
        const labels = JSON.parse(labelKey) as [string, string][]
        const labelStr = labels.length > 0 
          ? `{${labels.map(([k, v]) => `${k}="${v}"`).join(', ')}}` 
          : ''
        lines.push(`${metricName}${labelStr} ${value}`)
      })
    })
    
    // Add gauge metrics
    Array.from(this.gauges.entries()).forEach(([metricName, labelMap]) => {
      Array.from(labelMap.entries()).forEach(([labelKey, value]) => {
        const labels = JSON.parse(labelKey) as [string, string][]
        const labelStr = labels.length > 0 
          ? `{${labels.map(([k, v]) => `${k}="${v}"`).join(', ')}}` 
          : ''
        lines.push(`${metricName}${labelStr} ${value}`)
      })
    })
    
    // Add histogram metrics (simplified - just count and sum)
    Array.from(this.histograms.entries()).forEach(([metricName, labelMap]) => {
      Array.from(labelMap.entries()).forEach(([labelKey, values]) => {
        const labels = JSON.parse(labelKey) as [string, string][]
        const labelStr = labels.length > 0 
          ? `{${labels.map(([k, v]) => `${k}="${v}"`).join(', ')}}` 
          : ''
        
        const count = values.length
        const sum = values.reduce((a, b) => a + b, 0)
        
        lines.push(`${metricName}_count${labelStr} ${count}`)
        lines.push(`${metricName}_sum${labelStr} ${sum}`)
      })
    })
    
    return lines.join('\n') + '\n'
  }

  // Get JSON metrics for internal consumption
  getJSONMetrics(): {
    counters: Record<string, Record<string, number>>
    gauges: Record<string, Record<string, number>>
    histograms: Record<string, Record<string, { count: number; sum: number; avg: number }>>
  } {
    const result = {
      counters: {} as Record<string, Record<string, number>>,
      gauges: {} as Record<string, Record<string, number>>,
      histograms: {} as Record<string, Record<string, { count: number; sum: number; avg: number }>>,
    }
    
    // Convert counters
    Array.from(this.counters.entries()).forEach(([metricName, labelMap]) => {
      result.counters[metricName] = {}
      Array.from(labelMap.entries()).forEach(([labelKey, value]) => {
        result.counters[metricName][labelKey] = value
      })
    })
    
    // Convert gauges
    Array.from(this.gauges.entries()).forEach(([metricName, labelMap]) => {
      result.gauges[metricName] = {}
      Array.from(labelMap.entries()).forEach(([labelKey, value]) => {
        result.gauges[metricName][labelKey] = value
      })
    })
    
    // Convert histograms
    Array.from(this.histograms.entries()).forEach(([metricName, labelMap]) => {
      result.histograms[metricName] = {}
      Array.from(labelMap.entries()).forEach(([labelKey, values]) => {
        const count = values.length
        const sum = values.reduce((a, b) => a + b, 0)
        result.histograms[metricName][labelKey] = {
          count,
          sum,
          avg: count > 0 ? sum / count : 0,
        }
      })
    })
    
    return result
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
  }
}

// Export singleton instance
export const metrics = new MetricsCollector()

// Convenience functions for common auth metrics
export const authMetrics = {
  loginSuccess: (method = 'password', userType = 'user') => 
    metrics.incrementCounter('auth_login_success_total', { method, user_type: userType }),
    
  loginFailed: (reason: string, method = 'password') => 
    metrics.incrementCounter('auth_login_fail_total', { reason, method }),
    
  tokenReuse: (sessionId: string, userId: string) => 
    metrics.incrementCounter('auth_token_reuse_total', { session_id: sessionId, user_id: userId }),
    
  emailSent: (template: string, provider: string) => 
    metrics.incrementCounter('auth_email_sent_total', { template, provider }),
    
  registerSuccess: (method = 'email') => 
    metrics.incrementCounter('auth_register_success_total', { method }),
    
  registerFailed: (reason: string) => 
    metrics.incrementCounter('auth_register_fail_total', { reason }),
    
  passwordReset: (stage: 'request' | 'complete' | 'expired') => 
    metrics.incrementCounter('auth_password_reset_total', { stage }),
    
  emailVerify: (stage: 'request' | 'complete' | 'expired') => 
    metrics.incrementCounter('auth_email_verify_total', { stage }),
    
  mfaEvent: (eventType: 'setup' | 'disable' | 'verify_success' | 'verify_fail') => 
    metrics.incrementCounter('auth_mfa_events_total', { event_type: eventType }),
    
  sessionEvent: (eventType: 'created' | 'refreshed' | 'revoked' | 'expired') => 
    metrics.incrementCounter('auth_session_events_total', { event_type: eventType }),
    
  httpResponse: (statusCode: number, endpoint: string) => 
    metrics.incrementCounter('auth_http_responses_total', { 
      status_code: statusCode.toString(), 
      endpoint 
    }),
    
  rateLimitHit: (limiterType: string, keyType: string) => 
    metrics.incrementCounter('auth_rate_limit_hits_total', { 
      limiter_type: limiterType, 
      key_type: keyType 
    }),
    
  activeSessions: (count: number, userType = 'user') => 
    metrics.setGauge('auth_active_sessions_count', { user_type: userType }, count),
    
  requestDuration: (endpoint: string, method: string, durationSeconds: number) => 
    metrics.observeHistogram('auth_request_duration_seconds', { endpoint, method }, durationSeconds),
}

// Helper for timing auth requests
export function timeAuthRequest<T>(
  endpoint: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  
  return fn()
    .finally(() => {
      const duration = (Date.now() - start) / 1000
      authMetrics.requestDuration(endpoint, method, duration)
    })
}