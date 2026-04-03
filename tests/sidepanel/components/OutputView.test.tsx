import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OutputView } from '../../../src/sidepanel/components/OutputView'
import { createEmptySession } from '@shared/types'

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
  },
})

function makeSession() {
  const session = createEmptySession('test-1', 1, 'https://example.com', 'Example Page', { width: 1200, height: 800 })
  session.annotations = [
    { type: 'arrow', coordinates: { startX: 0, startY: 0, endX: 100, endY: 100 }, timestampMs: 5000 },
  ] as any
  session.voiceRecording = {
    transcript: 'hello world',
    durationMs: 10000,
    segments: [
      { text: 'hello world', startMs: 1000, endMs: 2000 },
    ],
  }
  return session
}

describe('OutputView', () => {
  it('renders header with capture metadata', () => {
    render(<OutputView session={makeSession()} onBack={() => {}} />)
    expect(screen.getByText('Capture Complete')).toBeInTheDocument()
    expect(screen.getAllByText(/example\.com/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders stats row with counts', () => {
    render(<OutputView session={makeSession()} onBack={() => {}} />)
    expect(screen.getByText('Annotations')).toBeInTheDocument()
    expect(screen.getByText('Screenshots')).toBeInTheDocument()
    expect(screen.getByText('Voice seg.')).toBeInTheDocument()
  })

  it('renders format toggle options', () => {
    render(<OutputView session={makeSession()} onBack={() => {}} />)
    expect(screen.getByText('Text')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('Markdown')).toBeInTheDocument()
  })

  it('renders output content', () => {
    render(<OutputView session={makeSession()} onBack={() => {}} />)
    // The text formatter outputs session data
    expect(screen.getByText(/Example Page/)).toBeInTheDocument()
  })

  it('calls onBack when New button clicked', () => {
    const onBack = vi.fn()
    render(<OutputView session={makeSession()} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(onBack).toHaveBeenCalled()
  })
})
