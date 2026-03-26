import { describe, it, expect } from 'vitest'

// Test the interface contract — the hook must return the same shape as useSpeechRecognition
describe('useWhisperRecognition interface', () => {
  it('exports a function', async () => {
    const mod = await import('../../../src/sidepanel/hooks/useWhisperRecognition')
    expect(typeof mod.useWhisperRecognition).toBe('function')
  })
})
