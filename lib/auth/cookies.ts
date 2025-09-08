import { NextRequest, NextResponse } from 'next/server'

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  domain?: string
  path?: string
  maxAge?: number
}

const defaultCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'lax',
  path: '/',
  domain: COOKIE_DOMAIN,
}

// Set access token cookie (shorter expiry)
export function setAccessTokenCookie(response: NextResponse, token: string): void {
  const options: CookieOptions = {
    ...defaultCookieOptions,
    maxAge: 600, // 10 minutes
  }
  
  response.cookies.set('access_token', token, options)
}

// Set refresh token cookie (longer expiry)
export function setRefreshTokenCookie(response: NextResponse, token: string): void {
  const options: CookieOptions = {
    ...defaultCookieOptions,
    maxAge: 2592000, // 30 days
  }
  
  response.cookies.set('refresh_token', token, options)
}

// Clear refresh cookie (per spec)
export function clearRefreshCookie(response: NextResponse): void {
  const clearOptions: CookieOptions = {
    ...defaultCookieOptions,
    maxAge: 0,
  }
  
  response.cookies.set('refresh_token', '', clearOptions)
}

// Clear auth cookies (all tokens)
export function clearAuthCookies(response: NextResponse): void {
  const clearOptions: CookieOptions = {
    ...defaultCookieOptions,
    maxAge: 0,
  }
  
  response.cookies.set('access_token', '', clearOptions)
  response.cookies.set('refresh_token', '', clearOptions)
}

// Get tokens from request
export function getAccessTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get('access_token')?.value || null
}

export function getRefreshTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get('refresh_token')?.value || null
}

// Set session cookie for additional security
export function setSessionCookie(response: NextResponse, sessionId: string): void {
  const options: CookieOptions = {
    ...defaultCookieOptions,
    maxAge: 2592000, // 30 days
  }
  
  response.cookies.set('session_id', sessionId, options)
}

export function getSessionIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get('session_id')?.value || null
}

export function clearSessionCookie(response: NextResponse): void {
  const clearOptions: CookieOptions = {
    ...defaultCookieOptions,
    maxAge: 0,
  }
  
  response.cookies.set('session_id', '', clearOptions)
}