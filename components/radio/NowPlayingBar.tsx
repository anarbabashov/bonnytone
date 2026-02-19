'use client'

import { Users } from 'lucide-react'
import type { NowPlayingInfo } from '@/store/playerStore'

interface NowPlayingBarProps {
  nowPlaying: NowPlayingInfo | null
  listenerCount: number | null
}

export default function NowPlayingBar({ nowPlaying, listenerCount }: NowPlayingBarProps) {
  if (!nowPlaying) return null

  return (
    <div className="flex flex-col items-center gap-2 max-w-sm">
      <div className="text-center">
        <p className="text-sm font-medium text-foreground truncate max-w-[280px] sm:max-w-[360px]">
          {nowPlaying.title}
        </p>
        <p className="text-xs text-muted-foreground truncate max-w-[280px] sm:max-w-[360px]">
          {nowPlaying.artist}
        </p>
      </div>
      {listenerCount !== null && listenerCount > 0 && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="w-3 h-3" strokeWidth={1.5} />
          <span className="text-xs">
            {listenerCount} {listenerCount === 1 ? 'listener' : 'listeners'}
          </span>
        </div>
      )}
    </div>
  )
}
