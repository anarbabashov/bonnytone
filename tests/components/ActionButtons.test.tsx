import { render, screen, fireEvent } from '@testing-library/react'
import ActionButtons from '@/components/radio/ActionButtons'

describe('ActionButtons', () => {
  const defaultProps = {
    isMuted: false,
    onToggleMute: jest.fn(),
    onPopOut: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders mute, pop-out, and share buttons by default', () => {
    render(<ActionButtons {...defaultProps} />)
    expect(screen.getByLabelText('Mute')).toBeTruthy()
    expect(screen.getByLabelText('Open mini player')).toBeTruthy()
    expect(screen.getByLabelText('Share radio')).toBeTruthy()
  })

  it('renders Unmute label when muted', () => {
    render(<ActionButtons {...defaultProps} isMuted={true} />)
    expect(screen.getByLabelText('Unmute')).toBeTruthy()
  })

  it('hides mute button when hideMute is true', () => {
    render(<ActionButtons {...defaultProps} hideMute={true} />)
    expect(screen.queryByLabelText('Mute')).toBeNull()
    expect(screen.queryByLabelText('Unmute')).toBeNull()
    // Other buttons still present
    expect(screen.getByLabelText('Open mini player')).toBeTruthy()
    expect(screen.getByLabelText('Share radio')).toBeTruthy()
  })

  it('calls onToggleMute when mute button is clicked', () => {
    const onToggleMute = jest.fn()
    render(<ActionButtons {...defaultProps} onToggleMute={onToggleMute} />)
    fireEvent.click(screen.getByLabelText('Mute'))
    expect(onToggleMute).toHaveBeenCalledTimes(1)
  })

  it('calls onPopOut when pop-out button is clicked', () => {
    const onPopOut = jest.fn()
    render(<ActionButtons {...defaultProps} onPopOut={onPopOut} />)
    fireEvent.click(screen.getByLabelText('Open mini player'))
    expect(onPopOut).toHaveBeenCalledTimes(1)
  })
})
