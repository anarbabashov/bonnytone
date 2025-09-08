import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessJwt } from '@/lib/auth/jwt'
import { prisma } from '@/lib/prisma'
import { validateCSRFResistance, addSecurityHeaders } from '@/lib/auth/csrf'

export interface AuthContext {
  userId: string
  sessionId: string
  user?: {
    id: string
    email: string
    displayName?: string
    emailVerifiedAt?: Date | null
    isBlocked: boolean
    mfaEnabled: boolean
  }
}

export interface AuthGuardResult {
  success: boolean
  response?: NextResponse
  context?: AuthContext
}

/**
 * Auth guard utility for API routes
 * Verifies access JWT and attaches userId, sessionId to context
 */
export async function authGuard(
  request: NextRequest,
  options: {
    requireEmailVerified?: boolean
    requireNotBlocked?: boolean
    includeUserData?: boolean
  } = {}
): Promise<AuthGuardResult> {
  try {
    // Validate CSRF resistance
    const csrfValidation = validateCSRFResistance(request)
    if (!csrfValidation.valid) {
      const response = NextResponse.json(
        { error: csrfValidation.reason || 'Invalid request format' },
        { status: 400 }
      )
      addSecurityHeaders(response.headers)
      return {
        success: false,
        response,
      }
    }

    // Extract access token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response = NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
      addSecurityHeaders(response.headers)
      return {
        success: false,
        response,
      }
    }

    const accessToken = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify access JWT
    const tokenPayload = await verifyAccessJwt(accessToken)
    if (!tokenPayload) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid or expired access token' },
          { status: 401 }
        ),
      }
    }

    // Extract context from JWT payload
    const context: AuthContext = {
      userId: tokenPayload.sub,
      sessionId: tokenPayload.sid,
    }

    // Optionally include user data
    if (options.includeUserData || options.requireEmailVerified || options.requireNotBlocked) {
      const user = await prisma.user.findUnique({
        where: { id: context.userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          emailVerifiedAt: true,
          isBlocked: true,
          mfaEnabled: true,
        },
      })

      if (!user) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          ),
        }
      }

      // Check if user is blocked
      if (options.requireNotBlocked && user.isBlocked) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Account is blocked' },
            { status: 403 }
          ),
        }
      }

      // Check if email verification is required
      if (options.requireEmailVerified && !user.emailVerifiedAt) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Email verification required' },
            { status: 403 }
          ),
        }
      }

      context.user = {
        ...user,
        displayName: user.displayName || undefined,
      }
    }

    return {
      success: true,
      context,
    }
  } catch (error) {
    console.error('Auth guard error:', error)
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      ),
    }
  }
}

/**
 * Higher-order function to wrap API route handlers with auth guard
 */
export function withAuth(
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>,
  options: {
    requireEmailVerified?: boolean
    requireNotBlocked?: boolean
    includeUserData?: boolean
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const guardResult = await authGuard(request, options)
    
    if (!guardResult.success || !guardResult.context) {
      return guardResult.response!
    }

    return handler(request, guardResult.context)
  }
}

/**
 * Middleware to validate JSON content-type and size limits
 */
export function validateJsonRequest(request: NextRequest): NextResponse | null {
  // Check Content-Type for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      )
    }

    // Check Content-Length (>1MB = 1048576 bytes)
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 1048576) {
      return NextResponse.json(
        { error: 'Request body too large (max 1MB)' },
        { status: 413 }
      )
    }
  }

  return null // No validation error
}

/**
 * Complete request guard that validates JSON and auth
 */
export async function apiGuard(
  request: NextRequest,
  authOptions: {
    requireAuth?: boolean
    requireEmailVerified?: boolean
    requireNotBlocked?: boolean
    includeUserData?: boolean
  } = {}
): Promise<{ success: boolean; response?: NextResponse; context?: AuthContext }> {
  // Validate JSON request format
  const jsonValidation = validateJsonRequest(request)
  if (jsonValidation) {
    return {
      success: false,
      response: jsonValidation,
    }
  }

  // Skip auth guard if not required
  if (!authOptions.requireAuth) {
    return { success: true }
  }

  // Apply auth guard
  return authGuard(request, authOptions)
}