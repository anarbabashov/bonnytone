'use client'

import { useEffect, useRef, useCallback } from 'react'
import Hls from 'hls.js'
import { usePlayerStore } from '@/store/playerStore'
import type { Quality } from '@/store/playerStore'

const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL || ''

const HLS_CONFIG: Partial<Hls['config']> = {
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  maxBufferSize: 10 * 1024 * 1024,
  maxBufferHole: 0.5,
  liveSyncDurationCount: 3,
  liveMaxLatencyDurationCount: 6,
  liveDurationInfinity: true,
  fragLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 1000,
  fragLoadingMaxRetryTimeout: 8000,
  manifestLoadingMaxRetry: 4,
  levelLoadingMaxRetry: 4,
  abrEwmaDefaultEstimate: 500000,
  abrBandWidthUpFactor: 0.7,
  abrBandWidthFactor: 0.95,
  startLevel: 0,
  backBufferLength: 30,
}

const QUALITY_MAP: Record<Exclude<Quality, 'auto'>, number> = {
  low: 0,
  medium: 1,
  high: 2,
}

export interface RadioPlayerAPI {
  play: () => void
  pause: () => void
  togglePlay: () => void
  analyserNode: AnalyserNode | null
}

/**
 * Radio player hook.
 * Returns play/pause functions that should be called DIRECTLY from click handlers
 * (not through Zustand → useEffect) to preserve user gesture context for audio.play().
 */
export function useRadioPlayer(): RadioPlayerAPI {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const reconnectHandler = useRef<(() => void) | null>(null)

  // Lazily create Audio element in the DOM (avoid SSR crash; must be in DOM for Chrome audio output)
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.style.display = 'none'
      document.body.appendChild(audio)
      // Auto-reconnect when stream ends (AzuraCast track transitions)
      audio.addEventListener('ended', () => reconnectHandler.current?.())
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  // Destroy current HLS instance (used before reconnecting)
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  // Create a fresh HLS instance and attach to audio element
  const initHls = useCallback((audio: HTMLAudioElement) => {
    destroyHls()

    const store = usePlayerStore.getState()
    store.setStreamStatus('connecting')
    store.setIsBuffering(true)

    const hls = new Hls(HLS_CONFIG)
    hlsRef.current = hls
    hls.loadSource(STREAM_URL)
    hls.attachMedia(audio)

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const s = usePlayerStore.getState()
      s.setStreamStatus('live')
      s.resetErrorCount()
      audio.play().catch((err) => {
        console.warn('[RadioPlayer] Play failed after manifest:', err)
        s.setIsPlaying(false)
        s.setIsBuffering(false)
      })
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        const s = usePlayerStore.getState()
        s.incrementErrorCount()
        s.setError(data.details)
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          s.setStreamStatus('error')
          hls.startLoad()
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
        } else {
          s.setStreamStatus('offline')
          hls.destroy()
          hlsRef.current = null
        }
      }
    })

    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      usePlayerStore.getState().setIsBuffering(false)
    })
  }, [destroyHls])

  // --- Play: called directly from click handler ---
  const play = useCallback(() => {
    const audio = getAudio()
    const store = usePlayerStore.getState()

    store.setIsPlaying(true)
    store.setIsBuffering(true)

    // Already have HLS — just resume
    if (hlsRef.current) {
      audio.play().catch((err) => {
        console.warn('[RadioPlayer] Resume failed:', err)
        store.setIsPlaying(false)
        store.setIsBuffering(false)
      })
      return
    }

    if (!STREAM_URL) return

    // HLS.js first (Chrome/Firefox/Edge/etc.) — must check before canPlayType
    // because some Chrome builds on Mac return 'maybe' for HLS mime type
    if (Hls.isSupported()) {
      initHls(audio)
      return
    }

    // Safari fallback: native HLS
    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      store.setStreamStatus('connecting')
      audio.src = STREAM_URL
      audio.addEventListener('loadedmetadata', () => {
        const s = usePlayerStore.getState()
        s.setStreamStatus('live')
        audio.play().catch(() => s.setIsPlaying(false))
      }, { once: true })
      return
    }

    store.setStreamStatus('error')
    store.setError('HLS is not supported')
  }, [getAudio, initHls])

  // --- Pause: called directly from click handler ---
  const pause = useCallback(() => {
    audioRef.current?.pause()
    const store = usePlayerStore.getState()
    store.setIsPlaying(false)
    store.setIsBuffering(false)
  }, [])

  // --- Toggle ---
  const togglePlay = useCallback(() => {
    usePlayerStore.getState().isPlaying ? pause() : play()
  }, [play, pause])

  // --- Volume ---
  const store = usePlayerStore()
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = store.isMuted ? 0 : store.volume
    }
  }, [store.volume, store.isMuted])

  // --- Quality ---
  useEffect(() => {
    const hls = hlsRef.current
    if (!hls) return
    if (store.quality === 'auto') {
      hls.currentLevel = -1
    } else {
      const level = QUALITY_MAP[store.quality]
      if (level !== undefined && level < hls.levels.length) {
        hls.currentLevel = level
      }
    }
  }, [store.quality])

  // Keep reconnect handler ref updated (called from ended event on audio element)
  reconnectHandler.current = () => {
    const audio = audioRef.current
    const s = usePlayerStore.getState()
    if (audio && s.isPlaying && STREAM_URL && Hls.isSupported()) {
      console.log('[RadioPlayer] Stream ended, reconnecting...')
      initHls(audio)
    }
  }

  // --- Media Session ---
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'BTRadio',
      artist: 'Live Stream',
    })
    navigator.mediaSession.setActionHandler('play', play)
    navigator.mediaSession.setActionHandler('pause', pause)
    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
    }
  }, [play, pause])

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      destroyHls()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current.remove()
        audioRef.current = null
      }
    }
  }, [destroyHls])

  return { play, pause, togglePlay, analyserNode: null }
}
