'use client'

import { VolumeX, Volume2, ArrowUpRight, MoreHorizontal } from "lucide-react"

interface ActionButtonsProps {
  isMuted: boolean
  onToggleMute: () => void
  onShare: () => void
  onMore: () => void
}

export default function ActionButtons({ isMuted, onToggleMute, onShare, onMore }: ActionButtonsProps) {
  const btnBase =
    "w-12 h-12 sm:w-14 sm:h-14 min-[1920px]:w-18 min-[1920px]:h-18 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="flex items-center gap-5 sm:gap-7 min-[1920px]:gap-10">
      <button
        onClick={onToggleMute}
        className={`${btnBase} ${
          isMuted
            ? "glass text-primary"
            : "glass-subtle text-muted-foreground hover:text-foreground"
        }`}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <VolumeX className="w-6 h-6 sm:w-7 sm:h-7 min-[1920px]:w-9 min-[1920px]:h-9" strokeWidth={1.5} />
        ) : (
          <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 min-[1920px]:w-9 min-[1920px]:h-9" strokeWidth={1.5} />
        )}
      </button>

      <button
        onClick={onShare}
        className={`${btnBase} glass-subtle text-muted-foreground hover:text-foreground`}
        aria-label="Share"
      >
        <ArrowUpRight className="w-6 h-6 sm:w-7 sm:h-7 min-[1920px]:w-9 min-[1920px]:h-9" strokeWidth={1.5} />
      </button>

      <button
        onClick={onMore}
        className={`${btnBase} glass-subtle text-muted-foreground hover:text-foreground`}
        aria-label="More options"
      >
        <MoreHorizontal className="w-6 h-6 sm:w-7 sm:h-7 min-[1920px]:w-9 min-[1920px]:h-9" strokeWidth={1.5} />
      </button>
    </div>
  )
}
