import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedButton } from '../../../../src/sidepanel/components/ui/segmented-button'

describe('SegmentedButton', () => {
  const options = [
    { value: 'text', label: 'Text' },
    { value: 'json', label: 'JSON' },
    { value: 'markdown', label: 'Markdown' },
  ]

  it('renders all options', () => {
    render(<SegmentedButton options={options} value="text" onChange={() => {}} />)
    expect(screen.getByText('Text')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('Markdown')).toBeInTheDocument()
  })

  it('highlights active option', () => {
    render(<SegmentedButton options={options} value="json" onChange={() => {}} />)
    const active = screen.getByText('JSON')
    expect(active.className).toContain('bg-surface')
  })

  it('calls onChange when option is clicked', () => {
    const onChange = vi.fn()
    render(<SegmentedButton options={options} value="text" onChange={onChange} />)
    fireEvent.click(screen.getByText('Markdown'))
    expect(onChange).toHaveBeenCalledWith('markdown')
  })
})
