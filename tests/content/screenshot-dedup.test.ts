import { describe, it, expect } from 'vitest'

// Test the dedup logic as a pure function (extracted for testability)
function shouldCapture(
  now: number,
  lastTime: number,
  lastScroll: { x: number; y: number },
  currentScroll: { x: number; y: number }
): { capture: boolean; replacesPrevious: boolean } {
  const scrollChanged = currentScroll.x !== lastScroll.x || currentScroll.y !== lastScroll.y
  const withinWindow = (now - lastTime) < 2000 && lastTime > 0

  if (!withinWindow || scrollChanged) {
    return { capture: true, replacesPrevious: false }
  }
  // Within time window, same scroll — group with previous
  return { capture: true, replacesPrevious: true }
}

describe('screenshot dedup logic', () => {
  it('always captures first annotation', () => {
    const result = shouldCapture(1000, 0, { x: 0, y: 0 }, { x: 0, y: 0 })
    expect(result.capture).toBe(true)
    expect(result.replacesPrevious).toBe(false)
  })

  it('groups two annotations < 2s apart, same scroll', () => {
    const result = shouldCapture(2500, 1000, { x: 0, y: 0 }, { x: 0, y: 0 })
    expect(result.capture).toBe(true)
    expect(result.replacesPrevious).toBe(true)
  })

  it('separates two annotations > 2s apart', () => {
    const result = shouldCapture(5000, 1000, { x: 0, y: 0 }, { x: 0, y: 0 })
    expect(result.capture).toBe(true)
    expect(result.replacesPrevious).toBe(false)
  })

  it('separates annotations with different scroll', () => {
    const result = shouldCapture(1500, 1000, { x: 0, y: 0 }, { x: 0, y: 500 })
    expect(result.capture).toBe(true)
    expect(result.replacesPrevious).toBe(false)
  })

  it('groups rapid-fire annotations', () => {
    // Simulate 5 annotations in 2s
    let lastTime = 1000
    for (let i = 0; i < 4; i++) {
      const t = 1400 + i * 400
      const result = shouldCapture(t, lastTime, { x: 0, y: 0 }, { x: 0, y: 0 })
      expect(result.replacesPrevious).toBe(true)
      lastTime = t
    }
  })
})
