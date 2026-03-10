'use client'

import { useState } from "react"
import { VolumeX, Volume2, ArrowUpRight, Share2, Check } from "lucide-react"

interface ActionButtonsProps {
  isMuted: boolean
  onToggleMute: () => void
  onPopOut: () => void
  hideMute?: boolean
}

export default function ActionButtons({ isMuted, onToggleMute, onPopOut, hideMute }: ActionButtonsProps) {
  const [shared, setShared] = useState(false)

  const handleShare = async () => {
    const shareData = {
      title: 'BonnyTone Radio',
      text: 'Listen to BonnyTone Radio — Miami Club & House Music 24/7',
      url: window.location.origin,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(shareData.url)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    }
  }

  const btnBase =
    "w-12 h-12 sm:w-14 sm:h-14 min-[1920px]:w-18 min-[1920px]:h-18 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div role="toolbar" aria-label="Player controls" className="flex items-center gap-5 sm:gap-7 min-[1920px]:gap-10">
      {!hideMute && (
        <button
          onClick={onToggleMute}
          className={`${btnBase} ${
            isMuted
              ? "glass text-primary"
              : "glass-subtle text-muted-foreground hover:text-foreground"
          }`}
          aria-label={isMuted ? "Unmute" : "Mute"}
          aria-pressed={isMuted}
        >
          {isMuted ? (
            <VolumeX className="w-6 h-6 sm:w-7 sm:h-7 min-[1920px]:w-9 min-[1920px]:h-9" strokeWidth={1.5} />
          ) : (
            <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 min-[1920px]:w-9 min-[1920px]:h-9" strokeWidth={1.5} />
          )}
        </button>
      )}

      <button
        onClick={onPopOut}
        className={`${btnBase} glass-subtle text-muted-foreground hover:text-foreground`}
        aria-label="Open mini player"
      >
        <ArrowUpRight className="w-6 h-6 sm:w-7 sm:h-7 min-[1920px]:w-9 min-[1920px]:h-9" strokeWidth={1.5} />
      </button>

      <button
        onClick={handleShare}
        className={`${btnBase} ${shared ? "glass text-primary" : "glass-subtle text-muted-foreground hover:text-foreground"}`}
        aria-label="Share radio"
      >
        {shared ? (
          <Check className="w-6 h-6 sm:w-7 sm:h-7 min-[1920px]:w-9 min-[1920px]:h-9" strokeWidth={1.5} />
        ) : (
          <Share2 className="w-6 h-6 sm:w-7 sm:h-7 min-[1920px]:w-9 min-[1920px]:h-9" strokeWidth={1.5} />
        )}
      </button>
    </div>
  )
}
