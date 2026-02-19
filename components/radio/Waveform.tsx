'use client'

import { useEffect, useRef } from "react"

interface WaveformProps {
  isPlaying: boolean
  volume: number
  theme?: string
  analyserNode?: AnalyserNode | null
}

export default function Waveform({ isPlaying, volume, theme, analyserNode }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const animRef = useRef<number>()
  const frequencyDataRef = useRef<Uint8Array | null>(null)

  useEffect(() => {
    if (analyserNode) {
      frequencyDataRef.current = new Uint8Array(analyserNode.frequencyBinCount)
    } else {
      frequencyDataRef.current = null
    }
  }, [analyserNode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const isDark = theme !== "light"

    const drawHalftoneWave = () => {
      const gridSize = 20
      const rows = Math.ceil(canvas.height / gridSize)
      const cols = Math.ceil(canvas.width / gridSize)
      const t = timeRef.current
      const baseIntensity = isPlaying ? 0.3 + volume * 0.7 : 0.15

      // Get real frequency data if analyser is available and playing
      let hasRealData = false
      const freqData = frequencyDataRef.current
      if (analyserNode && freqData && isPlaying) {
        analyserNode.getByteFrequencyData(freqData)
        // Check if we're getting real data (Safari may return all zeros)
        const sum = freqData[0] + freqData[1] + freqData[2] + freqData[3]
        hasRealData = sum > 0
      }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cx = x * gridSize
          const cy = y * gridSize
          const dist = Math.sqrt(
            (cx - canvas.width / 2) ** 2 + (cy - canvas.height / 2) ** 2
          )
          const maxDist = Math.sqrt(
            (canvas.width / 2) ** 2 + (canvas.height / 2) ** 2
          )
          const norm = dist / maxDist

          let intensity = baseIntensity
          let waveOffset: number

          if (hasRealData && freqData) {
            // Map grid position to frequency bin
            const binIndex = Math.floor(norm * (freqData.length - 1))
            const freqValue = freqData[binIndex] / 255
            waveOffset = freqValue
            intensity = baseIntensity * (0.5 + freqValue * 0.5)
          } else {
            // Fallback: mathematical animation
            waveOffset = Math.sin(norm * 10 - t) * 0.5 + 0.5
          }

          const size = gridSize * waveOffset * 0.8 * intensity * 2

          ctx.beginPath()
          ctx.arc(cx, cy, Math.max(size / 2, 0), 0, Math.PI * 2)

          const hue = 180 + Math.sin(t * 0.15 + norm * 3) * 40
          if (isDark) {
            const lightness = 50 + Math.sin(t * 0.1 + norm * 2) * 10
            const alpha = waveOffset * intensity
            ctx.fillStyle = `hsla(${hue}, 70%, ${lightness}%, ${alpha})`
          } else {
            const lightness = 40 + Math.sin(t * 0.1 + norm * 2) * 10
            const alpha = waveOffset * intensity * 0.6
            ctx.fillStyle = `hsla(${hue}, 55%, ${lightness}%, ${alpha})`
          }
          ctx.fill()
        }
      }
    }

    const animate = () => {
      const t = timeRef.current

      if (isDark) {
        const r = Math.round(5 + Math.sin(t * 0.08) * 5)
        const g = Math.round(5 + Math.sin(t * 0.06 + 1) * 5)
        const b = Math.round(12 + Math.sin(t * 0.1 + 2) * 8)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.12)`
      } else {
        const r = Math.round(245 + Math.sin(t * 0.08) * 8)
        const g = Math.round(245 + Math.sin(t * 0.06 + 1) * 8)
        const b = Math.round(248 + Math.sin(t * 0.1 + 2) * 6)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.12)`
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      drawHalftoneWave()
      timeRef.current += isPlaying ? 0.05 : 0.015
      animRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [isPlaying, volume, theme, analyserNode])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      aria-hidden="true"
    />
  )
}
