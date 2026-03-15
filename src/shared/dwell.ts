import type { CursorSampleData } from './types'

/** Euclidean distance between two cursor samples. */
export function distance(a: CursorSampleData, b: CursorSampleData): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

const DWELL_RADIUS_PX = 30
const DWELL_MIN_MS = 500

/**
 * Compute dwell times for cursor samples.
 *
 * A "dwell" is a group of consecutive samples that all stay within a 30px
 * radius of the group's anchor point for longer than 500ms. Each sample in
 * such a group gets its `dwellMs` set to the total duration of the group.
 * Samples that are not part of a dwell group keep `dwellMs` undefined.
 *
 * Returns a new array (does not mutate the input).
 */
export function computeDwells(samples: CursorSampleData[]): CursorSampleData[] {
  if (samples.length === 0) return []

  const result: CursorSampleData[] = samples.map((s) => ({ ...s }))

  let groupStart = 0

  for (let i = 1; i <= result.length; i++) {
    // Check if current sample breaks out of the group or we've reached the end
    const brokeOut =
      i === result.length || distance(result[groupStart], result[i]) > DWELL_RADIUS_PX

    if (brokeOut) {
      const groupEnd = i - 1
      const durationMs = result[groupEnd].timestampMs - result[groupStart].timestampMs

      if (durationMs >= DWELL_MIN_MS) {
        for (let j = groupStart; j <= groupEnd; j++) {
          result[j].dwellMs = durationMs
        }
      }

      // Start new group from current sample
      groupStart = i
    }
  }

  return result
}
