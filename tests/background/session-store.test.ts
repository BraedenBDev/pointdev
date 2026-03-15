import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionStore } from '../../src/background/session-store'
import type { SelectedElementData, AnnotationData, CursorSampleData, VoiceSegment } from '@shared/types'

// Mock chrome.storage.session
const mockStorage: Record<string, any> = {}
vi.stubGlobal('chrome', {
  storage: {
    session: {
      set: vi.fn((items: Record<string, any>) => {
        Object.assign(mockStorage, items)
        return Promise.resolve()
      }),
      get: vi.fn((keys: string[]) => {
        const result: Record<string, any> = {}
        for (const key of keys) {
          if (key in mockStorage) result[key] = mockStorage[key]
        }
        return Promise.resolve(result)
      }),
      remove: vi.fn((keys: string[]) => {
        for (const key of keys) delete mockStorage[key]
        return Promise.resolve()
      }),
    },
  },
})

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key]
})

describe('SessionStore', () => {
  it('creates a new session', () => {
    const store = new SessionStore()
    const session = store.startSession(1, 'https://example.com', 'Test Page', { width: 1200, height: 800 })
    expect(session.id).toBeTruthy()
    expect(session.url).toBe('https://example.com')
    expect(session.tabId).toBe(1)
    expect(session.selectedElement).toBeNull()
  })

  it('updates selected element', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const element: SelectedElementData = {
      selector: 'div.hero > h1',
      computedStyles: { 'font-size': '32px' },
      domSubtree: '<h1>Hello</h1>',
      boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
    }
    store.setSelectedElement(element)
    expect(store.getSession()?.selectedElement?.selector).toBe('div.hero > h1')
  })

  it('adds annotations', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const annotation: AnnotationData = {
      type: 'circle',
      coordinates: { centerX: 100, centerY: 200, radiusX: 50, radiusY: 50 },
      timestampMs: 2300,
      nearestElement: 'div.hero > h1',
    }
    store.addAnnotation(annotation)
    expect(store.getSession()?.annotations).toHaveLength(1)
  })

  it('updates voice transcript', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const segment: VoiceSegment = { text: 'hello world', startMs: 1000, endMs: 2000 }
    store.updateTranscript('hello world', segment)
    expect(store.getSession()?.voiceRecording?.transcript).toBe('hello world')
    expect(store.getSession()?.voiceRecording?.segments).toHaveLength(1)
  })

  it('adds cursor batch', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const batch: CursorSampleData[] = [
      { x: 100, y: 200, timestampMs: 500 },
      { x: 105, y: 202, timestampMs: 600 },
    ]
    store.addCursorBatch(batch)
    expect(store.getSession()?.cursorTrace).toHaveLength(2)
  })

  it('returns null when no active session', () => {
    const store = new SessionStore()
    expect(store.getSession()).toBeNull()
  })

  it('ends session and returns it', () => {
    const store = new SessionStore()
    store.startSession(1, 'https://example.com', 'Test', { width: 1200, height: 800 })
    const session = store.endSession()
    expect(session).toBeTruthy()
    expect(store.getSession()).toBeNull()
  })
})
