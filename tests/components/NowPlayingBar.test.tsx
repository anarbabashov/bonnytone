import { render, screen } from '@testing-library/react'
import NowPlayingBar from '@/components/radio/NowPlayingBar'

describe('NowPlayingBar', () => {
  it('renders nothing when nowPlaying is null', () => {
    const { container } = render(
      <NowPlayingBar nowPlaying={null} listenerCount={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title and artist', () => {
    render(
      <NowPlayingBar
        nowPlaying={{ title: 'Infinity', artist: 'Andy Gart', art: null }}
        listenerCount={null}
      />
    )
    expect(screen.getByText('Infinity')).toBeTruthy()
    expect(screen.getByText('Andy Gart')).toBeTruthy()
  })

  it('renders listener count when > 0', () => {
    render(
      <NowPlayingBar
        nowPlaying={{ title: 'Test', artist: 'Test', art: null }}
        listenerCount={42}
      />
    )
    expect(screen.getByText('42 listeners')).toBeTruthy()
  })

  it('renders singular "listener" for count of 1', () => {
    render(
      <NowPlayingBar
        nowPlaying={{ title: 'Test', artist: 'Test', art: null }}
        listenerCount={1}
      />
    )
    expect(screen.getByText('1 listener')).toBeTruthy()
  })

  it('does not render listener count when null', () => {
    render(
      <NowPlayingBar
        nowPlaying={{ title: 'Test', artist: 'Test', art: null }}
        listenerCount={null}
      />
    )
    expect(screen.queryByText(/listener/)).toBeNull()
  })

  it('does not render listener count when 0', () => {
    render(
      <NowPlayingBar
        nowPlaying={{ title: 'Test', artist: 'Test', art: null }}
        listenerCount={0}
      />
    )
    expect(screen.queryByText(/listener/)).toBeNull()
  })
})
