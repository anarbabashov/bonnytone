'use client'

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { usePlayerStore } from "@/store/playerStore"
import { usePlayer } from "@/hooks/usePlayer"
import Waveform from "@/components/radio/Waveform"
import GlassPlayButton from "@/components/radio/GlassPlayButton"
import ActionButtons from "@/components/radio/ActionButtons"
import VolumeSlider from "@/components/radio/VolumeSlider"
import ThemeToggle from "@/components/layout/ThemeToggle/ThemeToggle"

export default function Home() {
  const { resolvedTheme } = useTheme()
  const { togglePlay, analyserNode } = usePlayer()

  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const streamStatus = usePlayerStore((s) => s.streamStatus)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const toggleMute = usePlayerStore((s) => s.toggleMute)

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

  const handleShare = async () => {
    const shareData = {
      title: 'BTRadio DJ',
      text: 'Listen to BTRadio DJ',
      url: window.location.origin,
    }

    try {
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.origin)
      }
    } catch {
      // User cancelled share or clipboard failed -- ignore
    }
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
        <GlassPlayButton
          isPlaying={isPlaying}
          isBuffering={isBuffering}
          disabled={streamStatus === 'offline'}
          onToggle={togglePlay}
          theme={resolvedTheme}
        />
        <ActionButtons
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onShare={handleShare}
          onMore={() => {}}
        />
        <VolumeSlider volume={volume} onChange={setVolume} />
      </div>

    </div>
  )
}
