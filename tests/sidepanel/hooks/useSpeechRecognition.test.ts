import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechRecognition } from '../../../src/sidepanel/hooks/useSpeechRecognition'

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()
}

beforeEach(() => {
  vi.stubGlobal('SpeechRecognition', MockSpeechRecognition)
  vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)
})

describe('useSpeechRecognition', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isListening).toBe(false)
    expect(result.current.transcript).toBe('')
    expect(result.current.segments).toEqual([])
  })

  it('starts listening', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start(Date.now()) })
    expect(result.current.isListening).toBe(true)
  })

  it('stops listening', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    act(() => { result.current.start(Date.now()) })
    act(() => { result.current.stop() })
    expect(result.current.isListening).toBe(false)
  })

  it('reports unavailable when SpeechRecognition is missing', () => {
    vi.stubGlobal('SpeechRecognition', undefined)
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isAvailable).toBe(false)
  })
})
