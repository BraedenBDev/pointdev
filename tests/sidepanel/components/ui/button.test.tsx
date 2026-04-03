import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../../../../src/sidepanel/components/ui/button'

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Start Capture</Button>)
    const btn = screen.getByRole('button', { name: 'Start Capture' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('rounded-full')
  })

  it('renders destructive variant', () => {
    render(<Button variant="destructive">Stop Capture</Button>)
    const btn = screen.getByRole('button', { name: 'Stop Capture' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('bg-error')
  })

  it('renders outline variant', () => {
    render(<Button variant="outline">New</Button>)
    const btn = screen.getByRole('button', { name: 'New' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('border')
  })

  it('renders tonal variant', () => {
    render(<Button variant="tonal">Circle</Button>)
    const btn = screen.getByRole('button', { name: 'Circle' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('bg-primary-container')
  })

  it('renders disabled state', () => {
    render(<Button disabled>Start Capture</Button>)
    const btn = screen.getByRole('button', { name: 'Start Capture' })
    expect(btn).toBeDisabled()
  })
})
