'use client'

import { usePathname } from 'next/navigation'
import { usePlayerStore } from '@/store/playerStore'
import { usePlayer } from '@/hooks/usePlayer'
import { useAuth } from '@/lib/auth/AuthContext'
import { useMobilePlatform } from '@/hooks/useMobilePlatform'
import { Play, Pause, Volume, Volume2, VolumeX } from 'lucide-react'

export default function PersistentBottomBar() {
  const pathname = usePathname()
  const { togglePlay } = usePlayer()
  const { isAuthenticated } = useAuth()
  const isMobile = useMobilePlatform()

  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const streamStatus = usePlayerStore((s) => s.streamStatus)
  const nowPlaying = usePlayerStore((s) => s.nowPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const setVolume = usePlayerStore((s) => s.setVolume)

  // Hidden on homepage, mini player, and when player was never activated
  if (pathname === '/' || pathname === '/mini-player' || streamStatus === 'idle') return null

  const statusDot =
    streamStatus === 'live'
      ? 'bg-green-500'
      : streamStatus === 'connecting'
        ? 'bg-yellow-500 animate-pulse'
        : 'bg-muted-foreground'

  const effectiveVolume = isMuted ? 0 : volume
  const lowActive = effectiveVolume > 0 && effectiveVolume <= 0.33
  const muted = effectiveVolume === 0
  const highActive = effectiveVolume > 0.66
  const fillOpacity = effectiveVolume * 0.5

  const decrease = () => setVolume(Math.max(0, Math.round((volume - 0.1) * 10) / 10))
  const increase = () => setVolume(Math.min(1, Math.round((volume + 0.1) * 10) / 10))

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-16 glass border-t border-border/50">
      <div className="flex items-center h-full px-4 gap-4 max-w-[960px] mx-auto">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={streamStatus === 'offline'}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors disabled:opacity-50"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isBuffering ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 text-primary" />
          ) : (
            <Play className="w-5 h-5 text-primary ml-0.5" />
          )}
        </button>

        {/* Now Playing Info — track details only for logged-in users */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {isAuthenticated ? (
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {nowPlaying?.title || 'BTRadio DJ'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {nowPlaying?.artist || 'Live Stream'}
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">BTRadio DJ</p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
                {streamStatus === 'live' ? 'Live Stream' : streamStatus}
              </p>
            </div>
          )}
          {isAuthenticated && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full ${statusDot}`} />
              <span className="text-xs text-muted-foreground uppercase tracking-wide hidden sm:inline">
                {streamStatus === 'live' ? 'LIVE' : streamStatus}
              </span>
            </div>
          )}
        </div>

        {/* Volume — hidden on mobile (iOS/Android control volume via hardware) */}
        {!isMobile && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={decrease}
              className="transition-colors duration-200 cursor-pointer focus:outline-none"
              aria-label={muted ? 'Muted' : 'Decrease volume'}
            >
              {muted ? (
                <VolumeX className="w-5 h-5 text-foreground" />
              ) : (
                <Volume
                  className={`w-5 h-5 transition-colors duration-200 ${
                    lowActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                />
              )}
            </button>

            <div className="relative w-28 sm:w-40 h-8 flex items-center" style={{ touchAction: 'pan-x' }}>
              <div className="absolute w-full h-1.5 rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${effectiveVolume * 100}%`,
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                    opacity: fillOpacity,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={effectiveVolume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="absolute w-full h-8 opacity-0 cursor-pointer"
                aria-label="Volume"
              />
              <div
                className="absolute w-4 h-4 rounded-full bg-foreground shadow-lg pointer-events-none"
                style={{ left: `calc(${effectiveVolume * 100}% - 8px)` }}
              />
            </div>

            <button
              onClick={increase}
              className="transition-colors duration-200 cursor-pointer focus:outline-none"
              aria-label="Increase volume"
            >
              <Volume2
                className={`w-5 h-5 transition-colors duration-200 ${
                  highActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
