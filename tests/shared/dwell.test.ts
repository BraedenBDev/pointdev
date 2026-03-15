import { describe, it, expect } from 'vitest'
import { computeDwells, collapseDwells, distance } from '@shared/dwell'
import type { CursorSampleData } from '@shared/types'

describe('distance', () => {
  it('returns 0 for the same point', () => {
    const a: CursorSampleData = { x: 10, y: 20, timestampMs: 0 }
    expect(distance(a, a)).toBe(0)
  })

  it('computes correct euclidean distance', () => {
    const a: CursorSampleData = { x: 0, y: 0, timestampMs: 0 }
    const b: CursorSampleData = { x: 3, y: 4, timestampMs: 100 }
    expect(distance(a, b)).toBe(5)
  })
})

describe('computeDwells', () => {
  it('returns empty array for empty input', () => {
    expect(computeDwells([])).toEqual([])
  })

  it('does not set dwellMs when duration is under 1000ms', () => {
    const samples: CursorSampleData[] = [
      { x: 100, y: 100, timestampMs: 0 },
      { x: 105, y: 100, timestampMs: 200 },
      { x: 110, y: 100, timestampMs: 400 },
    ]
    const result = computeDwells(samples)
    expect(result.every((s) => s.dwellMs === undefined)).toBe(true)
  })

  it('sets dwellMs for a group that stays within 30px for >1000ms', () => {
    const samples: CursorSampleData[] = [
      { x: 100, y: 100, timestampMs: 0 },
      { x: 110, y: 105, timestampMs: 300 },
      { x: 105, y: 110, timestampMs: 700 },
      { x: 108, y: 103, timestampMs: 1200 },
    ]
    const result = computeDwells(samples)
    // Duration from first to last = 1200ms, all within 30px
    expect(result[0].dwellMs).toBe(1200)
    expect(result[1].dwellMs).toBe(1200)
    expect(result[2].dwellMs).toBe(1200)
    expect(result[3].dwellMs).toBe(1200)
  })

  it('does not mutate the input array', () => {
    const samples: CursorSampleData[] = [
      { x: 100, y: 100, timestampMs: 0 },
      { x: 100, y: 100, timestampMs: 1000 },
    ]
    computeDwells(samples)
    expect(samples[0].dwellMs).toBeUndefined()
    expect(samples[1].dwellMs).toBeUndefined()
  })

  it('handles multiple dwell groups separated by movement', () => {
    const samples: CursorSampleData[] = [
      // First dwell group: near (100, 100) for 1200ms
      { x: 100, y: 100, timestampMs: 0 },
      { x: 105, y: 102, timestampMs: 500 },
      { x: 103, y: 98, timestampMs: 1200 },
      // Movement: jumps far away
      { x: 500, y: 500, timestampMs: 1300 },
      // Second dwell group: near (500, 500) for 1100ms
      { x: 502, y: 503, timestampMs: 1800 },
      { x: 498, y: 501, timestampMs: 2400 },
    ]
    const result = computeDwells(samples)
    // First group: indices 0-2, duration = 1200ms
    expect(result[0].dwellMs).toBe(1200)
    expect(result[1].dwellMs).toBe(1200)
    expect(result[2].dwellMs).toBe(1200)
    // Movement sample: starts its own group with samples[4] and [5]
    // samples[3] at (500,500), samples[4] at (502,503) is within 30px
    // samples[5] at (498,501) is within 30px of (500,500)
    // Duration from sample[3] to sample[5] = 2400 - 1300 = 1100ms
    expect(result[3].dwellMs).toBe(1100)
    expect(result[4].dwellMs).toBe(1100)
    expect(result[5].dwellMs).toBe(1100)
  })

  it('does not count samples beyond 30px radius', () => {
    const samples: CursorSampleData[] = [
      { x: 0, y: 0, timestampMs: 0 },
      { x: 0, y: 0, timestampMs: 1200 },
      { x: 50, y: 50, timestampMs: 1300 }, // > 30px away from anchor
    ]
    const result = computeDwells(samples)
    expect(result[0].dwellMs).toBe(1200)
    expect(result[1].dwellMs).toBe(1200)
    expect(result[2].dwellMs).toBeUndefined() // lone sample, no dwell
  })
})

describe('collapseDwells', () => {
  it('returns empty array for empty input', () => {
    expect(collapseDwells([])).toEqual([])
  })

  it('single dwell passes through unchanged', () => {
    const samples: CursorSampleData[] = [
      { x: 10, y: 20, timestampMs: 0, dwellMs: 1500, nearestElement: 'div.hero' },
    ]
    const result = collapseDwells(samples)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      x: 10,
      y: 20,
      timestampMs: 0,
      dwellMs: 1500,
      nearestElement: 'div.hero',
    })
  })

  it('collapses consecutive same-element dwells into one', () => {
    const samples: CursorSampleData[] = [
      { x: 10, y: 20, timestampMs: 1000, dwellMs: 1200, nearestElement: 'h1.font-display' },
      { x: 12, y: 22, timestampMs: 1100, dwellMs: 1200, nearestElement: 'h1.font-display' },
      { x: 11, y: 21, timestampMs: 1200, dwellMs: 1200, nearestElement: 'h1.font-display' },
    ]
    const result = collapseDwells(samples)
    expect(result).toHaveLength(1)
    expect(result[0].timestampMs).toBe(1000)
    // Span from first start (1000) to last end (1200 + 1200 = 2400)
    expect(result[0].dwellMs).toBe(1400)
    expect(result[0].nearestElement).toBe('h1.font-display')
  })

  it('preserves dwells on different elements as separate entries', () => {
    const samples: CursorSampleData[] = [
      { x: 10, y: 20, timestampMs: 0, dwellMs: 1500, nearestElement: 'div.hero' },
      { x: 10, y: 20, timestampMs: 200, dwellMs: 1500, nearestElement: 'div.hero' },
      { x: 100, y: 200, timestampMs: 2000, dwellMs: 1100, nearestElement: 'button.cta' },
      { x: 100, y: 200, timestampMs: 2200, dwellMs: 1100, nearestElement: 'button.cta' },
      { x: 300, y: 400, timestampMs: 4000, dwellMs: 1300, nearestElement: 'footer.main' },
    ]
    const result = collapseDwells(samples)
    expect(result).toHaveLength(3)
    expect(result[0].nearestElement).toBe('div.hero')
    expect(result[1].nearestElement).toBe('button.cta')
    expect(result[2].nearestElement).toBe('footer.main')
  })

  it('ignores samples without dwellMs', () => {
    const samples: CursorSampleData[] = [
      { x: 10, y: 20, timestampMs: 0 },
      { x: 10, y: 20, timestampMs: 100, dwellMs: 1500, nearestElement: 'div.hero' },
      { x: 50, y: 50, timestampMs: 500 },
    ]
    const result = collapseDwells(samples)
    expect(result).toHaveLength(1)
    expect(result[0].nearestElement).toBe('div.hero')
  })
})
