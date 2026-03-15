import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from '../../../src/sidepanel/hooks/useSpeechRecognition'

// Mock chrome.runtime and chrome.offscreen
const messageListeners: Array<(message: any) => void> = []

beforeEach(() => {
  messageListeners.length = 0
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: vi.fn((fn: any) => messageListeners.push(fn)),
        removeListener: vi.fn((fn: any) => {
          const idx = messageListeners.indexOf(fn)
          if (idx >= 0) messageListeners.splice(idx, 1)
        }),
      },
      sendMessage: vi.fn(),
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    offscreen: {
      createDocument: vi.fn().mockResolvedValue(undefined),
      Reason: { USER_MEDIA: 'USER_MEDIA' },
    },
  })
  // Mock navigator.permissions for mic permission check
  vi.stubGlobal('navigator', {
    ...navigator,
    permissions: {
      query: vi.fn().mockResolvedValue({ state: 'granted', onchange: null }),
    },
  })
})

describe('useSpeechRecognition', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isListening).toBe(false)
    expect(result.current.transcript).toBe('')
    expect(result.current.segments).toEqual([])
  })

  it('reports available (offscreen is always available)', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isAvailable).toBe(true)
  })

  it('creates offscreen document and sends start message', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { result.current.start(Date.now()) })
    expect(chrome.offscreen.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('offscreen.html'),
        reasons: ['USER_MEDIA'],
      })
    )
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'OFFSCREEN_SPEECH_START' })
    )
  })

  it('updates state when offscreen reports started', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { result.current.start(Date.now()) })
    act(() => {
      messageListeners.forEach(fn => fn({ type: 'OFFSCREEN_SPEECH_STARTED' }))
    })
    expect(result.current.isListening).toBe(true)
  })

  it('stops listening', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { result.current.start(Date.now()) })
    act(() => { result.current.stop() })
    expect(result.current.isListening).toBe(false)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'OFFSCREEN_SPEECH_STOP' })
  })

  it('accumulates segments from offscreen results', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { result.current.start(Date.now()) })
    act(() => {
      messageListeners.forEach(fn => fn({
        type: 'OFFSCREEN_SPEECH_RESULT',
        segments: [{ text: 'hello world', startMs: 1000, endMs: 2000 }],
        interim: '',
      }))
    })
    expect(result.current.segments).toHaveLength(1)
    expect(result.current.transcript).toBe('hello world')
  })

  it('handles errors from offscreen', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { result.current.start(Date.now()) })
    act(() => {
      messageListeners.forEach(fn => fn({
        type: 'OFFSCREEN_SPEECH_ERROR',
        error: 'Microphone access denied.',
      }))
    })
    expect(result.current.error).toBe('Microphone access denied.')
    expect(result.current.isListening).toBe(false)
  })
})
