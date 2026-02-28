'use client'

import { useEffect, useState, useRef } from 'react'
import { useTheme } from 'next-themes'
import { usePlayerStore } from '@/store/playerStore'
import { usePlayer } from '@/hooks/usePlayer'
import { useMobilePlatform } from '@/hooks/useMobilePlatform'
import Waveform from '@/components/radio/Waveform'
import VolumeSlider from '@/components/radio/VolumeSlider'
import { Play, Pause, X } from 'lucide-react'

export default function MiniPlayer() {
  const { resolvedTheme } = useTheme()
  const { togglePlay, analyserNode } = usePlayer()
  const isMobile = useMobilePlatform()

  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const streamStatus = usePlayerStore((s) => s.streamStatus)
  const nowPlaying = usePlayerStore((s) => s.nowPlaying)
  const lastError = usePlayerStore((s) => s.lastError)
  const setVolume = usePlayerStore((s) => s.setVolume)

  // Badge only appears after user has clicked play at least once
  const [hasPlayed, setHasPlayed] = useState(false)
  useEffect(() => {
    if (isPlaying && !hasPlayed) setHasPlayed(true)
  }, [isPlaying, hasPlayed])

  // Badge expand animation: starts as a dot, expands to full pill after 1s
  const [badgeExpanded, setBadgeExpanded] = useState(false)
  const badgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showPending, setShowPending] = useState(false)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!hasPlayed) return

    if (badgeTimer.current) clearTimeout(badgeTimer.current)
    if (pendingTimer.current) clearTimeout(pendingTimer.current)

    if (streamStatus === 'live') {
      setShowPending(false)
      setBadgeExpanded(false)
      badgeTimer.current = setTimeout(() => setBadgeExpanded(true), 1000)
    } else if (streamStatus === 'error') {
      setBadgeExpanded(true)
    } else if (streamStatus === 'connecting' || streamStatus === 'offline') {
      setBadgeExpanded(false)
      pendingTimer.current = setTimeout(() => {
        setShowPending(true)
        setBadgeExpanded(true)
      }, 1000)
    } else {
      setBadgeExpanded(false)
      setShowPending(false)
    }

    return () => {
      if (badgeTimer.current) clearTimeout(badgeTimer.current)
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
    }
  }, [streamStatus, hasPlayed])

  // Dynamic document title
  useEffect(() => {
    const STATUS_LABELS: Record<string, string> = {
      live: 'LIVE',
      connecting: 'Connecting',
      offline: 'Offline',
      error: 'Error',
    }
    const label = STATUS_LABELS[streamStatus]
    document.title = label ? `${label} | BTRadio DJ` : 'BTRadio DJ'
  }, [streamStatus])

  // Lock scroll
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  const isDot = hasPlayed && (streamStatus === 'live' || streamStatus === 'error' || (showPending && (streamStatus === 'connecting' || streamStatus === 'offline')))
  const isError = streamStatus === 'error'
  const isPending = showPending && (streamStatus === 'connecting' || streamStatus === 'offline')
  const dotColor = isError ? 'bg-red-500' : isPending ? 'bg-orange-500' : 'bg-green-500'
  const pingColor = isError ? '' : isPending ? 'bg-orange-400' : 'bg-green-400'

  return (
    <div className="relative h-[100dvh] overflow-hidden flex flex-col">
      <Waveform
        isPlaying={isPlaying}
        volume={isMuted ? 0 : volume}
        theme={resolvedTheme}
        analyserNode={analyserNode}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 z-10">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 text-foreground"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 01.4-2.253M12 8.25a2.25 2.25 0 00-2.248 2.146M12 8.25a2.25 2.25 0 012.248 2.146M8.683 5a6.032 6.032 0 01-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0115.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 00-.575-1.752M4.921 6a24.048 24.048 0 00-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 01-5.223 1.082"
            />
          </svg>
          <span className="text-sm font-semibold text-foreground">BTRadio DJ</span>
        </div>
        <button
          onClick={() => window.close()}
          className="w-8 h-8 rounded-full glass-subtle flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 z-10 -translate-y-[25px]">
        {/* Status badge — glass dot, then smoothly expands into pill */}
        <div
          className={`glass flex items-center justify-center rounded-full p-1.5 transition-all duration-700 ease-in-out ${
            isDot ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } ${badgeExpanded ? 'gap-2 px-3 py-1.5' : 'gap-0'}`}
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            {pingColor && (
              <span className={`${isPending ? 'animate-pulse' : 'animate-ping'} absolute inline-flex h-full w-full rounded-full ${pingColor} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
          </span>
          <span
            className={`text-xs font-medium tracking-wide whitespace-nowrap overflow-hidden transition-all duration-700 ease-in-out ${
              isError ? 'text-red-400' : isPending ? 'text-orange-400' : 'text-foreground'
            } ${badgeExpanded ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}
          >
            {isError ? 'ERROR' : isPending ? 'PENDING' : 'LIVE'}
          </span>
          <span
            className={`text-xs text-muted-foreground whitespace-nowrap overflow-hidden transition-all duration-700 ease-in-out ${
              badgeExpanded ? 'max-w-[300px] opacity-100' : 'max-w-0 opacity-0'
            }`}
          >
            {isError ? (lastError || 'Stream unavailable') : isPending ? 'We apologize, something went wrong' : 'Main Stage'}
          </span>
        </div>

        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          disabled={streamStatus === 'offline'}
          className="w-28 h-28 rounded-full glass flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isBuffering ? (
            <div className="w-11 h-11 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-11 h-11 text-primary" strokeWidth={1.5} />
          ) : (
            <Play className="w-11 h-11 text-primary ml-1" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* Volume slider at bottom */}
      {!isMobile && (
        <div className="flex justify-center px-6 pb-5 z-10">
          <VolumeSlider volume={volume} onChange={setVolume} />
        </div>
      )}
    </div>
  )
}
