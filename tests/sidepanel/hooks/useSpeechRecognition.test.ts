import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from '../../../src/sidepanel/hooks/useSpeechRecognition'

// Mock chrome.runtime and chrome.storage
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
      sendMessage: vi.fn((msg: any, cb?: any) => {
        // Simulate MIC_TAB_PING response — tab is alive
        if (msg.type === 'MIC_TAB_PING' && cb) cb({ alive: true })
      }),
      lastError: null,
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ pointdev_mic_granted: true }),
        set: vi.fn().mockResolvedValue(undefined),
      },
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

  it('reports available', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isAvailable).toBe(true)
  })

  it('sends SPEECH_START to mic-permission tab', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    // Wait for async mic permission check to resolve
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    await act(async () => { result.current.start(Date.now()) })
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SPEECH_START' })
    )
  })

  it('updates state when speech tab reports started', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    await act(async () => { result.current.start(Date.now()) })
    act(() => {
      messageListeners.forEach(fn => fn({ type: 'SPEECH_STARTED' }))
    })
    expect(result.current.isListening).toBe(true)
  })

  it('stops listening', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    await act(async () => { result.current.start(Date.now()) })
    act(() => { result.current.stop() })
    expect(result.current.isListening).toBe(false)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'SPEECH_STOP' })
  })

  it('accumulates segments from speech results', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    await act(async () => { result.current.start(Date.now()) })
    act(() => {
      messageListeners.forEach(fn => fn({
        type: 'SPEECH_RESULT',
        segments: [{ text: 'hello world', startMs: 1000, endMs: 2000 }],
        interim: '',
      }))
    })
    expect(result.current.segments).toHaveLength(1)
    expect(result.current.transcript).toBe('hello world')
  })

  it('handles errors from speech tab', async () => {
    const { result } = renderHook(() => useSpeechRecognition())
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    await act(async () => { result.current.start(Date.now()) })
    act(() => {
      messageListeners.forEach(fn => fn({
        type: 'SPEECH_ERROR',
        error: 'Microphone access denied.',
      }))
    })
    expect(result.current.error).toBe('Microphone access denied.')
    expect(result.current.isListening).toBe(false)
  })
})
