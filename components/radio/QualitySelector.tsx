'use client'

import type { Quality } from '@/store/playerStore'

interface QualitySelectorProps {
  quality: Quality
  onChange: (quality: Quality) => void
}

const QUALITY_ORDER: Quality[] = ['auto', 'low', 'medium', 'high']

const QUALITY_LABELS: Record<Quality, string> = {
  auto: 'AUTO',
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
}

export default function QualitySelector({ quality, onChange }: QualitySelectorProps) {
  const handleCycle = () => {
    const currentIndex = QUALITY_ORDER.indexOf(quality)
    const nextIndex = (currentIndex + 1) % QUALITY_ORDER.length
    onChange(QUALITY_ORDER[nextIndex])
  }

  return (
    <button
      onClick={handleCycle}
      className="glass-subtle px-3 py-1 rounded-full transition-all duration-200 hover:bg-[hsla(var(--glass-bg)/0.35)] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Stream quality: ${quality}. Click to change.`}
    >
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {QUALITY_LABELS[quality]}
      </span>
    </button>
  )
}
