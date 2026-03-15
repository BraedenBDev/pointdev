import { describe, it, expect } from 'vitest'
import { computeDwells, distance } from '@shared/dwell'
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

  it('does not set dwellMs when duration is under 500ms', () => {
    const samples: CursorSampleData[] = [
      { x: 100, y: 100, timestampMs: 0 },
      { x: 105, y: 100, timestampMs: 200 },
      { x: 110, y: 100, timestampMs: 400 },
    ]
    const result = computeDwells(samples)
    expect(result.every((s) => s.dwellMs === undefined)).toBe(true)
  })

  it('sets dwellMs for a group that stays within 30px for >500ms', () => {
    const samples: CursorSampleData[] = [
      { x: 100, y: 100, timestampMs: 0 },
      { x: 110, y: 105, timestampMs: 200 },
      { x: 105, y: 110, timestampMs: 400 },
      { x: 108, y: 103, timestampMs: 600 },
    ]
    const result = computeDwells(samples)
    // Duration from first to last = 600ms, all within 30px
    expect(result[0].dwellMs).toBe(600)
    expect(result[1].dwellMs).toBe(600)
    expect(result[2].dwellMs).toBe(600)
    expect(result[3].dwellMs).toBe(600)
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
      // First dwell group: near (100, 100) for 800ms
      { x: 100, y: 100, timestampMs: 0 },
      { x: 105, y: 102, timestampMs: 300 },
      { x: 103, y: 98, timestampMs: 800 },
      // Movement: jumps far away
      { x: 500, y: 500, timestampMs: 900 },
      // Second dwell group: near (500, 500) for 700ms
      { x: 502, y: 503, timestampMs: 1200 },
      { x: 498, y: 501, timestampMs: 1600 },
    ]
    const result = computeDwells(samples)
    // First group: indices 0-2, duration = 800ms
    expect(result[0].dwellMs).toBe(800)
    expect(result[1].dwellMs).toBe(800)
    expect(result[2].dwellMs).toBe(800)
    // Movement sample: starts its own group with samples[4] and [5]
    // samples[3] at (500,500), samples[4] at (502,503) is within 30px
    // samples[5] at (498,501) is within 30px of (500,500)
    // Duration from sample[3] to sample[5] = 1600 - 900 = 700ms
    expect(result[3].dwellMs).toBe(700)
    expect(result[4].dwellMs).toBe(700)
    expect(result[5].dwellMs).toBe(700)
  })

  it('does not count samples beyond 30px radius', () => {
    const samples: CursorSampleData[] = [
      { x: 0, y: 0, timestampMs: 0 },
      { x: 0, y: 0, timestampMs: 600 },
      { x: 50, y: 50, timestampMs: 700 }, // > 30px away from anchor
    ]
    const result = computeDwells(samples)
    expect(result[0].dwellMs).toBe(600)
    expect(result[1].dwellMs).toBe(600)
    expect(result[2].dwellMs).toBeUndefined() // lone sample, no dwell
  })
})
