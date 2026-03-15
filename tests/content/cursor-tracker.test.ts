import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CursorTracker } from '../../src/content/cursor-tracker'
import type { CursorSampleData } from '@shared/types'

describe('CursorTracker', () => {
  let tracker: CursorTracker
  let batchCallback: ReturnType<typeof vi.fn>
  let doc: Document
  let win: Window

  beforeEach(() => {
    vi.useFakeTimers()
    batchCallback = vi.fn()
    tracker = new CursorTracker(batchCallback)
    doc = document
    win = window
  })

  afterEach(() => {
    tracker.stop()
    vi.useRealTimers()
  })

  function fireMouseMove(clientX: number, clientY: number) {
    const event = new MouseEvent('mousemove', {
      clientX,
      clientY,
      bubbles: true,
    })
    doc.dispatchEvent(event)
  }

  it('starts and stops without errors', () => {
    const now = Date.now()
    tracker.start(now, doc, win)
    tracker.stop()
  })

  it('collects cursor samples on mousemove', () => {
    const startTime = Date.now()
    tracker.start(startTime, doc, win)

    fireMouseMove(100, 200)
    vi.advanceTimersByTime(100)
    fireMouseMove(150, 250)

    // Flush via stop
    const remaining = tracker.stop()
    const total = batchCallback.mock.calls.reduce(
      (acc: CursorSampleData[], call: [CursorSampleData[]]) => acc.concat(call[0]),
      [] as CursorSampleData[],
    )
    const allSamples = total.concat(remaining)

    expect(allSamples.length).toBeGreaterThanOrEqual(2)
    expect(allSamples[0].x).toBeTypeOf('number')
    expect(allSamples[0].y).toBeTypeOf('number')
    expect(allSamples[0].timestampMs).toBeTypeOf('number')
  })

  it('throttles samples to SAMPLE_INTERVAL_MS (100ms)', () => {
    const startTime = Date.now()
    tracker.start(startTime, doc, win)

    // Fire multiple moves within 100ms — only the first should be captured
    fireMouseMove(10, 10)
    vi.advanceTimersByTime(50)
    fireMouseMove(20, 20)
    vi.advanceTimersByTime(50)
    // Now 100ms have passed, next should be captured
    fireMouseMove(30, 30)

    const remaining = tracker.stop()
    const total = batchCallback.mock.calls.reduce(
      (acc: CursorSampleData[], call: [CursorSampleData[]]) => acc.concat(call[0]),
      [] as CursorSampleData[],
    )
    const allSamples = total.concat(remaining)

    // Should have exactly 2: the first one and the one after 100ms
    expect(allSamples).toHaveLength(2)
  })

  it('fires onBatch callback every 500ms with buffered samples', () => {
    const startTime = Date.now()
    tracker.start(startTime, doc, win)

    // Generate a few samples
    fireMouseMove(10, 20)
    vi.advanceTimersByTime(100)
    fireMouseMove(30, 40)
    vi.advanceTimersByTime(100)
    fireMouseMove(50, 60)

    // Batch hasn't fired yet (only 200ms elapsed)
    expect(batchCallback).not.toHaveBeenCalled()

    // Advance to 500ms total to trigger batch
    vi.advanceTimersByTime(300)

    expect(batchCallback).toHaveBeenCalledTimes(1)
    const batch = batchCallback.mock.calls[0][0] as CursorSampleData[]
    expect(batch.length).toBeGreaterThanOrEqual(1)
  })

  it('stop() returns remaining buffered samples', () => {
    const startTime = Date.now()
    tracker.start(startTime, doc, win)

    fireMouseMove(100, 200)
    vi.advanceTimersByTime(100)
    fireMouseMove(150, 250)

    // Don't wait for batch interval — stop immediately
    const remaining = tracker.stop()
    expect(remaining.length).toBeGreaterThanOrEqual(1)
    expect(remaining[0]).toHaveProperty('x')
    expect(remaining[0]).toHaveProperty('y')
    expect(remaining[0]).toHaveProperty('timestampMs')
  })

  it('stop() clears the buffer so second stop returns empty', () => {
    const startTime = Date.now()
    tracker.start(startTime, doc, win)

    fireMouseMove(100, 200)
    tracker.stop()

    // Second stop should return nothing
    const secondStop = tracker.stop()
    expect(secondStop).toHaveLength(0)
  })

  it('records page-relative coordinates (clientX + scrollX)', () => {
    const startTime = Date.now()
    // In jsdom scrollX/scrollY default to 0, so page coords = client coords
    tracker.start(startTime, doc, win)

    fireMouseMove(75, 150)

    const remaining = tracker.stop()
    expect(remaining).toHaveLength(1)
    // With scroll at 0: page coords should equal client coords
    expect(remaining[0].x).toBe(75)
    expect(remaining[0].y).toBe(150)
  })

  it('computes timestampMs relative to captureStartedAt', () => {
    const startTime = Date.now()
    tracker.start(startTime, doc, win)

    vi.advanceTimersByTime(250)
    fireMouseMove(10, 10)

    const remaining = tracker.stop()
    expect(remaining).toHaveLength(1)
    // timestampMs should be approximately 250 (relative to start)
    expect(remaining[0].timestampMs).toBe(250)
  })

  it('does not collect samples after stop()', () => {
    const startTime = Date.now()
    tracker.start(startTime, doc, win)
    tracker.stop()

    // Fire mouse move after stopping
    vi.advanceTimersByTime(200)
    fireMouseMove(999, 999)

    // Advance past batch interval
    vi.advanceTimersByTime(600)

    expect(batchCallback).not.toHaveBeenCalled()
  })
})
