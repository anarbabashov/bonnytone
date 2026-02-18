'use client'

import { useState, useRef } from "react"
import { useTheme } from "next-themes"
import Waveform from "@/components/radio/Waveform"
import GlassPlayButton from "@/components/radio/GlassPlayButton"
import ActionButtons from "@/components/radio/ActionButtons"
import VolumeSlider from "@/components/radio/VolumeSlider"
import AuthButtons from "@/components/layout/AuthButtons"
import ThemeToggle from "@/components/layout/ThemeToggle/ThemeToggle"

export default function Home() {
  const { resolvedTheme } = useTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [isMuted, setIsMuted] = useState(false)
  const prevVolumeRef = useRef(0.7)

  const handleToggleMute = () => {
    if (isMuted) {
      setVolume(prevVolumeRef.current)
      setIsMuted(false)
    } else {
      prevVolumeRef.current = volume
      setVolume(0)
      setIsMuted(true)
    }
  }

  const handleVolumeChange = (v: number) => {
    setVolume(v)
    setIsMuted(v === 0)
  }

  return (
    <div className="relative h-screen overflow-hidden flex flex-col items-center justify-center px-4">
      <Waveform isPlaying={isPlaying} volume={isMuted ? 0 : volume} theme={resolvedTheme} />

      {/* Top bar: Auth + Theme toggle */}
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
        <span className="text-lg font-semibold text-foreground">BonnyTone</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <AuthButtons />
        </div>
      </div>

      {/* Player controls */}
      <div className="flex flex-col items-center gap-8 sm:gap-10 mt-40 sm:mt-40">
        <GlassPlayButton
          isPlaying={isPlaying}
          onToggle={() => setIsPlaying((p) => !p)}
          theme={resolvedTheme}
        />
        <ActionButtons
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onShare={() => {}}
          onMore={() => {}}
        />
        <VolumeSlider volume={volume} onChange={handleVolumeChange} />
      </div>
    </div>
  )
}
