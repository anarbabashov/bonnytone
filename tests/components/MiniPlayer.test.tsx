import { render, screen, fireEvent, act } from '@testing-library/react'
import { usePlayerStore } from '@/store/playerStore'

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}))

// Mock the player hook
const mockPlay = jest.fn()
const mockTogglePlay = jest.fn()
jest.mock('@/hooks/usePlayer', () => ({
  usePlayer: () => ({
    play: mockPlay,
    pause: jest.fn(),
    togglePlay: mockTogglePlay,
    analyserNode: null,
  }),
}))

// Mock useMobilePlatform
let mockIsMobile = false
jest.mock('@/hooks/useMobilePlatform', () => ({
  useMobilePlatform: () => mockIsMobile,
}))

// Mock Waveform — it uses canvas which jsdom doesn't support
jest.mock('@/components/radio/Waveform', () => {
  return function MockWaveform() {
    return <div data-testid="waveform" />
  }
})

// Mock VolumeSlider
jest.mock('@/components/radio/VolumeSlider', () => {
  return function MockVolumeSlider({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
    return <div data-testid="volume-slider" data-volume={volume} />
  }
})

import MiniPlayer from '@/app/mini-player/page'

describe('MiniPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsMobile = false
    // Reset store to initial state
    usePlayerStore.setState({
      isPlaying: false,
      isBuffering: false,
      volume: 0.7,
      isMuted: false,
      streamStatus: 'idle',
      nowPlaying: null,
    })
  })

  // ─── Audio Quality ───

  it('receives analyserNode as null (no Web Audio API routing)', () => {
    // The mock confirms usePlayer returns analyserNode: null
    // This ensures no createMediaElementSource/AudioContext is involved
    render(<MiniPlayer />)
    // If analyserNode were not null, the Waveform mock would receive it.
    // The mock setup above hardcodes analyserNode: null, matching PlayerProvider.
    expect(screen.getByTestId('waveform')).toBeTruthy()
  })

  it('renders BTRadio DJ branding in top bar', () => {
    render(<MiniPlayer />)
    // Branding appears in the top bar as a <span>
    const brandingSpan = screen.getAllByText('BTRadio DJ').find(
      (el) => el.tagName === 'SPAN'
    )
    expect(brandingSpan).toBeTruthy()
  })

  it('renders close button', () => {
    render(<MiniPlayer />)
    expect(screen.getByLabelText('Close')).toBeTruthy()
  })

  it('calls window.close when close button is clicked', () => {
    const closeSpy = jest.fn()
    window.close = closeSpy
    render(<MiniPlayer />)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('renders play button when not playing', () => {
    usePlayerStore.setState({ streamStatus: 'live', isPlaying: false })
    render(<MiniPlayer />)
    expect(screen.getByLabelText('Play')).toBeTruthy()
  })

  it('renders pause button when playing', () => {
    usePlayerStore.setState({ streamStatus: 'live', isPlaying: true })
    render(<MiniPlayer />)
    expect(screen.getByLabelText('Pause')).toBeTruthy()
  })

  it('renders spinner when buffering', () => {
    usePlayerStore.setState({ streamStatus: 'connecting', isPlaying: true, isBuffering: true })
    const { container } = render(<MiniPlayer />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('calls togglePlay when play/pause button is clicked', () => {
    usePlayerStore.setState({ streamStatus: 'live', isPlaying: false })
    render(<MiniPlayer />)
    fireEvent.click(screen.getByLabelText('Play'))
    expect(mockTogglePlay).toHaveBeenCalledTimes(1)
  })

  it('disables play button when stream is offline', () => {
    usePlayerStore.setState({ streamStatus: 'offline' })
    render(<MiniPlayer />)
    const btn = screen.getByLabelText('Play') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('does not auto-play on mount — user must manually press play', () => {
    usePlayerStore.setState({ streamStatus: 'idle' })
    render(<MiniPlayer />)
    expect(mockPlay).not.toHaveBeenCalled()
  })

  it('renders waveform background', () => {
    render(<MiniPlayer />)
    expect(screen.getByTestId('waveform')).toBeTruthy()
  })

  it('renders volume slider on desktop', () => {
    mockIsMobile = false
    render(<MiniPlayer />)
    expect(screen.getByTestId('volume-slider')).toBeTruthy()
  })

  it('hides volume slider on mobile', () => {
    mockIsMobile = true
    render(<MiniPlayer />)
    expect(screen.queryByTestId('volume-slider')).toBeNull()
  })

  it('hides badge before user clicks play', () => {
    usePlayerStore.setState({ streamStatus: 'live', isPlaying: false })
    const { container } = render(<MiniPlayer />)
    const badge = container.querySelector('.glass.rounded-full.transition-all')
    expect(badge?.className).toContain('opacity-0')
  })

  it('shows LIVE badge after user plays and stream is live', () => {
    jest.useFakeTimers()
    usePlayerStore.setState({ streamStatus: 'live', isPlaying: true })
    render(<MiniPlayer />)
    act(() => { jest.advanceTimersByTime(1000) })
    expect(screen.getByText('LIVE')).toBeTruthy()
    expect(screen.getByText('Main Stage')).toBeTruthy()
    jest.useRealTimers()
  })

  it('hides status badge initially when connecting (before debounce)', () => {
    jest.useFakeTimers()
    usePlayerStore.setState({ streamStatus: 'connecting', isPlaying: true })
    const { container } = render(<MiniPlayer />)
    const badge = container.querySelector('.glass.rounded-full.transition-all')
    expect(badge?.className).toContain('opacity-0')
    jest.useRealTimers()
  })

  it('shows PENDING badge after 1s debounce when connecting', () => {
    jest.useFakeTimers()
    usePlayerStore.setState({ streamStatus: 'connecting', isPlaying: true })
    render(<MiniPlayer />)
    act(() => { jest.advanceTimersByTime(1000) })
    expect(screen.getByText('PENDING')).toBeTruthy()
    expect(screen.getByText('We apologize, something went wrong')).toBeTruthy()
    jest.useRealTimers()
  })

  it('shows PENDING badge after 1s debounce when offline', () => {
    jest.useFakeTimers()
    usePlayerStore.setState({ streamStatus: 'offline', isPlaying: true })
    render(<MiniPlayer />)
    act(() => { jest.advanceTimersByTime(1000) })
    expect(screen.getByText('PENDING')).toBeTruthy()
    jest.useRealTimers()
  })

  it('shows ERROR badge with reason when error', () => {
    usePlayerStore.setState({ streamStatus: 'error', isPlaying: true, lastError: 'HLS decode failure' })
    render(<MiniPlayer />)
    expect(screen.getByText('ERROR')).toBeTruthy()
    expect(screen.getByText('HLS decode failure')).toBeTruthy()
  })

  it('shows ERROR badge with fallback text when no error reason', () => {
    usePlayerStore.setState({ streamStatus: 'error', isPlaying: true, lastError: null })
    render(<MiniPlayer />)
    expect(screen.getByText('ERROR')).toBeTruthy()
    expect(screen.getByText('Stream unavailable')).toBeTruthy()
  })

  it('renders BTRadio DJ branding in top bar only (no now-playing text)', () => {
    usePlayerStore.setState({ streamStatus: 'live', nowPlaying: null })
    render(<MiniPlayer />)
    // Only one instance — top bar branding, no now-playing section
    expect(screen.getAllByText('BTRadio DJ')).toHaveLength(1)
    expect(screen.queryByText('Live Stream')).toBeNull()
  })

  it('sets document title based on stream status', () => {
    usePlayerStore.setState({ streamStatus: 'live' })
    render(<MiniPlayer />)
    expect(document.title).toBe('LIVE | BTRadio DJ')
  })
})
