// Optional observability utilities
export interface LogContext {
  userId?: string
  sessionId?: string
  ip?: string
  userAgent?: string
  action?: string
  [key: string]: any
}

// Simple logger (you can replace with pino or another logging library)
export class Logger {
  private context: LogContext

  constructor(context: LogContext = {}) {
    this.context = context
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString()
    const contextStr = Object.keys(this.context).length > 0 
      ? ` [${JSON.stringify(this.context)}]` 
      : ''
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    
    return `[${timestamp}] ${level.toUpperCase()}${contextStr}: ${message}${metaStr}`
  }

  info(message: string, meta?: any): void {
    console.log(this.formatMessage('info', message, meta))
  }

  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage('warn', message, meta))
  }

  error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta = error instanceof Error 
      ? { error: error.message, stack: error.stack, ...meta }
      : { error, ...meta }
    
    console.error(this.formatMessage('error', message, errorMeta))
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, meta))
    }
  }

  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context })
  }
}

// Default logger instance
export const logger = new Logger()

// Create audit log entry
export async function createAuditLog(
  action: string,
  actor: string,
  meta?: any,
  userId?: string
): Promise<void> {
  try {
    const { prisma } = await import('./prisma')
    
    await prisma.auditLog.create({
      data: {
        action,
        actor,
        meta: meta ? JSON.parse(JSON.stringify(meta)) : null,
        userId,
      },
    })
  } catch (error) {
    logger.error('Failed to create audit log', error, { action, actor, userId })
  }
}

// Helper function to log authentication events
export function logAuthEvent(
  event: string,
  userId?: string,
  sessionId?: string,
  ip?: string,
  meta?: any
): void {
  const context: LogContext = {
    action: event,
    userId,
    sessionId,
    ip,
  }

  const loggerWithContext = logger.child(context)
  loggerWithContext.info(`Auth event: ${event}`, meta)

  // Create audit log
  if (userId || event.includes('failed')) {
    createAuditLog(
      `auth.${event}`,
      userId ? `user:${userId}` : 'system',
      { ip, ...meta },
      userId
    ).catch(() => {}) // Don't let audit log failures break auth flow
  }
}