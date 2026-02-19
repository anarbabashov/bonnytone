import { usePlayerStore } from '@/store/playerStore'
import type { PlayerState } from '@/store/playerStore'

// Reset store between tests
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
    errorCount: 0,
    lastError: null,
  })
}

describe('PlayerStore', () => {
  beforeEach(resetStore)

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = usePlayerStore.getState()
      expect(state.isPlaying).toBe(false)
      expect(state.isBuffering).toBe(false)
      expect(state.volume).toBe(0.7)
      expect(state.isMuted).toBe(false)
      expect(state.previousVolume).toBe(0.7)
      expect(state.quality).toBe('auto')
      expect(state.streamStatus).toBe('idle')
      expect(state.listenerCount).toBeNull()
      expect(state.errorCount).toBe(0)
      expect(state.lastError).toBeNull()
    })
  })

  describe('play/pause', () => {
    it('play() should set isPlaying to true', () => {
      usePlayerStore.getState().play()
      expect(usePlayerStore.getState().isPlaying).toBe(true)
    })

    it('pause() should set isPlaying to false', () => {
      usePlayerStore.getState().play()
      usePlayerStore.getState().pause()
      expect(usePlayerStore.getState().isPlaying).toBe(false)
    })

    it('togglePlay() should toggle isPlaying', () => {
      expect(usePlayerStore.getState().isPlaying).toBe(false)

      usePlayerStore.getState().togglePlay()
      expect(usePlayerStore.getState().isPlaying).toBe(true)

      usePlayerStore.getState().togglePlay()
      expect(usePlayerStore.getState().isPlaying).toBe(false)
    })
  })

  describe('volume', () => {
    it('setVolume() should update volume', () => {
      usePlayerStore.getState().setVolume(0.5)
      expect(usePlayerStore.getState().volume).toBe(0.5)
    })

    it('setVolume() should clamp between 0 and 1', () => {
      usePlayerStore.getState().setVolume(1.5)
      expect(usePlayerStore.getState().volume).toBe(1)

      usePlayerStore.getState().setVolume(-0.3)
      expect(usePlayerStore.getState().volume).toBe(0)
    })

    it('setVolume(0) should set isMuted to true', () => {
      usePlayerStore.getState().setVolume(0)
      expect(usePlayerStore.getState().isMuted).toBe(true)
    })

    it('setVolume() with non-zero should set isMuted to false', () => {
      usePlayerStore.getState().setVolume(0)
      expect(usePlayerStore.getState().isMuted).toBe(true)

      usePlayerStore.getState().setVolume(0.5)
      expect(usePlayerStore.getState().isMuted).toBe(false)
    })

    it('setVolume() should update previousVolume when non-zero', () => {
      usePlayerStore.getState().setVolume(0.9)
      expect(usePlayerStore.getState().previousVolume).toBe(0.9)
    })

    it('setVolume(0) should not update previousVolume', () => {
      usePlayerStore.getState().setVolume(0.9)
      usePlayerStore.getState().setVolume(0)
      expect(usePlayerStore.getState().previousVolume).toBe(0.9)
    })
  })

  describe('mute', () => {
    it('toggleMute() should mute and set volume to 0', () => {
      usePlayerStore.getState().setVolume(0.8)
      usePlayerStore.getState().toggleMute()

      const state = usePlayerStore.getState()
      expect(state.isMuted).toBe(true)
      expect(state.volume).toBe(0)
      expect(state.previousVolume).toBe(0.8)
    })

    it('toggleMute() should unmute and restore previous volume', () => {
      usePlayerStore.getState().setVolume(0.8)
      usePlayerStore.getState().toggleMute() // mute
      usePlayerStore.getState().toggleMute() // unmute

      const state = usePlayerStore.getState()
      expect(state.isMuted).toBe(false)
      expect(state.volume).toBe(0.8)
    })

    it('toggleMute() round-trip preserves volume', () => {
      usePlayerStore.getState().setVolume(0.35)
      usePlayerStore.getState().toggleMute()
      usePlayerStore.getState().toggleMute()
      expect(usePlayerStore.getState().volume).toBe(0.35)
    })
  })

  describe('quality', () => {
    it('setQuality() should update quality', () => {
      usePlayerStore.getState().setQuality('high')
      expect(usePlayerStore.getState().quality).toBe('high')

      usePlayerStore.getState().setQuality('auto')
      expect(usePlayerStore.getState().quality).toBe('auto')
    })
  })

  describe('stream status', () => {
    it('setStreamStatus() should update status', () => {
      usePlayerStore.getState().setStreamStatus('connecting')
      expect(usePlayerStore.getState().streamStatus).toBe('connecting')

      usePlayerStore.getState().setStreamStatus('live')
      expect(usePlayerStore.getState().streamStatus).toBe('live')
    })

    it('setListenerCount() should update count', () => {
      usePlayerStore.getState().setListenerCount(42)
      expect(usePlayerStore.getState().listenerCount).toBe(42)

      usePlayerStore.getState().setListenerCount(null)
      expect(usePlayerStore.getState().listenerCount).toBeNull()
    })
  })

  describe('error handling', () => {
    it('setError() should update lastError', () => {
      usePlayerStore.getState().setError('Network error')
      expect(usePlayerStore.getState().lastError).toBe('Network error')
    })

    it('incrementErrorCount() should increment counter', () => {
      usePlayerStore.getState().incrementErrorCount()
      expect(usePlayerStore.getState().errorCount).toBe(1)

      usePlayerStore.getState().incrementErrorCount()
      expect(usePlayerStore.getState().errorCount).toBe(2)
    })

    it('resetErrorCount() should clear errors', () => {
      usePlayerStore.getState().setError('Some error')
      usePlayerStore.getState().incrementErrorCount()
      usePlayerStore.getState().incrementErrorCount()

      usePlayerStore.getState().resetErrorCount()
      expect(usePlayerStore.getState().errorCount).toBe(0)
      expect(usePlayerStore.getState().lastError).toBeNull()
    })
  })

  describe('setIsPlaying / setIsBuffering', () => {
    it('setIsPlaying() should update isPlaying directly', () => {
      usePlayerStore.getState().setIsPlaying(true)
      expect(usePlayerStore.getState().isPlaying).toBe(true)

      usePlayerStore.getState().setIsPlaying(false)
      expect(usePlayerStore.getState().isPlaying).toBe(false)
    })

    it('setIsBuffering() should update isBuffering', () => {
      usePlayerStore.getState().setIsBuffering(true)
      expect(usePlayerStore.getState().isBuffering).toBe(true)

      usePlayerStore.getState().setIsBuffering(false)
      expect(usePlayerStore.getState().isBuffering).toBe(false)
    })
  })
})
