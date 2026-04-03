import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock chrome APIs
const mockChrome = {
  runtime: { sendMessage: vi.fn() },
  storage: { local: { get: vi.fn().mockResolvedValue({}), set: vi.fn() } },
}
Object.defineProperty(globalThis, 'chrome', { value: mockChrome, writable: true })

// Import after mock
import { FloatingCard } from '../../src/content/floating-card'

describe('FloatingCard', () => {
  let card: FloatingCard

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    card = new FloatingCard()
  })

  it('creates a shadow DOM host element', () => {
    expect(card.getHostElement()).toBeDefined()
    expect(card.getHostElement().getAttribute('data-pointdev-float')).toBe('')
  })

  it('show() appends to document body', () => {
    card.show(Date.now())
    expect(document.body.querySelector('[data-pointdev-float]')).toBeTruthy()
  })

  it('destroy() removes from document body', () => {
    card.show(Date.now())
    card.destroy()
    expect(document.body.querySelector('[data-pointdev-float]')).toBeNull()
  })

  it('setMode does not throw', () => {
    card.show(Date.now())
    expect(() => card.setMode('arrow')).not.toThrow()
  })

  it('updateTranscript does not throw', () => {
    card.show(Date.now())
    expect(() => card.updateTranscript('testing testing 1 2 3')).not.toThrow()
  })

  it('updateStats does not throw', () => {
    card.show(Date.now())
    expect(() => card.updateStats(3, 5)).not.toThrow()
  })
})
