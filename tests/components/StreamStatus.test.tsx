import { render, screen } from '@testing-library/react'
import StreamStatus from '@/components/radio/StreamStatus'
import type { StreamStatus as StreamStatusType } from '@/store/playerStore'

describe('StreamStatus', () => {
  const statuses: { status: StreamStatusType; label: string }[] = [
    { status: 'idle', label: 'Offline' },
    { status: 'connecting', label: 'Connecting' },
    { status: 'live', label: 'LIVE' },
    { status: 'offline', label: 'Offline' },
    { status: 'error', label: 'Error' },
  ]

  it.each(statuses)(
    'renders "$label" for status "$status"',
    ({ status, label }) => {
      render(<StreamStatus status={status} />)
      expect(screen.getByText(label)).toBeTruthy()
    }
  )

  it('renders a green dot for live status', () => {
    const { container } = render(<StreamStatus status="live" />)
    const dot = container.querySelector('span.bg-green-500')
    expect(dot).toBeTruthy()
  })

  it('renders a pulsing yellow dot for connecting status', () => {
    const { container } = render(<StreamStatus status="connecting" />)
    const dot = container.querySelector('span.bg-yellow-500')
    expect(dot).toBeTruthy()
    expect(dot?.classList.contains('animate-pulse')).toBe(true)
  })

  it('renders a red dot for error status', () => {
    const { container } = render(<StreamStatus status="error" />)
    const dot = container.querySelector('span.bg-red-500')
    expect(dot).toBeTruthy()
  })
})
