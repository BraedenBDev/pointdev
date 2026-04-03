import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PermissionRow } from '../../../../src/sidepanel/components/ui/permission-row'

describe('PermissionRow', () => {
  it('renders ok status with green dot', () => {
    render(<PermissionRow name="Microphone" status="ok" label="Granted" />)
    expect(screen.getByText('Microphone')).toBeInTheDocument()
    expect(screen.getByText('Granted')).toBeInTheDocument()
  })

  it('renders error status with red dot', () => {
    render(<PermissionRow name="Active Tab" status="error" label="Restricted" />)
    expect(screen.getByText('Active Tab')).toBeInTheDocument()
    expect(screen.getByText('Restricted')).toBeInTheDocument()
  })

  it('renders action link when provided', () => {
    const onAction = vi.fn()
    render(
      <PermissionRow name="Microphone" status="error" label="Denied" action="Setup" onAction={onAction} />
    )
    const link = screen.getByText('Setup →')
    expect(link).toBeInTheDocument()
  })
})
