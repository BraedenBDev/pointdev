import { describe, it, expect } from 'vitest'
import type { CaptureSession, CircleCoords, ArrowCoords } from '@shared/types'
import { createEmptySession } from '@shared/types'

describe('CaptureSession types', () => {
  it('creates a valid empty session', () => {
    const session: CaptureSession = {
      id: 'test-1',
      tabId: 1,
      startedAt: Date.now(),
      url: 'https://example.com',
      title: 'Test',
      viewport: { width: 1200, height: 800 },
      selectedElement: null,
      voiceRecording: null,
      annotations: [],
      cursorTrace: [],
      screenshots: [],
    }
    expect(session.id).toBe('test-1')
    expect(session.annotations).toHaveLength(0)
  })

  it('creates a session with all layers populated', () => {
    const session: CaptureSession = {
      id: 'test-2',
      tabId: 1,
      startedAt: 1000,
      url: 'https://example.com',
      title: 'Test',
      viewport: { width: 1200, height: 800 },
      selectedElement: {
        selector: 'div.hero > h1',
        computedStyles: { 'font-size': '32px' },
        domSubtree: '<h1>Hello</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
        reactComponent: { name: 'HeroSection', filePath: 'src/Hero.tsx' },
      },
      voiceRecording: {
        transcript: 'the font is too small',
        durationMs: 5000,
        segments: [{ text: 'the font is too small', startMs: 2300, endMs: 4800 }],
      },
      annotations: [
        {
          type: 'circle',
          coordinates: { centerX: 340, centerY: 180, radiusX: 85, radiusY: 85 } as CircleCoords,
          timestampMs: 2300,
          nearestElement: 'div.hero > h1',
        },
      ],
      cursorTrace: [
        { x: 340, y: 180, timestampMs: 2200, nearestElement: 'div.hero > h1', dwellMs: 3100 },
      ],
      screenshots: [
        { selector: 'div.hero > h1', timestampMs: 5000, dataUrl: 'data:image/png;base64,abc', width: 340, height: 50 },
      ],
    }
    expect(session.selectedElement?.reactComponent?.name).toBe('HeroSection')
    expect(session.annotations).toHaveLength(1)
    expect(session.annotations[0].type).toBe('circle')
  })

  it('createEmptySession factory returns correct defaults', () => {
    const session = createEmptySession('s-1', 42, 'https://example.com', 'Example', { width: 1920, height: 1080 })
    expect(session.id).toBe('s-1')
    expect(session.tabId).toBe(42)
    expect(session.url).toBe('https://example.com')
    expect(session.title).toBe('Example')
    expect(session.viewport).toEqual({ width: 1920, height: 1080 })
    expect(session.selectedElement).toBeNull()
    expect(session.voiceRecording).toBeNull()
    expect(session.annotations).toEqual([])
    expect(session.cursorTrace).toEqual([])
    expect(session.screenshots).toEqual([])
    expect(session.startedAt).toBeGreaterThan(0)
  })
})
