'use client'

import { useEffect, useCallback } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import type { NowPlayingInfo } from '@/store/playerStore'

const API_URL = process.env.NEXT_PUBLIC_AZURACAST_API_URL || ''
const POLL_INTERVAL = 15_000 // 15 seconds

export function useNowPlaying(): NowPlayingInfo | null {
  const setListenerCount = usePlayerStore((s) => s.setListenerCount)
  const nowPlaying = usePlayerStore((s) => s.nowPlaying)
  const setNowPlaying = usePlayerStore((s) => s.setNowPlaying)

  const fetchNowPlaying = useCallback(async () => {
    if (!API_URL) return

    try {
      const res = await fetch(API_URL)
      if (!res.ok) return

      const data = await res.json()

      const song = data?.now_playing?.song
      const listeners = data?.listeners?.current ?? data?.listeners?.total ?? 0

      setListenerCount(listeners)
      setNowPlaying({
        title: song?.title || 'Unknown Track',
        artist: song?.artist || 'Unknown Artist',
        art: song?.art || null,
      })
    } catch {
      // Silently fail -- keep last known data
    }
  }, [setListenerCount, setNowPlaying])

  useEffect(() => {
    fetchNowPlaying()
    const interval = setInterval(fetchNowPlaying, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchNowPlaying])

  return nowPlaying
}
