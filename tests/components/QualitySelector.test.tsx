import { render, screen, fireEvent } from '@testing-library/react'
import QualitySelector from '@/components/radio/QualitySelector'

describe('QualitySelector', () => {
  it('renders current quality label', () => {
    render(<QualitySelector quality="auto" onChange={() => {}} />)
    expect(screen.getByText('AUTO')).toBeTruthy()
  })

  it('renders HIGH label for high quality', () => {
    render(<QualitySelector quality="high" onChange={() => {}} />)
    expect(screen.getByText('HIGH')).toBeTruthy()
  })

  it('renders MED label for medium quality', () => {
    render(<QualitySelector quality="medium" onChange={() => {}} />)
    expect(screen.getByText('MED')).toBeTruthy()
  })

  it('cycles auto → low on click', () => {
    const onChange = jest.fn()
    render(<QualitySelector quality="auto" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('low')
  })

  it('cycles low → medium on click', () => {
    const onChange = jest.fn()
    render(<QualitySelector quality="low" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('medium')
  })

  it('cycles medium → high on click', () => {
    const onChange = jest.fn()
    render(<QualitySelector quality="medium" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('high')
  })

  it('cycles high → auto (wraps around)', () => {
    const onChange = jest.fn()
    render(<QualitySelector quality="high" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('auto')
  })

  it('has accessible label with current quality', () => {
    render(<QualitySelector quality="high" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /high/i })).toBeTruthy()
  })
})
