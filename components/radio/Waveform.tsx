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

    // Frequency band colors (center → edge = low freq → high freq)
    // Sub bass → Low bass → Mid bass → Upper bass → Low mids → Mids → High mids → Highs
    const BAND_COLORS = [
      { h: 260, s: 75, l: 55 },  // Sub bass (<20Hz)     — purple
      { h: 220, s: 80, l: 50 },  // Low bass (20-60Hz)   — blue
      { h: 195, s: 85, l: 50 },  // Mid bass (60-120Hz)  — cyan-blue
      { h: 170, s: 80, l: 45 },  // Upper bass (120-250Hz) — teal
      { h: 140, s: 70, l: 45 },  // Low mids (250-800Hz) — green
      { h: 50,  s: 85, l: 50 },  // Mids (800Hz-2kHz)    — yellow
      { h: 25,  s: 90, l: 50 },  // High mids (2-6kHz)   — orange
      { h: 350, s: 80, l: 55 },  // Highs (6-20kHz)      — red/magenta
    ]

    const getBandColor = (norm: number, t: number) => {
      const bandPos = Math.min(norm, 1) * (BAND_COLORS.length - 1)
      const bandIdx = Math.floor(bandPos)
      const bandFrac = bandPos - bandIdx
      const c1 = BAND_COLORS[Math.min(bandIdx, BAND_COLORS.length - 1)]
      const c2 = BAND_COLORS[Math.min(bandIdx + 1, BAND_COLORS.length - 1)]
      // Interpolate between adjacent bands
      const h = c1.h + (c2.h - c1.h) * bandFrac + Math.sin(t * 0.1) * 8
      const s = c1.s + (c2.s - c1.s) * bandFrac
      const l = c1.l + (c2.l - c1.l) * bandFrac
      return { h, s, l }
    }

    const drawHalftoneWave = () => {
      const gridSize = 16
      const rows = Math.ceil(canvas.height / gridSize)
      const cols = Math.ceil(canvas.width / gridSize)
      const t = timeRef.current
      const baseIntensity = isPlaying ? 0.12 + volume * 0.1 : 0.08

      // Get real frequency data if analyser is available and playing
      let hasRealData = false
      const freqData = frequencyDataRef.current
      if (analyserNode && freqData && isPlaying) {
        analyserNode.getByteFrequencyData(freqData)
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
          // Large radius so dot pattern fills entire viewport
          const maxDist = Math.max(canvas.width, canvas.height) * 0.6
          const norm = dist / maxDist

          let intensity = baseIntensity
          let waveOffset: number

          if (hasRealData && freqData) {
            // Low frequencies (bass) near center, highs at edges
            const binIndex = Math.floor(Math.min(norm, 1) * (freqData.length - 1))
            const freqValue = freqData[binIndex] / 255
            waveOffset = freqValue
            intensity = baseIntensity * (0.5 + freqValue * 0.4)
          } else {
            // Fallback: mathematical animation
            waveOffset = Math.sin(norm * 10 - t) * 0.5 + 0.5
          }

          const size = gridSize * waveOffset * 0.8 * intensity * 3

          ctx.beginPath()
          ctx.arc(cx, cy, Math.max(size / 2, 0), 0, Math.PI * 2)

          const { h, s, l } = getBandColor(norm, t)
          if (isDark) {
            const alpha = Math.min(waveOffset * intensity * 1.2, 0.45)
            ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${alpha})`
          } else {
            const alpha = Math.min(waveOffset * intensity, 0.4)
            ctx.fillStyle = `hsla(${h}, ${s}%, ${l - 5}%, ${alpha})`
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
