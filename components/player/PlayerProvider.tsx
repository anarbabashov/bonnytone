'use client'

import { createContext, useRef, useCallback, useState, useEffect, type ReactNode } from 'react'
import Hls from 'hls.js'
import { usePlayerStore } from '@/store/playerStore'
import type { Quality } from '@/store/playerStore'
import { useNowPlaying } from '@/hooks/useNowPlaying'

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

export interface PlayerContextValue {
  play: () => void
  pause: () => void
  togglePlay: () => void
  analyserNode: AnalyserNode | null
}

export const PlayerContext = createContext<PlayerContextValue | null>(null)

const MAX_RECONNECT_ATTEMPTS = 10

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const reconnectHandler = useRef<(() => void) | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceCreatedRef = useRef(false)
  const gainNodeRef = useRef<GainNode | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  // Run now-playing polling globally
  useNowPlaying()

  // Lazily create Audio element in the DOM
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.style.display = 'none'
      document.body.appendChild(audio)
      audio.addEventListener('ended', () => reconnectHandler.current?.())
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  // Ensure AudioContext + AnalyserNode + GainNode exist (call on first play for user gesture)
  const ensureAudioContext = useCallback((audio: HTMLAudioElement) => {
    if (audioContextRef.current && sourceCreatedRef.current) return
    try {
      const ctx = audioContextRef.current || new AudioContext()
      audioContextRef.current = ctx
      if (!sourceCreatedRef.current) {
        const source = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        const gain = ctx.createGain()
        // Chain: source → gain → analyser → destination
        // GainNode before analyser so analyser sees volume-adjusted signal
        // (matches old audio.volume behavior for waveform visualization)
        source.connect(gain)
        gain.connect(analyser)
        analyser.connect(ctx.destination)
        gainNodeRef.current = gain
        // Apply current volume immediately
        const state = usePlayerStore.getState()
        gain.gain.value = state.isMuted ? 0 : state.volume
        // Keep audio.volume at 1 — iOS ignores it anyway, and
        // GainNode handles actual volume on all platforms
        audio.volume = 1
        setAnalyserNode(analyser)
        sourceCreatedRef.current = true
      }
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
    } catch (err) {
      console.warn('[PlayerProvider] AudioContext setup failed:', err)
    }
  }, [])

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  const scheduleReconnect = useCallback((audio: HTMLAudioElement) => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[PlayerProvider] Max reconnect attempts reached')
      const s = usePlayerStore.getState()
      s.setStreamStatus('offline')
      s.setIsPlaying(false)
      s.setIsBuffering(false)
      return
    }
    if (reconnectAttempts.current === 0) {
      const s = usePlayerStore.getState()
      s.setStreamStatus('connecting')
      s.setIsBuffering(true)
    }
    const delay = Math.min(2000 + reconnectAttempts.current * 1000, 10000)
    reconnectAttempts.current++
    console.log(`[PlayerProvider] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`)
    reconnectTimer.current = setTimeout(() => {
      if (usePlayerStore.getState().isPlaying) {
        initHls(audio, true)
      }
    }, delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initHls = useCallback((audio: HTMLAudioElement, silent = false) => {
    destroyHls()
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)

    if (!silent) {
      const store = usePlayerStore.getState()
      store.setStreamStatus('connecting')
      store.setIsBuffering(true)
    }

    const hls = new Hls(HLS_CONFIG)
    hlsRef.current = hls
    hls.loadSource(STREAM_URL)
    hls.attachMedia(audio)

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const s = usePlayerStore.getState()
      s.setStreamStatus('live')
      s.setIsBuffering(false)
      s.resetErrorCount()
      reconnectAttempts.current = 0
      audio.play().catch((err) => {
        console.warn('[PlayerProvider] Play failed after manifest:', err)
        s.setIsPlaying(false)
        s.setIsBuffering(false)
      })
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        const s = usePlayerStore.getState()
        s.incrementErrorCount()
        s.setError(data.details)
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
        } else {
          console.warn('[PlayerProvider] Fatal error, will reconnect:', data.type, data.details)
          destroyHls()
          if (s.isPlaying) {
            scheduleReconnect(audio)
          }
        }
      }
    })

    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      usePlayerStore.getState().setIsBuffering(false)
    })
  }, [destroyHls, scheduleReconnect])

  const play = useCallback(() => {
    const audio = getAudio()
    const store = usePlayerStore.getState()

    store.setIsPlaying(true)
    store.setIsBuffering(true)

    // Set up AudioContext on first play (needs user gesture)
    ensureAudioContext(audio)

    // Already have HLS -- just resume
    if (hlsRef.current) {
      audio.play().catch((err) => {
        console.warn('[PlayerProvider] Resume failed:', err)
        store.setIsPlaying(false)
        store.setIsBuffering(false)
      })
      return
    }

    if (!STREAM_URL) return

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
  }, [getAudio, initHls, ensureAudioContext])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    const store = usePlayerStore.getState()
    store.setIsPlaying(false)
    store.setIsBuffering(false)
  }, [])

  const togglePlay = useCallback(() => {
    usePlayerStore.getState().isPlaying ? pause() : play()
  }, [play, pause])

  // Volume sync — use GainNode (works on iOS where audio.volume is read-only)
  useEffect(() => {
    const unsub = usePlayerStore.subscribe((state) => {
      const vol = state.isMuted ? 0 : state.volume
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = vol
      } else if (audioRef.current) {
        // Fallback before AudioContext is created (desktop only, iOS ignores this)
        audioRef.current.volume = vol
      }
    })
    return unsub
  }, [])

  // Quality sync
  useEffect(() => {
    let prevQuality = usePlayerStore.getState().quality
    const unsub = usePlayerStore.subscribe((state) => {
      if (state.quality === prevQuality) return
      prevQuality = state.quality
      const hls = hlsRef.current
      if (!hls) return
      if (state.quality === 'auto') {
        hls.currentLevel = -1
      } else {
        const level = QUALITY_MAP[state.quality]
        if (level !== undefined && level < hls.levels.length) {
          hls.currentLevel = level
        }
      }
    })
    return unsub
  }, [])

  // Keep reconnect handler ref updated
  reconnectHandler.current = () => {
    const audio = audioRef.current
    const s = usePlayerStore.getState()
    if (audio && s.isPlaying && STREAM_URL && Hls.isSupported()) {
      console.log('[PlayerProvider] Stream ended, scheduling reconnect...')
      reconnectAttempts.current = 0
      scheduleReconnect(audio)
    }
  }

  // Media Session API
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'BTRadio DJ',
      artist: 'Live Stream',
    })
    navigator.mediaSession.setActionHandler('play', play)
    navigator.mediaSession.setActionHandler('pause', pause)
    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
    }
  }, [play, pause])

  const contextValue: PlayerContextValue = {
    play,
    pause,
    togglePlay,
    analyserNode,
  }

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  )
}
