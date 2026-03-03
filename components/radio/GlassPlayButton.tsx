'use client'

import { useState, useEffect } from "react"
import { Play, Pause, Loader2 } from "lucide-react"

interface GlassPlayButtonProps {
  isPlaying: boolean
  isBuffering: boolean
  disabled?: boolean
  onToggle: () => void
  theme?: string
  coverArt?: string | null
  hasValidMeta?: boolean
}

export default function GlassPlayButton({ isPlaying, isBuffering, disabled, onToggle, theme, coverArt, hasValidMeta }: GlassPlayButtonProps) {
  const isDark = theme !== "light"

  // Track whether the cover image actually loaded (handles 404s)
  const [imgLoaded, setImgLoaded] = useState(false)
  useEffect(() => {
    setImgLoaded(false)
  }, [coverArt])

  const showCover = !!coverArt && !!hasValidMeta && imgLoaded

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

  const label = isBuffering ? "Buffering" : isPlaying ? "Pause" : "Play"

  // Hidden preloader — fires onLoad/onError to verify the image is valid
  const preloader = coverArt && hasValidMeta && !imgLoaded ? (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      src={coverArt}
      className="hidden"
      onLoad={() => setImgLoaded(true)}
      onError={() => setImgLoaded(false)}
    />
  ) : null

  // Cover art mode: different icon rendering
  if (showCover) {
    const coverIcon = isBuffering ? (
      <Loader2
        className="w-16 h-16 sm:w-20 sm:h-20 min-[1920px]:w-28 min-[1920px]:h-28 text-white drop-shadow-lg animate-spin"
        strokeWidth={1}
      />
    ) : isPlaying ? (
      <Pause
        className="w-16 h-16 sm:w-20 sm:h-20 min-[1920px]:w-28 min-[1920px]:h-28 text-white drop-shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:scale-110"
        strokeWidth={1}
      />
    ) : (
      <Play
        className="w-16 h-16 sm:w-20 sm:h-20 min-[1920px]:w-28 min-[1920px]:h-28 text-white fill-white drop-shadow-lg ml-2 transition-transform duration-200 group-hover:scale-110"
      />
    )

    const imgFilter = isBuffering
      ? 'blur(12px) brightness(0.75)'
      : isPlaying
        ? 'blur(0px) brightness(1)'
        : 'blur(4px) brightness(0.75)'

    return (
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`group relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 min-[1920px]:w-80 min-[1920px]:h-80 rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}`}
        style={glassStyle}
        aria-label={label}
        aria-pressed={isPlaying}
        suppressHydrationWarning
      >
        {/* Layer 1: Cover art image (plain img — external AzuraCast URLs, small images) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverArt!}
          alt=""
          className="absolute inset-0 w-full h-full object-cover rounded-full transition-all duration-500"
          style={{ filter: imgFilter }}
        />
        {/* Layer 2: Glass overlay */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: isDark
              ? 'hsla(220, 20%, 12%, 0.25)'
              : 'hsla(220, 10%, 92%, 0.25)',
            animation: isPlaying && !isBuffering ? 'pulse-glow 3s ease-in-out infinite' : 'none',
          }}
        />
        {/* Layer 3: Icon */}
        <div className="relative z-10 flex items-center justify-center">
          {coverIcon}
        </div>
      </button>
    )
  }

  // Default mode (no cover art)
  const icon = isBuffering ? (
    <Loader2
      className="w-16 h-16 sm:w-20 sm:h-20 min-[1920px]:w-28 min-[1920px]:h-28 text-foreground animate-spin"
      strokeWidth={1}
    />
  ) : isPlaying ? (
    <Pause
      className="w-16 h-16 sm:w-20 sm:h-20 min-[1920px]:w-28 min-[1920px]:h-28 text-foreground transition-transform duration-200 group-hover:scale-110"
      strokeWidth={1}
    />
  ) : (
    <Play
      className="w-16 h-16 sm:w-20 sm:h-20 min-[1920px]:w-28 min-[1920px]:h-28 text-foreground fill-foreground ml-2 transition-transform duration-200 group-hover:scale-110"
    />
  )

  return (
    <>
      {preloader}
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`group relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 min-[1920px]:w-80 min-[1920px]:h-80 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}`}
        style={glassStyle}
        aria-label={label}
        aria-pressed={isPlaying}
        suppressHydrationWarning
      >
        {icon}
      </button>
    </>
  )
}
