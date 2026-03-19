import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from '../../../src/sidepanel/hooks/useSpeechRecognition'

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onstart: (() => void) | null = null
  onresult: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn(() => { this.onstart?.() })
  stop = vi.fn(() => { this.onend?.() })
}

const messageListeners: Array<(message: any) => void> = []

beforeEach(() => {
  messageListeners.length = 0
  vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: vi.fn((fn: any) => messageListeners.push(fn)),
        removeListener: vi.fn(),
      },
      sendMessage: vi.fn(),
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ pointdev_mic_granted: true }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
  })
  // Mock navigator.permissions.query
  Object.defineProperty(navigator, 'permissions', {
    value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
    writable: true,
    configurable: true,
  })
})

describe('useSpeechRecognition', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isListening).toBe(false)
    expect(result.current.transcript).toBe('')
    expect(result.current.segments).toEqual([])
  })

  it('reports available when SpeechRecognition exists', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isAvailable).toBe(true)
  })

  it('resolves to granted when storage flag and permission match', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.micPermission).toBe('granted')
  })

  it('resolves to needs-setup when no storage flag', async () => {
    (chrome.storage.local.get as any).mockResolvedValue({})
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.micPermission).toBe('needs-setup')
  })

  it('creates SpeechRecognition locally on start', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    act(() => { result.current.start(Date.now()) })
    expect(result.current.isListening).toBe(true)
  })

  it('does not send SPEECH_START message (speech is local)', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    act(() => { result.current.start(Date.now()) })
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SPEECH_START' })
    )
  })

  it('stops recognition on stop()', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    act(() => { result.current.start(Date.now()) })
    act(() => { result.current.stop() })
    expect(result.current.isListening).toBe(false)
  })

  it('receives MIC_PERMISSION_GRANTED from tab fallback', async () => {
    (chrome.storage.local.get as any).mockResolvedValue({})
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.micPermission).toBe('needs-setup')

    act(() => {
      messageListeners.forEach(fn => fn({ type: 'MIC_PERMISSION_GRANTED' }))
    })
    expect(result.current.micPermission).toBe('granted')
  })
})
