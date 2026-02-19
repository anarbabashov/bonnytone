import { render, screen, fireEvent } from '@testing-library/react'
import GlassPlayButton from '@/components/radio/GlassPlayButton'

describe('GlassPlayButton', () => {
  it('renders Play label when not playing', () => {
    render(
      <GlassPlayButton isPlaying={false} isBuffering={false} onToggle={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('renders Pause label when playing', () => {
    render(
      <GlassPlayButton isPlaying={true} isBuffering={false} onToggle={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
  })

  it('renders Buffering label when buffering', () => {
    render(
      <GlassPlayButton isPlaying={true} isBuffering={true} onToggle={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Buffering' })).toBeTruthy()
  })

  it('shows spinner icon when buffering', () => {
    const { container } = render(
      <GlassPlayButton isPlaying={true} isBuffering={true} onToggle={() => {}} />
    )
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('does not show spinner when not buffering', () => {
    const { container } = render(
      <GlassPlayButton isPlaying={true} isBuffering={false} onToggle={() => {}} />
    )
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeNull()
  })

  it('calls onToggle when clicked', () => {
    const onToggle = jest.fn()
    render(
      <GlassPlayButton isPlaying={false} isBuffering={false} onToggle={onToggle} />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('disables pulse-glow animation when buffering', () => {
    const { container } = render(
      <GlassPlayButton isPlaying={true} isBuffering={true} onToggle={() => {}} />
    )
    const button = container.querySelector('button')
    expect(button?.style.animation).toBe('none')
  })

  it('enables pulse-glow animation when playing and not buffering', () => {
    const { container } = render(
      <GlassPlayButton isPlaying={true} isBuffering={false} onToggle={() => {}} />
    )
    const button = container.querySelector('button')
    expect(button?.style.animation).toContain('pulse-glow')
  })
})
