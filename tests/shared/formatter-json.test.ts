import { describe, it, expect } from 'vitest'
import { formatSessionJSON } from '../../src/shared/formatter'
import { createEmptySession } from '../../src/shared/types'
import type { CaptureSession } from '../../src/shared/types'

function makeSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    ...createEmptySession('test-1', 1, 'https://example.com', 'Test Page', { width: 1440, height: 900 }),
    ...overrides,
  }
}

describe('formatSessionJSON', () => {
  it('returns valid JSON string', () => {
    const session = makeSession()
    const result = formatSessionJSON(session)
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('includes context fields', () => {
    const session = makeSession()
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.context.url).toBe('https://example.com')
    expect(parsed.context.title).toBe('Test Page')
    expect(parsed.context.viewport).toEqual({ width: 1440, height: 900 })
  })

  it('includes voice segments', () => {
    const session = makeSession({
      voiceRecording: {
        transcript: 'hello world',
        durationMs: 5000,
        segments: [
          { text: 'hello', startMs: 1000, endMs: 2000 },
          { text: 'world', startMs: 3000, endMs: 4000 },
        ],
      },
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.voice.segments).toHaveLength(2)
    expect(parsed.voice.segments[0].text).toBe('hello')
    expect(parsed.voice.transcript).toBe('hello world')
  })

  it('includes annotations with coordinates', () => {
    const session = makeSession({
      annotations: [{
        type: 'circle',
        coordinates: { centerX: 100, centerY: 200, radiusX: 50, radiusY: 50 },
        timestampMs: 5000,
        nearestElement: '.btn',
      }],
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.annotations).toHaveLength(1)
    expect(parsed.annotations[0].type).toBe('circle')
    expect(parsed.annotations[0].nearestElement).toBe('.btn')
  })

  it('includes screenshots without dataUrl (too large for clipboard)', () => {
    const session = makeSession({
      screenshots: [{
        dataUrl: 'data:image/jpeg;base64,verylongstring',
        timestampMs: 3000,
        viewport: { scrollX: 0, scrollY: 0 },
        annotationIndices: [],
        descriptionParts: ['Voice narration active'],
        voiceContext: 'this is broken',
        trigger: 'voice',
        interestScore: 0.7,
        signals: { frameDiffRatio: 0.12, voiceSegment: 'this is broken' },
      }],
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.screenshots).toHaveLength(1)
    expect(parsed.screenshots[0].dataUrl).toBeUndefined()
    expect(parsed.screenshots[0].trigger).toBe('voice')
    expect(parsed.screenshots[0].voiceContext).toBe('this is broken')
  })

  it('includes cursor dwells (collapsed)', () => {
    const session = makeSession({
      cursorTrace: [
        { x: 100, y: 100, timestampMs: 0, nearestElement: '.nav', dwellMs: 3000 },
        { x: 100, y: 100, timestampMs: 3000, nearestElement: '.nav', dwellMs: 3000 },
      ],
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.cursor.dwells.length).toBeGreaterThan(0)
    expect(parsed.cursor.dwells[0].element).toBe('.nav')
  })

  it('includes console errors and failed requests', () => {
    const session = makeSession({
      consoleErrors: [{ level: 'error', message: 'TypeError', timestampMs: 1000 }],
      failedRequests: [{ method: 'GET', url: '/api/data', status: 500, statusText: 'Internal Server Error', timestampMs: 2000 }],
    })
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.console.errors).toHaveLength(1)
    expect(parsed.console.failedRequests).toHaveLength(1)
  })

  it('omits empty sections', () => {
    const session = makeSession()
    const parsed = JSON.parse(formatSessionJSON(session))
    expect(parsed.voice).toBeUndefined()
    expect(parsed.annotations).toBeUndefined()
    expect(parsed.cursor).toBeUndefined()
    expect(parsed.console).toBeUndefined()
  })
})
