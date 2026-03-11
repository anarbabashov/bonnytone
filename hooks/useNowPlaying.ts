'use client'

import { useEffect, useCallback } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import type { NowPlayingInfo, NowPlayingTrack } from '@/store/playerStore'

const API_URL = process.env.NEXT_PUBLIC_AZURACAST_API_URL || ''
const POLL_INTERVAL = 15_000 // 15 seconds

/** Convert an absolute art URL to its pathname so it routes through our proxy/rewrites. */
function normalizeArtUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).pathname
  } catch {
    // Already a relative path or invalid — use as-is
    return url
  }
}

function buildTrack(raw: Record<string, unknown>): NowPlayingTrack | null {
  if (!raw) return null
  const song = raw.song as Record<string, unknown> | undefined
  if (!song) return null
  return {
    song: {
      id: String(song.id ?? ''),
      title: String(song.title ?? ''),
      artist: String(song.artist ?? ''),
      album: String(song.album ?? ''),
      genre: String(song.genre ?? ''),
      art: normalizeArtUrl(song.art ? String(song.art) : null),
      text: String(song.text ?? ''),
      lyrics: String(song.lyrics ?? ''),
    },
    duration: Number(raw.duration ?? 0),
    elapsed: Number(raw.elapsed ?? 0),
    remaining: Number(raw.remaining ?? 0),
    playlist: String(raw.playlist ?? ''),
    streamer: String(raw.streamer ?? ''),
    isRequest: Boolean(raw.is_request),
  }
}

export function useNowPlaying(): NowPlayingInfo | null {
  const setListenerCount = usePlayerStore((s) => s.setListenerCount)
  const setStreamStatus = usePlayerStore((s) => s.setStreamStatus)
  const nowPlaying = usePlayerStore((s) => s.nowPlaying)
  const setNowPlaying = usePlayerStore((s) => s.setNowPlaying)
  const setFullNowPlaying = usePlayerStore((s) => s.setFullNowPlaying)
  const setStationDescription = usePlayerStore((s) => s.setStationDescription)

  const fetchNowPlaying = useCallback(async () => {
    if (!API_URL) return

    try {
      const res = await fetch(API_URL)
      if (!res.ok) {
        setStreamStatus('offline')
        return
      }

      const data = await res.json()

      const song = data?.now_playing?.song
      const listeners = data?.listeners?.current ?? data?.listeners?.total ?? 0

      setListenerCount(listeners)
      setNowPlaying({
        title: song?.title || 'Unknown Track',
        artist: song?.artist || 'Unknown Artist',
        art: normalizeArtUrl(song?.art),
      })

      // Extract station description (e.g. "Main Stage")
      const stationDesc = data?.station?.description
      if (stationDesc) setStationDescription(stationDesc)

      // Build full now-playing data for extended UI
      const currentTrack = buildTrack(data?.now_playing)
      if (currentTrack) {
        setFullNowPlaying({
          currentTrack,
          nextTrack: buildTrack(data?.playing_next),
          isLive: Boolean(data?.live?.is_live),
          listenersCurrent: Number(data?.listeners?.current ?? 0),
          listenersTotal: Number(data?.listeners?.total ?? 0),
          listenersUnique: Number(data?.listeners?.unique ?? 0),
        })
      }

      // Update stream status based on whether the station is broadcasting.
      // Don't override 'connecting' state (user just pressed play, HLS loading).
      const current = usePlayerStore.getState().streamStatus
      if (current !== 'connecting') {
        setStreamStatus(song ? 'live' : 'offline')
      }
    } catch {
      setStreamStatus('offline')
    }
  }, [setListenerCount, setNowPlaying, setFullNowPlaying, setStationDescription, setStreamStatus])

  useEffect(() => {
    fetchNowPlaying()
    const interval = setInterval(fetchNowPlaying, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchNowPlaying])

  return nowPlaying
}
