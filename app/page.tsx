'use client'

import { useEffect, useState, useRef, useMemo } from "react"
import { useTheme } from "next-themes"
import { usePlayerStore } from "@/store/playerStore"
import { usePlayer } from "@/hooks/usePlayer"
import { useMobilePlatform } from "@/hooks/useMobilePlatform"
import { useRotatingText } from "@/hooks/useRotatingText"
import Waveform from "@/components/radio/Waveform"
import GlassPlayButton from "@/components/radio/GlassPlayButton"
import ActionButtons from "@/components/radio/ActionButtons"
import VolumeSlider from "@/components/radio/VolumeSlider"
import ThemeToggle from "@/components/layout/ThemeToggle/ThemeToggle"

export default function Home() {
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
  const currentBitrate = usePlayerStore((s) => s.currentBitrate)
  const stationDescription = usePlayerStore((s) => s.stationDescription)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const toggleMute = usePlayerStore((s) => s.toggleMute)

  // Derive track metadata for display
  const hasValidArtist = nowPlaying?.artist && nowPlaying.artist !== 'Unknown Artist'
  const hasValidTitle = nowPlaying?.title && nowPlaying.title !== 'Unknown Track'
  const hasValidMeta = !!(hasValidArtist && hasValidTitle)
  const trackLabel = hasValidMeta ? `${nowPlaying!.artist} - ${nowPlaying!.title}` : null
  const capitalizedLabel = trackLabel
    ? trackLabel.replace(/\b\w/g, (c) => c.toUpperCase())
    : null

  // Track whether user has clicked play at least once (enables rotating details)
  const [hasPlayed, setHasPlayed] = useState(false)
  useEffect(() => {
    if (isPlaying && !hasPlayed) setHasPlayed(true)
  }, [isPlaying, hasPlayed])

  // Badge expand animation: starts as dot, expands to label after 1s, then details after play
  const [badgeLabelVisible, setBadgeLabelVisible] = useState(false)
  const [badgeDetailsVisible, setBadgeDetailsVisible] = useState(false)
  const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const detailsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce PENDING badge — only show after 1s in connecting/offline state
  const [showPending, setShowPending] = useState(false)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Clear previous timers
    if (labelTimer.current) clearTimeout(labelTimer.current)
    if (detailsTimer.current) clearTimeout(detailsTimer.current)
    if (pendingTimer.current) clearTimeout(pendingTimer.current)

    if (streamStatus === 'live') {
      setShowPending(false)
      setBadgeLabelVisible(false)
      setBadgeDetailsVisible(false)
      // Step 1: show LIVE label after 1s
      labelTimer.current = setTimeout(() => setBadgeLabelVisible(true), 1000)
      // Step 2: expand with rotating details after another 1s (only while playing)
      if (isPlaying) {
        detailsTimer.current = setTimeout(() => setBadgeDetailsVisible(true), 2000)
      }
    } else if (streamStatus === 'error') {
      setBadgeLabelVisible(true)
      setBadgeDetailsVisible(true)
    } else if (streamStatus === 'connecting' || streamStatus === 'offline') {
      setBadgeLabelVisible(false)
      setBadgeDetailsVisible(false)
      pendingTimer.current = setTimeout(() => {
        setShowPending(true)
        setBadgeLabelVisible(true)
        if (isPlaying) setBadgeDetailsVisible(true)
      }, 1000)
    } else {
      setBadgeLabelVisible(false)
      setBadgeDetailsVisible(false)
      setShowPending(false)
    }

    return () => {
      if (labelTimer.current) clearTimeout(labelTimer.current)
      if (detailsTimer.current) clearTimeout(detailsTimer.current)
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
    }
  }, [streamStatus, isPlaying])

  // Global keyboard shortcuts: Space = toggle play, M = toggle mute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, toggleMute])

  // Rotating text items for LIVE badge
  const rotatingItems = useMemo(() => {
    const items: { text: string; duration: number }[] = []
    if (capitalizedLabel) {
      items.push({ text: capitalizedLabel, duration: 60000 })
    }
    if (stationDescription) {
      items.push({ text: stationDescription, duration: 10000 })
    }
    if (isPlaying && currentBitrate) {
      items.push({ text: `${Math.round(currentBitrate / 1000)}kbps`, duration: 10000 })
    }
    items.push({ text: '24/7', duration: 10000 })
    return items
  }, [isPlaying, currentBitrate, capitalizedLabel, stationDescription])
  const { text: rotatingText, phase: rotatingPhase, measureRef: rotatingRef, width: rotatingWidth } = useRotatingText(rotatingItems)

  // Lock scroll on homepage (Safari ignores overflow:hidden on child divs)
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.overscrollBehavior = ''
    }
  }, [])

  useEffect(() => {
    const STATUS_LABELS: Record<string, string> = {
      live: 'LIVE',
      connecting: 'Connecting',
      offline: 'Offline',
      error: 'Error',
    }
    const STATUS_COLORS: Record<string, string> = {
      live: '#22c55e',
      connecting: '#eab308',
      offline: '#ef4444',
      error: '#ef4444',
    }
    const label = STATUS_LABELS[streamStatus]
    document.title = label ? `${label} | BTRadio DJ` : 'BTRadio DJ'

    // Dynamic favicon with colored dot
    const color = STATUS_COLORS[streamStatus]
    if (color) {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.beginPath()
        ctx.arc(16, 16, 7, 0, 2 * Math.PI)
        ctx.fillStyle = color
        ctx.fill()
        const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
          || document.createElement('link')
        link.rel = 'icon'
        link.href = canvas.toDataURL('image/png')
        if (!link.parentNode) document.head.appendChild(link)
      }
    }
  }, [streamStatus])

  const handlePopOut = () => {
    const w = 420, h = 500
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2)
    window.open(
      '/mini-player',
      'btradio-mini',
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no`
    )
  }

  return (
    <div className="relative h-[100dvh] overflow-hidden flex flex-col items-center justify-center px-4" style={{ overscrollBehavior: 'none' }}>
      <Waveform
        isPlaying={isPlaying}
        volume={isMuted ? 0 : volume}
        theme={resolvedTheme}
        analyserNode={analyserNode}
      />

      {/* Top bar: Auth + Theme toggle */}
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6 min-[1920px]:w-8 min-[1920px]:h-8 mr-2 text-foreground"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 01.4-2.253M12 8.25a2.25 2.25 0 00-2.248 2.146M12 8.25a2.25 2.25 0 012.248 2.146M8.683 5a6.032 6.032 0 01-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0115.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 00-.575-1.752M4.921 6a24.048 24.048 0 00-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 01-5.223 1.082"
            />
          </svg>
          <span className="text-lg min-[1920px]:text-2xl font-semibold text-foreground">BTRadio DJ</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
        </div>
      </div>

      {/* Player controls */}
      <div className="flex flex-col items-center gap-6 sm:gap-10 min-[1920px]:gap-14 translate-y-[65px] min-[630px]:translate-y-[90px]">
        {/* Stream status badge — absolute so it never shifts the play button */}
        <div className="relative w-full flex justify-center">
          {(() => {
            const isVisible = streamStatus === 'live' || streamStatus === 'error' || (showPending && (streamStatus === 'connecting' || streamStatus === 'offline'))
            const isError = streamStatus === 'error'
            const isPending = showPending && (streamStatus === 'connecting' || streamStatus === 'offline')
            const dotColor = isError ? 'bg-red-500' : isPending ? 'bg-orange-500' : 'bg-green-500'
            const pingColor = isError ? '' : isPending ? 'bg-orange-400' : 'bg-green-400'
            const showLabel = badgeLabelVisible || badgeDetailsVisible
            const showDetails = badgeDetailsVisible
            return (
              <div
                role="status"
                aria-live="polite"
                className={`absolute bottom-full mb-6 sm:mb-4 min-[1920px]:mb-14 glass flex items-center justify-center rounded-full p-2 transition-all duration-700 ease-in-out ${
                  isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                } ${showLabel ? 'gap-2 px-4' : 'gap-0'}`}
              >
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  {pingColor && (
                    <span className={`${isPending ? 'animate-pulse' : 'animate-ping'} absolute inline-flex h-full w-full rounded-full ${pingColor} opacity-75`} />
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`} />
                </span>
                <span
                  className={`text-sm font-medium tracking-wide whitespace-nowrap overflow-hidden transition-all duration-700 ease-in-out ${
                    isError ? 'text-red-400' : isPending ? 'text-orange-400' : 'text-foreground'
                  } ${showLabel ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}
                >
                  {isError ? 'ERROR' : isPending ? 'PENDING' : 'LIVE'}
                </span>
                {isError ? (
                  <span
                    className={`text-sm text-muted-foreground whitespace-nowrap overflow-hidden transition-all duration-700 ease-in-out ${
                      showDetails ? 'max-w-[300px] opacity-100' : 'max-w-0 opacity-0'
                    }`}
                  >
                    {lastError || 'Stream unavailable'}
                  </span>
                ) : isPending ? (
                  <span
                    className={`text-sm text-muted-foreground whitespace-nowrap overflow-hidden transition-all duration-700 ease-in-out ${
                      showDetails ? 'max-w-[300px] opacity-100' : 'max-w-0 opacity-0'
                    }`}
                  >
                    We apologize, something went wrong
                  </span>
                ) : (
                  <span
                    className="overflow-hidden inline-block"
                    style={{
                      width: showDetails ? rotatingWidth : 0,
                      opacity: showDetails ? 1 : 0,
                      transition: 'width 500ms ease-in-out, opacity 700ms ease-in-out',
                    }}
                  >
                    <span
                      ref={rotatingRef}
                      className={`text-sm text-muted-foreground whitespace-nowrap inline-block ${
                        rotatingPhase === 'visible' ? 'slide-visible' : rotatingPhase === 'exiting' ? 'slide-out' : 'slide-in'
                      }`}
                    >
                      {rotatingText}
                    </span>
                  </span>
                )}
              </div>
            )
          })()}
        </div>

        <GlassPlayButton
          isPlaying={isPlaying}
          isBuffering={isBuffering}
          disabled={streamStatus === 'offline'}
          onToggle={togglePlay}
          theme={resolvedTheme}
          coverArt={nowPlaying?.art}
          hasValidMeta={hasValidMeta}
        />
        <ActionButtons
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onPopOut={handlePopOut}
          onMore={() => {}}
          hideMute={isMobile}
        />
        {!isMobile && <VolumeSlider volume={volume} onChange={setVolume} />}
      </div>

      <span
        className="fixed bottom-4 left-0 right-0 text-center text-xs"
        style={{ color: resolvedTheme === 'light' ? 'hsl(0 0% 1% / 50%)' : 'hsl(0 0% 99% / 50%)' }}
      >
        &copy; {new Date().getFullYear()} BonnyTone Radio
      </span>
    </div>
  )
}
