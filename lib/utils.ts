import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getServerUrl(request?: Request): string {
  // In development, use hardcoded localhost:3000 for consistent email links
  // This avoids issues with dynamic ports and client connection ports
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }

  // In production, use environment variable
  if (process.env.APP_URL) {
    return process.env.APP_URL
  }

  // Final fallback
  return 'http://localhost:3000'
}
