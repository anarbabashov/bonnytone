import { NextRequest, NextResponse } from 'next/server'
import { authGuard, type AuthContext, type AuthGuardResult } from './guards'
import { parseStrictJSON, type ParseResult } from './parser'
import { addSecurityHeaders } from './csrf'

/**
 * Comprehensive middleware system for API route protection
 * 
 * Combines auth guards, CSRF protection, JSON parsing, and security headers
 * into a single, easy-to-use middleware function for API routes.
 */

export interface MiddlewareOptions {
  // Auth options
  requireAuth?: boolean
  requireEmailVerified?: boolean
  requireNotBlocked?: boolean
  includeUserData?: boolean
  
  // Parser options  
  requireJSON?: boolean
  maxBodySize?: number
  allowEmptyBody?: boolean
  
  // Security options
  addSecurityHeaders?: boolean
}

export interface MiddlewareResult<T = any> {
  success: boolean
  response?: NextResponse
  context?: AuthContext
  data?: T
  error?: string
}

/**
 * Main middleware function that combines all security features
 * @param request NextRequest object
 * @param options Configuration options
 * @returns MiddlewareResult with context and parsed data
 */
export async function withMiddleware<T = any>(
  request: NextRequest,
  options: MiddlewareOptions = {}
): Promise<MiddlewareResult<T>> {
  const {
    requireAuth = false,
    requireEmailVerified = false, 
    requireNotBlocked = true,
    includeUserData = false,
    requireJSON = true,
    maxBodySize = 1024 * 1024, // 1MB
    allowEmptyBody = request.method === 'GET' || request.method === 'DELETE',
    addSecurityHeaders: addHeaders = true
  } = options

  let authResult: AuthGuardResult | null = null
  let parseResult: ParseResult<T> | null = null

  try {
    // 1. Apply auth guard if required
    if (requireAuth) {
      authResult = await authGuard(request, {
        requireEmailVerified,
        requireNotBlocked,
        includeUserData
      })

      if (!authResult.success) {
        // Add security headers to auth failures
        if (addHeaders && authResult.response) {
          addSecurityHeaders(authResult.response.headers)
        }
        return {
          success: false,
          response: authResult.response,
          error: 'Authentication failed'
        }
      }
    }

    // 2. Parse JSON body if required
    if (requireJSON && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      parseResult = await parseStrictJSON<T>(request, {
        maxSizeBytes: maxBodySize,
        allowEmptyBody
      })

      if (!parseResult.success) {
        // Add security headers to parsing failures
        if (addHeaders && parseResult.response) {
          addSecurityHeaders(parseResult.response.headers)
        }
        return {
          success: false,
          response: parseResult.response,
          error: parseResult.error
        }
      }
    }

    // 3. Success - return combined context and data
    return {
      success: true,
      context: authResult?.context,
      data: parseResult?.data,
    }

  } catch (error) {
    const errorResponse = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )

    if (addHeaders) {
      addSecurityHeaders(errorResponse.headers)
    }

    return {
      success: false,
      response: errorResponse,
      error: error instanceof Error ? error.message : 'Unknown middleware error'
    }
  }
}

/**
 * Convenience wrapper for authenticated API routes
 * Automatically applies auth guard with common options
 */
export async function withAuth<T = any>(
  request: NextRequest,
  options: Omit<MiddlewareOptions, 'requireAuth'> & {
    requireEmailVerified?: boolean
    includeUserData?: boolean
  } = {}
): Promise<MiddlewareResult<T>> {
  return withMiddleware<T>(request, {
    ...options,
    requireAuth: true,
    requireEmailVerified: options.requireEmailVerified ?? false,
    includeUserData: options.includeUserData ?? true
  })
}

/**
 * Convenience wrapper for public API routes with JSON parsing
 * Provides CSRF protection and JSON validation without auth
 */
export async function withJSON<T = any>(
  request: NextRequest,
  options: Omit<MiddlewareOptions, 'requireAuth' | 'requireJSON'> = {}
): Promise<MiddlewareResult<T>> {
  return withMiddleware<T>(request, {
    ...options,
    requireAuth: false,
    requireJSON: true
  })
}

/**
 * Helper function to create standard error responses with security headers
 */
export function createSecureErrorResponse(
  message: string,
  status: number = 400
): NextResponse {
  const response = NextResponse.json({ error: message }, { status })
  addSecurityHeaders(response.headers)
  return response
}

/**
 * Helper function to create standard success responses with security headers
 */
export function createSecureResponse<T = any>(
  data: T,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status })
  addSecurityHeaders(response.headers)
  return response
}