import { create } from 'zustand'

const VOLUME_KEY = 'btradio-volume'

function saveVolume(volume: number, isMuted: boolean, previousVolume: number) {
  try {
    localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume, isMuted, previousVolume }))
  } catch { /* ignore */ }
}

export type Quality = 'auto' | 'low' | 'medium' | 'high'
export type StreamStatus = 'idle' | 'connecting' | 'live' | 'offline' | 'error'

export interface NowPlayingInfo {
  title: string
  artist: string
  art: string | null
}

export interface SongInfo {
  id: string
  title: string
  artist: string
  album: string
  genre: string
  art: string | null
  text: string
  lyrics: string
}

export interface NowPlayingTrack {
  song: SongInfo
  duration: number
  elapsed: number
  remaining: number
  playlist: string
  streamer: string
  isRequest: boolean
}

export interface FullNowPlaying {
  currentTrack: NowPlayingTrack
  nextTrack: NowPlayingTrack | null
  isLive: boolean
  listenersCurrent: number
  listenersTotal: number
  listenersUnique: number
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
  fullNowPlaying: FullNowPlaying | null
  stationDescription: string | null

  // Stream quality
  currentBitrate: number | null

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
  setFullNowPlaying: (info: FullNowPlaying | null) => void
  setStationDescription: (desc: string | null) => void
  setCurrentBitrate: (bitrate: number | null) => void
  setError: (error: string | null) => void
  incrementErrorCount: () => void
  resetErrorCount: () => void
  hydrateVolume: () => void
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
  fullNowPlaying: null,
  stationDescription: null,
  currentBitrate: null,
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
    const prev = clamped > 0 ? clamped : get().previousVolume
    set({ volume: clamped, isMuted: clamped === 0, previousVolume: prev })
    saveVolume(clamped, clamped === 0, prev)
  },

  toggleMute: () => {
    const { isMuted, previousVolume } = get()
    if (isMuted) {
      set({ volume: previousVolume, isMuted: false })
      saveVolume(previousVolume, false, previousVolume)
    } else {
      const cur = get().volume
      set({ previousVolume: cur, volume: 0, isMuted: true })
      saveVolume(0, true, cur)
    }
  },

  setQuality: (quality: Quality) => set({ quality }),

  // Internal state setters (used by useRadioPlayer hook)
  setIsPlaying: (isPlaying: boolean) => set({ isPlaying }),
  setIsBuffering: (isBuffering: boolean) => set({ isBuffering }),
  setStreamStatus: (streamStatus: StreamStatus) => set({ streamStatus }),
  setListenerCount: (listenerCount: number | null) => set({ listenerCount }),
  setNowPlaying: (nowPlaying: NowPlayingInfo | null) => set({ nowPlaying }),
  setFullNowPlaying: (fullNowPlaying: FullNowPlaying | null) => set({ fullNowPlaying }),
  setStationDescription: (stationDescription: string | null) => set({ stationDescription }),
  setCurrentBitrate: (currentBitrate: number | null) => set({ currentBitrate }),
  setError: (lastError: string | null) => set({ lastError }),
  incrementErrorCount: () => set((s) => ({ errorCount: s.errorCount + 1 })),
  resetErrorCount: () => set({ errorCount: 0, lastError: null }),
  hydrateVolume: () => {
    try {
      const raw = localStorage.getItem(VOLUME_KEY)
      if (raw) {
        const v = JSON.parse(raw)
        set({
          volume: v.volume ?? 0.7,
          isMuted: v.isMuted ?? false,
          previousVolume: v.previousVolume ?? 0.7,
        })
      }
    } catch { /* ignore */ }
  },
}))
