'use client'

import { Volume, Volume2, VolumeX } from "lucide-react"

interface VolumeSliderProps {
  volume: number
  onChange: (v: number) => void
}

export default function VolumeSlider({ volume, onChange }: VolumeSliderProps) {
  const lowActive = volume > 0 && volume <= 0.33
  const highActive = volume > 0.66
  const muted = volume === 0

  const decrease = () => onChange(Math.max(0, Math.round((volume - 0.1) * 10) / 10))
  const increase = () => onChange(Math.min(1, Math.round((volume + 0.1) * 10) / 10))

  // Scale fill opacity: 100% vol → 0.5 opacity, 50% vol → 0.25, smooth linear
  const fillOpacity = volume * 0.5

  return (
    <div role="group" aria-label="Volume control" className="flex items-center gap-3 min-[1920px]:gap-5 w-80 sm:w-96 min-[1920px]:w-[32rem]">
      <button
        onClick={decrease}
        className="transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-full"
        aria-label={muted ? "Muted" : "Decrease volume"}
      >
        {muted ? (
          <VolumeX className="w-7 h-7 min-[1920px]:w-9 min-[1920px]:h-9 text-foreground" />
        ) : (
          <Volume
            className={`w-7 h-7 min-[1920px]:w-9 min-[1920px]:h-9 transition-colors duration-200 ${
              lowActive ? "text-foreground" : "text-muted-foreground"
            }`}
          />
        )}
      </button>

      <div className="relative flex-1 h-10 flex items-center group" style={{ touchAction: 'pan-x' }}>
        <div className="absolute w-full h-1.5 min-[1920px]:h-2 rounded-full bg-muted/40">
          <div
            className="h-full rounded-full"
            style={{
              width: `${volume * 100}%`,
              background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))`,
              opacity: fillOpacity,
            }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute w-full h-10 opacity-0 cursor-pointer"
          aria-label="Volume"
          aria-valuetext={`${Math.round(volume * 100)}%`}
        />
        <div
          className="absolute w-6 h-6 min-[1920px]:w-8 min-[1920px]:h-8 rounded-full bg-foreground shadow-lg pointer-events-none"
          style={{ left: `calc(${volume * 100}% - 12px)` }}
        />
      </div>

      <button
        onClick={increase}
        className="transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-full"
        aria-label="Increase volume"
      >
        <Volume2
          className={`w-7 h-7 min-[1920px]:w-9 min-[1920px]:h-9 transition-colors duration-200 ${
            highActive ? "text-foreground" : "text-muted-foreground"
          }`}
        />
      </button>
    </div>
  )
}
