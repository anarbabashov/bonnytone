import { NextRequest, NextResponse } from 'next/server'

/**
 * Strict JSON Parser for API Routes
 * 
 * Enforces security best practices:
 * 1. Strict Content-Type validation (application/json only)
 * 2. Request body size limit (1MB maximum)
 * 3. Proper error handling and response formatting
 * 4. CSRF resistance through content-type enforcement
 */

export interface ParseResult<T = any> {
  success: boolean
  data?: T
  error?: string
  response?: NextResponse
}

/**
 * Parse JSON request body with strict validation and size limits
 * @param request NextRequest object
 * @param options Configuration options
 * @returns ParseResult with parsed data or error response
 */
export async function parseStrictJSON<T = any>(
  request: NextRequest,
  options: {
    maxSizeBytes?: number
    allowEmptyBody?: boolean
  } = {}
): Promise<ParseResult<T>> {
  const { 
    maxSizeBytes = 1024 * 1024, // 1MB default
    allowEmptyBody = false 
  } = options

  try {
    // 1. Validate Content-Type header (strict application/json)
    const contentType = request.headers.get('content-type')
    
    // Allow empty body for certain operations
    if (!contentType && allowEmptyBody) {
      return { success: true, data: undefined }
    }
    
    if (!contentType || contentType !== 'application/json') {
      return {
        success: false,
        error: 'Content-Type must be exactly application/json',
        response: NextResponse.json(
          { error: 'Content-Type must be application/json' },
          { status: 400 }
        )
      }
    }

    // 2. Check Content-Length header for size limit
    const contentLengthHeader = request.headers.get('content-length')
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10)
      if (contentLength > maxSizeBytes) {
        return {
          success: false,
          error: `Request body too large (${contentLength} bytes, max ${maxSizeBytes})`,
          response: NextResponse.json(
            { error: 'Request body too large' },
            { status: 413 }
          )
        }
      }
    }

    // 3. Parse JSON with size enforcement
    let body: string
    try {
      // Read body with size limit enforcement
      const chunks: Uint8Array[] = []
      let totalSize = 0
      
      const reader = request.body?.getReader()
      if (!reader) {
        if (allowEmptyBody) {
          return { success: true, data: undefined }
        }
        return {
          success: false,
          error: 'No request body provided',
          response: NextResponse.json(
            { error: 'Request body is required' },
            { status: 400 }
          )
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        if (value) {
          totalSize += value.length
          
          if (totalSize > maxSizeBytes) {
            return {
              success: false,
              error: `Request body too large (exceeded ${maxSizeBytes} bytes)`,
              response: NextResponse.json(
                { error: 'Request body too large' },
                { status: 413 }
              )
            }
          }
          
          chunks.push(value)
        }
      }

      // Convert chunks to string
      const uint8Array = new Uint8Array(totalSize)
      let offset = 0
      for (const chunk of chunks) {
        uint8Array.set(chunk, offset)
        offset += chunk.length
      }
      
      body = new TextDecoder().decode(uint8Array)
      
    } catch (error) {
      return {
        success: false,
        error: 'Failed to read request body',
        response: NextResponse.json(
          { error: 'Invalid request body' },
          { status: 400 }
        )
      }
    }

    // 4. Parse JSON
    let parsedData: T
    try {
      parsedData = JSON.parse(body) as T
    } catch (error) {
      return {
        success: false,
        error: 'Invalid JSON format',
        response: NextResponse.json(
          { error: 'Invalid JSON format' },
          { status: 400 }
        )
      }
    }

    // 5. Validate JSON is an object (not a primitive)
    if (typeof parsedData !== 'object' || parsedData === null || Array.isArray(parsedData)) {
      return {
        success: false,
        error: 'JSON body must be an object',
        response: NextResponse.json(
          { error: 'JSON body must be an object' },
          { status: 400 }
        )
      }
    }

    return {
      success: true,
      data: parsedData
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
      response: NextResponse.json(
        { error: 'Failed to parse request' },
        { status: 500 }
      )
    }
  }
}

/**
 * Simplified JSON parser that uses Next.js built-in parsing with size check
 * More efficient for most use cases but less strict about content-type
 */
export async function parseJSON<T = any>(
  request: NextRequest,
  maxSizeBytes: number = 1024 * 1024 // 1MB default
): Promise<ParseResult<T>> {
  try {
    // Check Content-Length if available
    const contentLengthHeader = request.headers.get('content-length')
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10)
      if (contentLength > maxSizeBytes) {
        return {
          success: false,
          error: `Request body too large (${contentLength} bytes, max ${maxSizeBytes})`,
          response: NextResponse.json(
            { error: 'Request body too large' },
            { status: 413 }
          )
        }
      }
    }

    const data = await request.json() as T
    return {
      success: true,
      data
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('body exceeds')) {
      return {
        success: false,
        error: 'Request body too large',
        response: NextResponse.json(
          { error: 'Request body too large' },
          { status: 413 }
        )
      }
    }

    return {
      success: false,
      error: 'Invalid JSON format',
      response: NextResponse.json(
        { error: 'Invalid JSON format' },
        { status: 400 }
      )
    }
  }
}

/**
 * Helper function to add JSON parser to existing API routes
 * Usage: const { success, data, response } = await withStrictJSON(request)
 */
export async function withStrictJSON<T = any>(
  request: NextRequest,
  options?: { maxSizeBytes?: number; allowEmptyBody?: boolean }
): Promise<ParseResult<T>> {
  return parseStrictJSON<T>(request, options)
}