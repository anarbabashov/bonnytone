import { render, act } from '@testing-library/react'
import { usePlayerStore } from '@/store/playerStore'

// --- Mocks ---

jest.mock('@/hooks/useNowPlaying', () => ({
  useNowPlaying: jest.fn(),
}))

// HLS.js mock — use module-scoped fns that survive clearAllMocks
const mockHlsDestroy = jest.fn()
const mockHlsLoadSource = jest.fn()
const mockHlsAttachMedia = jest.fn()
const mockHlsRecoverMediaError = jest.fn()
const mockHlsOn = jest.fn()

jest.mock('hls.js', () => {
  const Hls: any = jest.fn().mockImplementation(() => ({
    destroy: mockHlsDestroy,
    loadSource: mockHlsLoadSource,
    attachMedia: mockHlsAttachMedia,
    recoverMediaError: mockHlsRecoverMediaError,
    on: mockHlsOn,
    levels: [{ bitrate: 48000 }, { bitrate: 128000 }, { bitrate: 256000 }],
    currentLevel: -1,
  }))
  Hls.isSupported = jest.fn().mockReturnValue(true)
  Hls.Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
    FRAG_BUFFERED: 'hlsFragBuffered',
  }
  Hls.ErrorTypes = {
    MEDIA_ERROR: 'mediaError',
    NETWORK_ERROR: 'networkError',
  }
  return Hls
})

import { PlayerProvider } from '@/components/player/PlayerProvider'
import { usePlayer } from '@/hooks/usePlayer'
import Hls from 'hls.js'

// Mock Audio constructor — returns a real DOM element with spied methods
let mockAudioPlay: jest.Mock
let mockAudioPause: jest.Mock
let audioInstance: HTMLAudioElement | null = null

function createMockAudio() {
  const el = document.createElement('audio')
  mockAudioPlay = jest.fn().mockResolvedValue(undefined)
  mockAudioPause = jest.fn()
  el.play = mockAudioPlay
  el.pause = mockAudioPause
  audioInstance = el
  return el
}

// Helper component to access context
function TestConsumer({ onContext }: { onContext: (ctx: ReturnType<typeof usePlayer>) => void }) {
  const ctx = usePlayer()
  onContext(ctx)
  return null
}

// Helper to get HLS event handlers
function getHlsHandler(event: string): Function | undefined {
  const call = mockHlsOn.mock.calls.find((c: any[]) => c[0] === event)
  return call?.[1]
}

function resetStore() {
  usePlayerStore.setState({
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
  })
}

describe('PlayerProvider', () => {
  let contextValue: ReturnType<typeof usePlayer> | null = null

  beforeEach(() => {
    resetStore()
    audioInstance = null
    contextValue = null
    // Reset only call tracking, not implementations
    mockHlsDestroy.mockClear()
    mockHlsLoadSource.mockClear()
    mockHlsAttachMedia.mockClear()
    mockHlsRecoverMediaError.mockClear()
    mockHlsOn.mockClear()
    ;(Hls as jest.Mock).mockClear()
    // Set up Audio constructor
    global.Audio = jest.fn().mockImplementation(() => createMockAudio()) as any
  })

  function renderProvider() {
    return render(
      <PlayerProvider>
        <TestConsumer onContext={(ctx) => { contextValue = ctx }} />
      </PlayerProvider>
    )
  }

  // ─── Audio Quality: No Web Audio API ───

  describe('audio quality (no Web Audio API)', () => {
    it('does not create AudioContext on play', () => {
      const spy = jest.fn()
      ;(global as any).AudioContext = spy

      renderProvider()
      act(() => { contextValue!.play() })
      expect(spy).not.toHaveBeenCalled()

      delete (global as any).AudioContext
    })

    it('does not call createMediaElementSource', () => {
      const mockCMES = jest.fn()
      ;(global as any).AudioContext = jest.fn().mockImplementation(() => ({
        createMediaElementSource: mockCMES,
        createAnalyser: jest.fn(),
        createGain: jest.fn(),
        destination: {},
        state: 'running',
        resume: jest.fn(),
      }))

      renderProvider()
      act(() => { contextValue!.play() })
      expect(mockCMES).not.toHaveBeenCalled()

      delete (global as any).AudioContext
    })

    it('exposes analyserNode as null', () => {
      renderProvider()
      expect(contextValue!.analyserNode).toBeNull()
    })

    it('uses audio.volume for volume control', () => {
      renderProvider()
      act(() => { contextValue!.play() })
      expect(audioInstance!.volume).toBe(0.7)

      act(() => { usePlayerStore.getState().setVolume(0.3) })
      expect(audioInstance!.volume).toBe(0.3)
    })

    it('sets audio.volume to 0 when muted', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      act(() => { usePlayerStore.getState().toggleMute() })
      expect(audioInstance!.volume).toBe(0)
    })

    it('does not set crossOrigin on audio element', () => {
      renderProvider()
      act(() => { contextValue!.play() })
      // crossOrigin should remain unset (null) — not 'anonymous'
      expect(audioInstance!.crossOrigin).toBeNull()
    })
  })

  // ─── Context API ───

  describe('context API', () => {
    it('provides play, pause, togglePlay, analyserNode', () => {
      renderProvider()
      expect(contextValue).toBeTruthy()
      expect(typeof contextValue!.play).toBe('function')
      expect(typeof contextValue!.pause).toBe('function')
      expect(typeof contextValue!.togglePlay).toBe('function')
      expect(contextValue!.analyserNode).toBeNull()
    })

    it('throws when usePlayer is called outside PlayerProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => {
        render(<TestConsumer onContext={() => {}} />)
      }).toThrow('usePlayer must be used within PlayerProvider')
      consoleSpy.mockRestore()
    })
  })

  // ─── Play / Pause ───

  describe('play', () => {
    it('sets isPlaying and isBuffering in store', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      const state = usePlayerStore.getState()
      expect(state.isPlaying).toBe(true)
      expect(state.isBuffering).toBe(true)
    })

    it('creates HLS instance and attaches to audio element', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      expect(Hls).toHaveBeenCalled()
      expect(mockHlsLoadSource).toHaveBeenCalledWith('http://test.com/stream.m3u8')
      expect(mockHlsAttachMedia).toHaveBeenCalledWith(audioInstance)
    })

    it('sets stream status to live on MANIFEST_PARSED', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      const handler = getHlsHandler('hlsManifestParsed')
      expect(handler).toBeTruthy()
      act(() => { handler!() })

      const state = usePlayerStore.getState()
      expect(state.streamStatus).toBe('live')
      expect(state.isBuffering).toBe(false)
      expect(mockAudioPlay).toHaveBeenCalled()
    })

    it('applies store volume to audio element on play', () => {
      usePlayerStore.setState({ volume: 0.5, isMuted: false })
      renderProvider()
      act(() => { contextValue!.play() })
      expect(audioInstance!.volume).toBe(0.5)
    })

    it('applies zero volume when muted on play', () => {
      usePlayerStore.setState({ volume: 0.5, isMuted: true })
      renderProvider()
      act(() => { contextValue!.play() })
      expect(audioInstance!.volume).toBe(0)
    })

    it('reuses existing audio element on second play', () => {
      renderProvider()
      act(() => { contextValue!.play() })
      const firstAudio = audioInstance

      const handler = getHlsHandler('hlsManifestParsed')
      act(() => { handler!() })
      act(() => { contextValue!.pause() })
      act(() => { contextValue!.play() })

      expect(audioInstance).toBe(firstAudio)
    })
  })

  describe('pause', () => {
    it('pauses audio and updates store', () => {
      renderProvider()
      act(() => { contextValue!.play() })
      act(() => { contextValue!.pause() })

      expect(mockAudioPause).toHaveBeenCalled()
      const state = usePlayerStore.getState()
      expect(state.isPlaying).toBe(false)
      expect(state.isBuffering).toBe(false)
    })
  })

  describe('togglePlay', () => {
    it('plays when stopped', () => {
      renderProvider()
      act(() => { contextValue!.togglePlay() })
      expect(usePlayerStore.getState().isPlaying).toBe(true)
    })

    it('pauses when playing', () => {
      renderProvider()
      act(() => { contextValue!.play() })
      act(() => { contextValue!.togglePlay() })
      expect(mockAudioPause).toHaveBeenCalled()
      expect(usePlayerStore.getState().isPlaying).toBe(false)
    })
  })

  // ─── Volume sync ───

  describe('volume sync', () => {
    it('syncs volume changes from store to audio.volume', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      act(() => { usePlayerStore.getState().setVolume(0.9) })
      expect(audioInstance!.volume).toBe(0.9)

      act(() => { usePlayerStore.getState().setVolume(0.1) })
      expect(audioInstance!.volume).toBe(0.1)
    })

    it('syncs mute toggle from store to audio.volume', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      act(() => { usePlayerStore.getState().toggleMute() })
      expect(audioInstance!.volume).toBe(0)

      act(() => { usePlayerStore.getState().toggleMute() })
      expect(audioInstance!.volume).toBe(0.7)
    })
  })

  // ─── HLS Error Handling ───

  describe('HLS error handling', () => {
    it('recovers from media errors', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      const handler = getHlsHandler('hlsError')
      expect(handler).toBeTruthy()
      act(() => {
        handler!('error', {
          fatal: true,
          type: 'mediaError',
          details: 'fragParsingError',
        })
      })

      expect(mockHlsRecoverMediaError).toHaveBeenCalled()
      expect(usePlayerStore.getState().errorCount).toBe(1)
    })

    it('destroys HLS on non-media fatal errors', () => {
      jest.useFakeTimers()
      renderProvider()
      act(() => { contextValue!.play() })

      const handler = getHlsHandler('hlsError')
      expect(handler).toBeTruthy()
      act(() => {
        handler!('error', {
          fatal: true,
          type: 'networkError',
          details: 'manifestLoadError',
        })
      })

      expect(mockHlsDestroy).toHaveBeenCalled()
      expect(usePlayerStore.getState().errorCount).toBe(1)
      expect(usePlayerStore.getState().lastError).toBe('manifestLoadError')

      jest.useRealTimers()
    })

    it('ignores non-fatal errors', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      const handler = getHlsHandler('hlsError')
      expect(handler).toBeTruthy()
      act(() => {
        handler!('error', {
          fatal: false,
          type: 'networkError',
          details: 'fragLoadError',
        })
      })

      expect(usePlayerStore.getState().errorCount).toBe(0)
    })

    it('clears buffering flag on FRAG_BUFFERED', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      usePlayerStore.setState({ isBuffering: true })
      const handler = getHlsHandler('hlsFragBuffered')
      expect(handler).toBeTruthy()
      act(() => { handler!() })
      expect(usePlayerStore.getState().isBuffering).toBe(false)
    })
  })

  // ─── Safari Fallback ───

  describe('Safari native HLS fallback', () => {
    it('uses native HLS when HLS.js is not supported', () => {
      ;(Hls.isSupported as jest.Mock).mockReturnValue(false)

      // Pre-configure Audio to support native HLS
      global.Audio = jest.fn().mockImplementation(() => {
        const el = document.createElement('audio')
        el.play = jest.fn().mockResolvedValue(undefined)
        el.pause = jest.fn()
        el.canPlayType = jest.fn().mockReturnValue('maybe') as any
        audioInstance = el
        return el
      }) as any

      renderProvider()
      act(() => { contextValue!.play() })

      expect(audioInstance!.src).toContain('stream.m3u8')
      expect(usePlayerStore.getState().streamStatus).toBe('connecting')

      ;(Hls.isSupported as jest.Mock).mockReturnValue(true)
    })
  })

  // ─── Quality Sync ───

  describe('quality sync', () => {
    it('sets HLS level when quality changes', () => {
      renderProvider()
      act(() => { contextValue!.play() })

      const hlsResults = (Hls as jest.Mock).mock.results
      const hlsInstance = hlsResults[hlsResults.length - 1]?.value
      expect(hlsInstance).toBeTruthy()

      act(() => { usePlayerStore.getState().setQuality('high') })
      expect(hlsInstance.currentLevel).toBe(2)

      act(() => { usePlayerStore.getState().setQuality('low') })
      expect(hlsInstance.currentLevel).toBe(0)

      act(() => { usePlayerStore.getState().setQuality('auto') })
      expect(hlsInstance.currentLevel).toBe(-1)
    })
  })
})
