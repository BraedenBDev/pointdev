import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IdleView } from '../../../src/sidepanel/components/IdleView'

const defaultPermissions = [
  { name: 'Microphone', status: 'ok' as const, label: 'Granted' },
  { name: 'Active Tab', status: 'ok' as const, label: 'Ready' },
  { name: 'Scripting', status: 'ok' as const, label: 'Allowed' },
  { name: 'Offscreen Doc', status: 'ok' as const, label: 'Available' },
  { name: 'Service Worker', status: 'ok' as const, label: 'Active' },
]

describe('IdleView', () => {
  it('renders header with logo and version', () => {
    render(
      <IdleView
        engine="web-speech"
        onEngineChange={() => {}}
        permissions={defaultPermissions}
        canCapture={true}
        micGranted={true}
        onStart={() => {}}
        onRequestMic={() => {}}
      />
    )
    expect(screen.getByText('PointDev')).toBeInTheDocument()
    expect(screen.getByText('v0.2.0')).toBeInTheDocument()
  })

  it('renders all permission rows', () => {
    render(
      <IdleView
        engine="web-speech"
        onEngineChange={() => {}}
        permissions={defaultPermissions}
        canCapture={true}
        micGranted={true}
        onStart={() => {}}
        onRequestMic={() => {}}
      />
    )
    expect(screen.getByText('Microphone')).toBeInTheDocument()
    expect(screen.getByText('Active Tab')).toBeInTheDocument()
    expect(screen.getByText('Service Worker')).toBeInTheDocument()
  })

  it('disables start button when canCapture is false', () => {
    render(
      <IdleView
        engine="web-speech"
        onEngineChange={() => {}}
        permissions={defaultPermissions}
        canCapture={false}
        micGranted={true}
        onStart={() => {}}
        onRequestMic={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: 'Start Capture' })).toBeDisabled()
    expect(screen.getByText(/Cannot capture/)).toBeInTheDocument()
  })

  it('shows mic warning when canCapture but mic not granted', () => {
    render(
      <IdleView
        engine="web-speech"
        onEngineChange={() => {}}
        permissions={defaultPermissions}
        canCapture={true}
        micGranted={false}
        onStart={() => {}}
        onRequestMic={() => {}}
      />
    )
    expect(screen.getByText(/Voice narration unavailable/)).toBeInTheDocument()
  })

  it('calls onStart when start button clicked', () => {
    const onStart = vi.fn()
    render(
      <IdleView
        engine="web-speech"
        onEngineChange={() => {}}
        permissions={defaultPermissions}
        canCapture={true}
        micGranted={true}
        onStart={onStart}
        onRequestMic={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start Capture' }))
    expect(onStart).toHaveBeenCalled()
  })

  it('renders engine toggle with correct selection', () => {
    render(
      <IdleView
        engine="whisper"
        onEngineChange={() => {}}
        permissions={defaultPermissions}
        canCapture={true}
        micGranted={true}
        onStart={() => {}}
        onRequestMic={() => {}}
      />
    )
    expect(screen.getByText(/On-device Whisper/)).toBeInTheDocument()
  })
})
