'use client'

import { useState, useEffect } from 'react'

/** Returns true on iOS and Android devices (not desktop browsers) */
export function useMobilePlatform(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const mobile = /iPhone|iPad|iPod|Android/i.test(ua)
    setIsMobile(mobile)
  }, [])

  return isMobile
}
