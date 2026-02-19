import { render, screen } from '@testing-library/react'
import StreamStatus from '@/components/radio/StreamStatus'
import type { StreamStatus as StreamStatusType } from '@/store/playerStore'

describe('StreamStatus', () => {
  const statuses: { status: StreamStatusType; label: string }[] = [
    { status: 'idle', label: 'Checking' },
    { status: 'connecting', label: 'Connecting' },
    { status: 'live', label: 'LIVE' },
    { status: 'offline', label: 'Offline' },
    { status: 'error', label: 'Error' },
  ]

  it.each(statuses)(
    'renders "$label" for status "$status"',
    ({ status, label }) => {
      render(<StreamStatus status={status} listenerCount={null} />)
      expect(screen.getByText(label)).toBeTruthy()
    }
  )

  it('renders a green dot for live status', () => {
    const { container } = render(<StreamStatus status="live" listenerCount={null} />)
    const dot = container.querySelector('span.bg-green-500')
    expect(dot).toBeTruthy()
  })

  it('renders a pulsing yellow dot for connecting status', () => {
    const { container } = render(<StreamStatus status="connecting" listenerCount={null} />)
    const dot = container.querySelector('span.bg-yellow-500')
    expect(dot).toBeTruthy()
    expect(dot?.classList.contains('animate-pulse')).toBe(true)
  })

  it('renders a red dot for error status', () => {
    const { container } = render(<StreamStatus status="error" listenerCount={null} />)
    const dot = container.querySelector('span.bg-red-500')
    expect(dot).toBeTruthy()
  })

  it('renders listener count when > 0', () => {
    render(<StreamStatus status="live" listenerCount={42} />)
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('does not render listener count when null', () => {
    const { container } = render(<StreamStatus status="live" listenerCount={null} />)
    expect(container.querySelector('[data-testid="icon-Users"]')).toBeNull()
  })

  it('renders listener count when 0', () => {
    render(<StreamStatus status="live" listenerCount={0} />)
    expect(screen.getByText('0')).toBeTruthy()
  })
})
