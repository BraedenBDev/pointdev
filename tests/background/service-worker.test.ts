import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleMessage } from '../../src/background/message-handler'
import { SessionStore } from '../../src/background/session-store'

// Mock chrome APIs
vi.stubGlobal('chrome', {
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com', title: 'Test' }]),
    captureVisibleTab: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    session: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
})

describe('handleMessage', () => {
  let store: SessionStore

  beforeEach(() => {
    store = new SessionStore()
    vi.clearAllMocks()
  })

  it('handles START_CAPTURE', async () => {
    const result = await handleMessage({ type: 'START_CAPTURE' }, store)
    expect(result.type).toBe('SESSION_UPDATED')
    expect(store.getSession()).toBeTruthy()
  })

  it('handles ELEMENT_SELECTED', async () => {
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    await handleMessage({
      type: 'ELEMENT_SELECTED',
      data: {
        selector: 'h1',
        computedStyles: {},
        domSubtree: '<h1>Hi</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }, store)
    expect(store.getSession()?.selectedElement?.selector).toBe('h1')
  })

  it('handles STOP_CAPTURE', async () => {
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const result = await handleMessage({ type: 'STOP_CAPTURE' }, store)
    expect(result.type).toBe('CAPTURE_COMPLETE')
    expect(store.getSession()).toBeNull()
  })

  it('handles TRANSCRIPT_UPDATE', async () => {
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const result = await handleMessage({
      type: 'TRANSCRIPT_UPDATE',
      data: {
        transcript: 'hello world',
        segment: { text: 'hello world', startMs: 1000, endMs: 2000 },
      },
    }, store)
    expect(result.type).toBe('SESSION_UPDATED')
    expect(store.getSession()?.voiceRecording?.transcript).toBe('hello world')
  })

  it('handles ANNOTATION_ADDED', async () => {
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const result = await handleMessage({
      type: 'ANNOTATION_ADDED',
      data: {
        type: 'circle',
        coordinates: { centerX: 100, centerY: 200, radiusX: 50, radiusY: 50 },
        timestampMs: 2300,
      },
    }, store)
    expect(result.type).toBe('SESSION_UPDATED')
    expect(store.getSession()?.annotations).toHaveLength(1)
  })

  it('handles CURSOR_BATCH', async () => {
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const result = await handleMessage({
      type: 'CURSOR_BATCH',
      data: [
        { x: 100, y: 200, timestampMs: 500 },
        { x: 105, y: 202, timestampMs: 600 },
      ],
    }, store)
    expect(result).toBeUndefined()
    expect(store.getSession()?.cursorTrace).toHaveLength(2)
  })
})
