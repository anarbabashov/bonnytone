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

  return (
    <div className="flex items-center gap-4 w-80 sm:w-96">
      <button
        onClick={() => onChange(volume > 0 ? 0 : 0.7)}
        className="transition-colors duration-200 cursor-pointer focus:outline-none"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? (
          <VolumeX className="w-7 h-7 text-foreground" />
        ) : (
          <Volume
            className={`w-7 h-7 transition-colors duration-200 ${
              lowActive ? "text-foreground" : "text-muted-foreground"
            }`}
          />
        )}
      </button>

      <div className="relative flex-1 h-10 flex items-center group">
        <div className="absolute w-full h-1.5 rounded-full bg-muted/40">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${volume * 100}%`,
              background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))`,
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
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-foreground shadow-lg pointer-events-none transition-all duration-150 group-hover:scale-125"
          style={{ left: `calc(${volume * 100}% - 8px)` }}
        />
      </div>

      <Volume2
        className={`w-7 h-7 transition-colors duration-200 ${
          highActive ? "text-foreground" : "text-muted-foreground"
        }`}
      />
    </div>
  )
}
