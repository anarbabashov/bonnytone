'use client'

import { useContext } from 'react'
import { PlayerContext } from '@/components/player/PlayerProvider'

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
