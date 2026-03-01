import { useState, useEffect, useRef, useMemo } from 'react'

interface RotatingItem {
  text: string
  duration: number
}

type Phase = 'visible' | 'exiting' | 'entering'

export function useRotatingText(items: RotatingItem[]) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('visible')
  const [width, setWidth] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const measureRef = useRef<HTMLSpanElement>(null)

  // Stable identity for items array — only change when contents change
  const stableItems = useMemo(() => items, [JSON.stringify(items)])

  // Reset when items change
  useEffect(() => {
    setIndex(0)
    setPhase('visible')
  }, [stableItems])

  // Measure text width whenever text changes
  const safeIndex = index < stableItems.length ? index : 0
  const text = stableItems[safeIndex]?.text ?? ''

  useEffect(() => {
    if (measureRef.current) {
      setWidth(measureRef.current.scrollWidth)
    }
  }, [text])

  useEffect(() => {
    if (stableItems.length <= 1) return

    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }

    if (phase === 'visible') {
      const current = stableItems[index]
      if (!current) return
      timerRef.current = setTimeout(() => {
        setPhase('exiting')
      }, current.duration)
    } else if (phase === 'exiting') {
      timerRef.current = setTimeout(() => {
        setIndex((prev) => (prev + 1) % stableItems.length)
        setPhase('entering')
      }, 500)
    } else if (phase === 'entering') {
      rafRef.current = requestAnimationFrame(() => {
        setPhase('visible')
      })
    }

    return clear
  }, [phase, index, stableItems])

  return { text, phase, measureRef, width }
}
