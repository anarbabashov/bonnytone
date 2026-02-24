'use client'

import { Play, Pause, Loader2 } from "lucide-react"

interface GlassPlayButtonProps {
  isPlaying: boolean
  isBuffering: boolean
  disabled?: boolean
  onToggle: () => void
  theme?: string
}

export default function GlassPlayButton({ isPlaying, isBuffering, disabled, onToggle, theme }: GlassPlayButtonProps) {
  const isDark = theme !== "light"

  const glassStyle = isDark
    ? {
        background: "hsla(220, 20%, 12%, 0.15)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid hsla(210, 20%, 40%, 0.15)",
        boxShadow: isPlaying
          ? "0 0 30px hsla(180, 60%, 50%, 0.2), 0 0 80px hsla(180, 60%, 50%, 0.08)"
          : "0 8px 32px hsla(220, 20%, 6%, 0.3)",
        animation: isPlaying && !isBuffering ? "pulse-glow 3s ease-in-out infinite" : "none",
      }
    : {
        background: "hsla(220, 10%, 92%, 0.35)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid hsla(220, 10%, 75%, 0.3)",
        boxShadow: isPlaying
          ? "0 0 30px hsla(180, 60%, 40%, 0.15), 0 0 80px hsla(180, 60%, 40%, 0.06)"
          : "0 8px 32px hsla(220, 10%, 50%, 0.15)",
        animation: isPlaying && !isBuffering ? "pulse-glow 3s ease-in-out infinite" : "none",
      }

  const icon = isBuffering ? (
    <Loader2
      className="w-16 h-16 sm:w-20 sm:h-20 text-foreground animate-spin"
      strokeWidth={1}
    />
  ) : isPlaying ? (
    <Pause
      className="w-16 h-16 sm:w-20 sm:h-20 text-foreground transition-transform duration-200 group-hover:scale-110"
      strokeWidth={1}
    />
  ) : (
    <Play
      className="w-16 h-16 sm:w-20 sm:h-20 text-foreground fill-foreground ml-2 transition-transform duration-200 group-hover:scale-110"
    />
  )

  const label = isBuffering ? "Buffering" : isPlaying ? "Pause" : "Play"

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`group relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}`}
      style={glassStyle}
      aria-label={label}
      suppressHydrationWarning
    >
      {icon}
    </button>
  )
}
