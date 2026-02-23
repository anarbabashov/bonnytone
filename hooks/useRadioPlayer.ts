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

export interface RadioPlayerRefs {
  analyserNode: AnalyserNode | null
}

export function useRadioPlayer(): RadioPlayerRefs {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const analyserNodeRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const isAudioInitializedRef = useRef(false)
  const isWebAudioInitializedRef = useRef(false)
  const pendingPlayRef = useRef(false)
  const hlsReadyRef = useRef(false)

  const store = usePlayerStore()

  // Stable reference to store actions (avoid re-renders)
  const storeRef = useRef(store)
  storeRef.current = store

  // --- Create persistent audio element (once) ---
  const getAudioElement = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current

    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'none'
    audioRef.current = audio
    return audio
  }, [])

  // --- Initialize Web Audio API (on first user gesture) ---
  const initWebAudio = useCallback(() => {
    if (isWebAudioInitializedRef.current) return
    const audio = audioRef.current
    if (!audio) return

    try {
      const ctx = new AudioContext()
      audioContextRef.current = ctx

      const source = ctx.createMediaElementSource(audio)
      sourceNodeRef.current = source

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserNodeRef.current = analyser

      const gain = ctx.createGain()
      gain.gain.value = storeRef.current.volume
      gainNodeRef.current = gain

      // Audio graph: source -> analyser -> gain -> destination
      source.connect(analyser)
      analyser.connect(gain)
      gain.connect(ctx.destination)

      isWebAudioInitializedRef.current = true
    } catch (err) {
      // Web Audio API not supported or failed -- audio still plays through <audio> element
      console.warn('[RadioPlayer] Web Audio API init failed:', err)
    }
  }, [])

  // --- Initialize HLS stream (once) ---
  const initStream = useCallback(() => {
    if (isAudioInitializedRef.current || !STREAM_URL) return
    isAudioInitializedRef.current = true

    const audio = getAudioElement()
    storeRef.current.setStreamStatus('connecting')

    // Safari: native HLS support
    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = STREAM_URL

      audio.addEventListener('loadedmetadata', () => {
        storeRef.current.setStreamStatus('live')
        storeRef.current.resetErrorCount()
        hlsReadyRef.current = true

        if (pendingPlayRef.current) {
          pendingPlayRef.current = false
          audio.play().catch((err) => {
            console.warn('[RadioPlayer] Play failed after Safari ready:', err)
            storeRef.current.setIsPlaying(false)
            storeRef.current.setIsBuffering(false)
          })
        }
      }, { once: true })

      audio.addEventListener('error', () => {
        storeRef.current.setStreamStatus('error')
        storeRef.current.setError('Stream failed to load')
        storeRef.current.incrementErrorCount()
      })

      return
    }

    // Chrome/Firefox/Edge: HLS.js via MSE
    if (Hls.isSupported()) {
      const hls = new Hls(HLS_CONFIG)
      hlsRef.current = hls

      hls.loadSource(STREAM_URL)
      hls.attachMedia(audio)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        storeRef.current.setStreamStatus('live')
        storeRef.current.resetErrorCount()
        hlsReadyRef.current = true

        if (pendingPlayRef.current) {
          pendingPlayRef.current = false
          audio.play().catch((err) => {
            console.warn('[RadioPlayer] Play failed after manifest parsed:', err)
            storeRef.current.setIsPlaying(false)
            storeRef.current.setIsBuffering(false)
          })
        }
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          storeRef.current.incrementErrorCount()
          storeRef.current.setError(data.details)

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              storeRef.current.setStreamStatus('error')
              // Try to recover from network errors
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Try to recover from media errors
              hls.recoverMediaError()
              break
            default:
              // Unrecoverable error -- destroy and mark offline
              storeRef.current.setStreamStatus('offline')
              hls.destroy()
              break
          }
        }
      })

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        storeRef.current.setIsBuffering(false)
      })

      return
    }

    // No HLS support at all
    storeRef.current.setStreamStatus('error')
    storeRef.current.setError('HLS is not supported in this browser')
  }, [getAudioElement])

  // --- Play/Pause control ---
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (store.isPlaying) {
      // Initialize stream on first play
      if (!isAudioInitializedRef.current) {
        initStream()
      }

      // Initialize Web Audio on first play (user gesture)
      initWebAudio()

      // Resume AudioContext if suspended (iOS requirement)
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume()
      }

      storeRef.current.setIsBuffering(true)

      // Only call play() if HLS is ready; otherwise set pending flag
      if (hlsReadyRef.current) {
        audio.play().catch((err) => {
          console.warn('[RadioPlayer] Play failed:', err)
          storeRef.current.setIsPlaying(false)
          storeRef.current.setIsBuffering(false)
        })
      } else {
        pendingPlayRef.current = true
      }
    } else {
      pendingPlayRef.current = false
      audio.pause()
      storeRef.current.setIsBuffering(false)
    }
  }, [store.isPlaying, initStream, initWebAudio])

  // --- Volume control ---
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const effectiveVolume = store.isMuted ? 0 : store.volume

    // Prefer Web Audio gain node for volume (smoother)
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = effectiveVolume
      audio.volume = 1 // Let gain node handle volume
    } else {
      audio.volume = effectiveVolume
    }
  }, [store.volume, store.isMuted])

  // --- Quality control ---
  useEffect(() => {
    const hls = hlsRef.current
    if (!hls) return

    if (store.quality === 'auto') {
      hls.currentLevel = -1 // Auto
    } else {
      const level = QUALITY_MAP[store.quality]
      if (level !== undefined && level < hls.levels.length) {
        hls.currentLevel = level
      }
    }
  }, [store.quality])

  // --- Audio element event listeners ---
  useEffect(() => {
    const audio = getAudioElement()

    const onWaiting = () => storeRef.current.setIsBuffering(true)
    const onPlaying = () => {
      storeRef.current.setIsBuffering(false)
      storeRef.current.setStreamStatus('live')
    }
    const onPause = () => storeRef.current.setIsPlaying(false)
    const onEnded = () => {
      storeRef.current.setIsPlaying(false)
      storeRef.current.setStreamStatus('offline')
    }

    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [getAudioElement])

  // --- Media Session API (lock screen controls) ---
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'BTRadio',
      artist: 'Live Stream',
      artwork: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    })

    navigator.mediaSession.setActionHandler('play', () => {
      storeRef.current.play()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      storeRef.current.pause()
    })

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
    }
  }, [])

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      hlsRef.current?.destroy()
      audioContextRef.current?.close()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  return {
    analyserNode: analyserNodeRef.current,
  }
}
