import { create } from 'zustand'

export type Quality = 'auto' | 'low' | 'medium' | 'high'
export type StreamStatus = 'idle' | 'connecting' | 'live' | 'offline' | 'error'

export interface NowPlayingInfo {
  title: string
  artist: string
  art: string | null
}

export interface PlayerState {
  // Playback
  isPlaying: boolean
  isBuffering: boolean
  volume: number
  isMuted: boolean
  previousVolume: number
  quality: Quality

  // Stream
  streamStatus: StreamStatus
  listenerCount: number | null
  nowPlaying: NowPlayingInfo | null

  // Error
  errorCount: number
  lastError: string | null

  // Actions
  play: () => void
  pause: () => void
  togglePlay: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setQuality: (quality: Quality) => void
  setIsPlaying: (isPlaying: boolean) => void
  setIsBuffering: (isBuffering: boolean) => void
  setStreamStatus: (status: StreamStatus) => void
  setListenerCount: (count: number | null) => void
  setNowPlaying: (info: NowPlayingInfo | null) => void
  setError: (error: string | null) => void
  incrementErrorCount: () => void
  resetErrorCount: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  isPlaying: false,
  isBuffering: false,
  volume: 0.7,
  isMuted: false,
  previousVolume: 0.7,
  quality: 'auto',
  streamStatus: 'idle',
  listenerCount: null,
  nowPlaying: null,
  errorCount: 0,
  lastError: null,

  // Playback actions
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => {
    const { isPlaying } = get()
    set({ isPlaying: !isPlaying })
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    set({
      volume: clamped,
      isMuted: clamped === 0,
      previousVolume: clamped > 0 ? clamped : get().previousVolume,
    })
  },

  toggleMute: () => {
    const { isMuted, previousVolume } = get()
    if (isMuted) {
      set({ volume: previousVolume, isMuted: false })
    } else {
      set({ previousVolume: get().volume, volume: 0, isMuted: true })
    }
  },

  setQuality: (quality: Quality) => set({ quality }),

  // Internal state setters (used by useRadioPlayer hook)
  setIsPlaying: (isPlaying: boolean) => set({ isPlaying }),
  setIsBuffering: (isBuffering: boolean) => set({ isBuffering }),
  setStreamStatus: (streamStatus: StreamStatus) => set({ streamStatus }),
  setListenerCount: (listenerCount: number | null) => set({ listenerCount }),
  setNowPlaying: (nowPlaying: NowPlayingInfo | null) => set({ nowPlaying }),
  setError: (lastError: string | null) => set({ lastError }),
  incrementErrorCount: () => set((s) => ({ errorCount: s.errorCount + 1 })),
  resetErrorCount: () => set({ errorCount: 0, lastError: null }),
}))
