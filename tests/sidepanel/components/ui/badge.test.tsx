import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../../../../src/sidepanel/components/ui/badge'

describe('Badge', () => {
  it('renders default variant', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('renders voice trigger variant', () => {
    render(<Badge variant="voice">Voice</Badge>)
    const badge = screen.getByText('Voice')
    expect(badge.className).toContain('bg-purple')
  })

  it('renders frame-diff trigger variant', () => {
    render(<Badge variant="frame-diff">Visual</Badge>)
    const badge = screen.getByText('Visual')
    expect(badge.className).toContain('bg-blue')
  })

  it('renders dwell trigger variant', () => {
    render(<Badge variant="dwell">Dwell</Badge>)
    const badge = screen.getByText('Dwell')
    expect(badge.className).toContain('bg-amber')
  })

  it('renders annotation trigger variant', () => {
    render(<Badge variant="annotation">Annotation</Badge>)
    const badge = screen.getByText('Annotation')
    expect(badge.className).toContain('bg-emerald')
  })

  it('renders status-ok variant', () => {
    render(<Badge variant="status-ok">Granted</Badge>)
    const badge = screen.getByText('Granted')
    expect(badge.className).toContain('text-primary')
  })

  it('renders status-error variant', () => {
    render(<Badge variant="status-error">Denied</Badge>)
    const badge = screen.getByText('Denied')
    expect(badge.className).toContain('text-error')
  })
})
