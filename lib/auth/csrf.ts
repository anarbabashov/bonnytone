/**
 * CSRF Protection Strategy
 * 
 * This application uses a CSRF-resistant architecture that eliminates the need
 * for traditional CSRF tokens through the following approach:
 * 
 * 1. **Pure JSON API**: All API endpoints require Content-Type: application/json
 *    - This prevents simple form-based CSRF attacks
 *    - Browsers enforce CORS for JSON requests from different origins
 * 
 * 2. **Authorization Header**: Authentication uses Bearer tokens in Authorization header
 *    - Cannot be set by forms or simple JavaScript from different origins
 *    - Immune to CSRF attacks that rely on automatic cookie sending
 * 
 * 3. **SameSite=Lax Cookies**: Refresh tokens use SameSite=Lax for additional protection
 *    - Prevents cookies from being sent with cross-site requests
 *    - Still allows normal navigation and redirects to work
 * 
 * 4. **Content-Type Enforcement**: Strict validation of application/json
 *    - Prevents form-based attacks that would use application/x-www-form-urlencoded
 *    - Forces preflight CORS checks for cross-origin requests
 * 
 * This approach is more secure than traditional CSRF tokens because:
 * - No state to manage or validate
 * - No risk of token leakage or timing attacks
 * - Immune to double-submit cookie vulnerabilities
 * - Works seamlessly with SPA and mobile applications
 */

import { NextRequest } from 'next/server'

/**
 * Validates that the request follows CSRF-resistant patterns
 * Used internally by the auth guards
 */
export function validateCSRFResistance(request: NextRequest): {
  valid: boolean
  reason?: string
} {
  // For state-changing operations, require JSON content-type
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const contentType = request.headers.get('content-type')
    
    // Allow DELETE without body
    if (request.method === 'DELETE' && !contentType) {
      return { valid: true }
    }
    
    // Require application/json for other operations
    if (!contentType || !contentType.includes('application/json')) {
      return {
        valid: false,
        reason: 'Content-Type must be application/json for state-changing operations'
      }
    }
  }

  // Ensure Authorization header is present for authenticated endpoints
  // (This is handled by the auth guard, but we document it here)
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      reason: 'Bearer token required in Authorization header'
    }
  }

  return { valid: true }
}

/**
 * Additional security headers for CSRF resistance
 */
export const CSRF_SECURITY_HEADERS = {
  // Prevent embedding in frames (clickjacking protection)
  'X-Frame-Options': 'DENY',
  
  // Enable XSS protection
  'X-Content-Type-Options': 'nosniff',
  
  // Referrer policy for privacy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Content Security Policy (basic - should be customized per application)
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
} as const

/**
 * Apply CSRF-resistant security headers to response
 */
export function addSecurityHeaders(headers: Headers): void {
  Object.entries(CSRF_SECURITY_HEADERS).forEach(([key, value]) => {
    headers.set(key, value)
  })
}