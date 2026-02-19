'use client'

import { useTheme } from "next-themes"
import { usePlayerStore } from "@/store/playerStore"
import { useRadioPlayer } from "@/hooks/useRadioPlayer"
import Waveform from "@/components/radio/Waveform"
import GlassPlayButton from "@/components/radio/GlassPlayButton"
import ActionButtons from "@/components/radio/ActionButtons"
import VolumeSlider from "@/components/radio/VolumeSlider"
import AuthButtons from "@/components/layout/AuthButtons"
import ThemeToggle from "@/components/layout/ThemeToggle/ThemeToggle"

export default function Home() {
  const { resolvedTheme } = useTheme()
  const { analyserNode } = useRadioPlayer()

  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const toggleMute = usePlayerStore((s) => s.toggleMute)

  const handleShare = async () => {
    const shareData = {
      title: 'Bonny Tone Radio',
      text: 'Listen to Bonny Tone Radio',
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
    <div className="relative h-screen overflow-hidden flex flex-col items-center justify-center px-4">
      <Waveform
        isPlaying={isPlaying}
        volume={isMuted ? 0 : volume}
        theme={resolvedTheme}
        analyserNode={analyserNode}
      />

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
