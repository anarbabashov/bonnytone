/**
 * Middleware Usage Examples
 * 
 * This file demonstrates how to use the middleware & guards system
 * in your API routes for maximum security and convenience.
 */

import { NextRequest } from 'next/server'
import { withAuth, withJSON, withMiddleware, createSecureResponse, createSecureErrorResponse } from './middleware'

/**
 * Example 1: Protected API route with authentication
 * Usage: POST /api/account/some-protected-action
 */
export async function protectedRouteExample(request: NextRequest) {
  // Use withAuth for routes that require authentication
  const { success, context, data, response } = await withAuth(request, {
    requireEmailVerified: true,  // Ensure email is verified
    includeUserData: true,       // Include full user data in context
    maxBodySize: 1024 * 512,     // 512KB limit for this route
  })

  // If middleware failed, return the error response
  if (!success) {
    return response!
  }

  // Access authenticated user context
  const { userId, sessionId, user } = context!
  
  // Access parsed JSON body
  const requestData = data // Typed based on your schema
  
  // Your business logic here...
  console.log(`User ${user?.email} (${userId}) performed action`)
  
  // Return secure response with headers
  return createSecureResponse({
    message: 'Action completed successfully',
    userId
  })
}

/**
 * Example 2: Public API route with JSON validation
 * Usage: POST /api/auth/register
 */
export async function publicRouteExample(request: NextRequest) {
  // Use withJSON for public routes that need JSON parsing and CSRF protection
  const { success, data, response } = await withJSON(request, {
    maxBodySize: 1024 * 256, // 256KB limit for registration
  })

  if (!success) {
    return response!
  }

  // Access parsed and validated JSON
  const { email, password } = data as { email: string; password: string }
  
  // Your registration logic here...
  
  return createSecureResponse({
    message: 'Registration initiated',
    ok: true
  })
}

/**
 * Example 3: Custom middleware configuration  
 * Usage: POST /api/admin/sensitive-action
 */
export async function customMiddlewareExample(request: NextRequest) {
  // Use withMiddleware for full control over options
  const { success, context, data, response } = await withMiddleware(request, {
    requireAuth: true,
    requireEmailVerified: true,
    requireNotBlocked: true,
    includeUserData: true,
    requireJSON: true,
    maxBodySize: 1024 * 1024, // 1MB
    allowEmptyBody: false,
    addSecurityHeaders: true,
  })

  if (!success) {
    return response!
  }

  // Check additional permissions
  if (!context?.user?.email.endsWith('@admin.com')) {
    return createSecureErrorResponse('Admin access required', 403)
  }

  // Your admin logic here...
  
  return createSecureResponse({
    message: 'Admin action completed',
    timestamp: new Date().toISOString()
  })
}

/**
 * Example 4: GET route with authentication (no JSON parsing)
 * Usage: GET /api/user/profile
 */
export async function getRouteExample(request: NextRequest) {
  const { success, context, response } = await withAuth(request, {
    requireJSON: false,        // No JSON parsing for GET
    includeUserData: true,     // Get full user data
  })

  if (!success) {
    return response!
  }

  const { user } = context!
  
  return createSecureResponse({
    user: {
      id: user!.id,
      email: user!.email,
      displayName: user!.displayName,
      emailVerified: !!user!.emailVerifiedAt,
      mfaEnabled: user!.mfaEnabled,
    }
  })
}

/**
 * Example 5: Error handling patterns
 */
export async function errorHandlingExample(request: NextRequest) {
  const { success, context, data, response, error } = await withAuth(request)

  if (!success) {
    // Log the specific error for debugging
    console.error('Middleware error:', error)
    
    // Return the pre-configured error response
    return response!
  }

  try {
    // Your business logic...
    
    // Create success response
    return createSecureResponse({ result: 'success' })
    
  } catch (businessError) {
    // Handle business logic errors
    console.error('Business logic error:', businessError)
    
    return createSecureErrorResponse(
      'Operation failed', 
      500
    )
  }
}

/**
 * Example 6: Route-specific validation
 */
export async function validatedRouteExample(request: NextRequest) {
  const { success, context, data, response } = await withAuth(request)

  if (!success) {
    return response!
  }

  // Additional validation on parsed data
  const requestData = data as any
  
  if (!requestData.requiredField) {
    return createSecureErrorResponse(
      'Missing required field: requiredField',
      400
    )
  }

  if (typeof requestData.numericField !== 'number') {
    return createSecureErrorResponse(
      'Field must be numeric: numericField',
      400
    )
  }

  // Your validated logic here...
  
  return createSecureResponse({
    message: 'Validation passed',
    data: requestData
  })
}

/**
 * Example 7: Conditional authentication
 */
export async function conditionalAuthExample(request: NextRequest) {
  // Check if auth is needed based on request
  const needsAuth = request.method === 'POST'
  
  if (needsAuth) {
    const { success, context, data, response } = await withAuth(request)
    
    if (!success) {
      return response!
    }
    
    // Authenticated logic
    return createSecureResponse({
      message: 'Authenticated action',
      userId: context!.userId
    })
    
  } else {
    // Public logic for GET requests
    return createSecureResponse({
      message: 'Public information',
      timestamp: new Date().toISOString()
    })
  }
}