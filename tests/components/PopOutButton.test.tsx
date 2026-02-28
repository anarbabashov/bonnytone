import { render, screen, fireEvent } from '@testing-library/react'
import { usePlayerStore } from '@/store/playerStore'

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}))

// Mock the player hook
jest.mock('@/hooks/usePlayer', () => ({
  usePlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    togglePlay: jest.fn(),
    analyserNode: null,
  }),
}))

// Mock useMobilePlatform
jest.mock('@/hooks/useMobilePlatform', () => ({
  useMobilePlatform: () => false,
}))

// Mock Waveform
jest.mock('@/components/radio/Waveform', () => {
  return function MockWaveform() {
    return <div data-testid="waveform" />
  }
})

// Mock VolumeSlider
jest.mock('@/components/radio/VolumeSlider', () => {
  return function MockVolumeSlider() {
    return <div data-testid="volume-slider" />
  }
})

// Mock ThemeToggle
jest.mock('@/components/layout/ThemeToggle/ThemeToggle', () => {
  return function MockThemeToggle() {
    return <div data-testid="theme-toggle" />
  }
})

import Home from '@/app/page'

describe('Home page pop-out button', () => {
  let windowOpenSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null)
    usePlayerStore.setState({
      isPlaying: false,
      isBuffering: false,
      volume: 0.7,
      isMuted: false,
      streamStatus: 'live',
      nowPlaying: null,
    })
  })

  afterEach(() => {
    windowOpenSpy.mockRestore()
  })

  it('renders the pop-out button with correct aria-label', () => {
    render(<Home />)
    expect(screen.getByLabelText('Open mini player')).toBeTruthy()
  })

  it('calls window.open with correct URL and window name when clicked', () => {
    render(<Home />)
    fireEvent.click(screen.getByLabelText('Open mini player'))
    expect(windowOpenSpy).toHaveBeenCalledTimes(1)

    const [url, name, features] = windowOpenSpy.mock.calls[0]
    expect(url).toBe('/mini-player')
    expect(name).toBe('btradio-mini')
    expect(features).toContain('width=420')
    expect(features).toContain('height=500')
    expect(features).toContain('resizable=yes')
    expect(features).toContain('scrollbars=no')
  })

  it('includes centered position in window.open features', () => {
    render(<Home />)
    fireEvent.click(screen.getByLabelText('Open mini player'))

    const features = windowOpenSpy.mock.calls[0][2] as string
    expect(features).toMatch(/left=\d+/)
    expect(features).toMatch(/top=\d+/)
  })
})
