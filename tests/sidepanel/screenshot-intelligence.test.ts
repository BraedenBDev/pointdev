import { describe, it, expect } from 'vitest'
import { computeInterestScore, type InterestSignals } from '../../src/sidepanel/screenshot-intelligence'

function makeSignals(overrides: Partial<InterestSignals> = {}): InterestSignals {
  return {
    frameDiffRatio: 0,
    dwellActive: false,
    voiceActive: false,
    annotationJustMade: false,
    ...overrides,
  }
}

describe('computeInterestScore', () => {
  it('returns 1.0 for annotations (bypass)', () => {
    const score = computeInterestScore(makeSignals({ annotationJustMade: true }))
    expect(score).toBe(1.0)
  })

  it('returns 0 when all signals are inactive', () => {
    const score = computeInterestScore(makeSignals())
    expect(score).toBe(0)
  })

  it('returns 0 when frame diff is below threshold', () => {
    // 3% change, threshold is 5%
    const score = computeInterestScore(makeSignals({ frameDiffRatio: 0.03 }))
    expect(score).toBe(0)
  })

  it('scores frame diff above threshold at 0.3 weight', () => {
    // 50% pixel change → scaled to 1.0, * 0.3 weight
    const score = computeInterestScore(makeSignals({ frameDiffRatio: 0.5 }))
    expect(score).toBeCloseTo(0.3, 2)
  })

  it('caps frame diff contribution at weight maximum', () => {
    // 100% pixel change → capped at 1.0, * 0.3 weight
    const score = computeInterestScore(makeSignals({ frameDiffRatio: 1.0 }))
    expect(score).toBeCloseTo(0.3, 2)
  })

  it('scores voice alone at 0.35 weight', () => {
    const score = computeInterestScore(makeSignals({ voiceActive: true }))
    expect(score).toBeCloseTo(0.35, 2)
  })

  it('scores dwell alone at 0.25 weight', () => {
    const score = computeInterestScore(makeSignals({ dwellActive: true }))
    expect(score).toBeCloseTo(0.25, 2)
  })

  it('voice alone exceeds interest threshold (0.4) — no capture', () => {
    const score = computeInterestScore(makeSignals({ voiceActive: true }))
    expect(score).toBeLessThan(0.4)
  })

  it('voice + dwell exceeds threshold — triggers capture', () => {
    const score = computeInterestScore(makeSignals({
      voiceActive: true,
      dwellActive: true,
    }))
    expect(score).toBeCloseTo(0.6, 2)
    expect(score).toBeGreaterThan(0.4)
  })

  it('voice + frame diff exceeds threshold', () => {
    const score = computeInterestScore(makeSignals({
      voiceActive: true,
      frameDiffRatio: 0.1, // 10% change → scaled to 0.2, * 0.3 = 0.06
    }))
    // 0.06 + 0.35 = 0.41
    expect(score).toBeGreaterThan(0.4)
  })

  it('all three signals produce high score', () => {
    const score = computeInterestScore(makeSignals({
      frameDiffRatio: 0.5,
      dwellActive: true,
      voiceActive: true,
    }))
    // 0.3 + 0.25 + 0.35 = 0.9
    expect(score).toBeCloseTo(0.9, 2)
  })

  it('small frame diff + voice does not trigger', () => {
    // 4% change (below 5% threshold) + voice
    const score = computeInterestScore(makeSignals({
      frameDiffRatio: 0.04,
      voiceActive: true,
    }))
    // frame diff = 0, voice = 0.35 → 0.35 < 0.4
    expect(score).toBeCloseTo(0.35, 2)
    expect(score).toBeLessThan(0.4)
  })

  it('annotation overrides even when other signals are inactive', () => {
    const score = computeInterestScore(makeSignals({
      annotationJustMade: true,
      frameDiffRatio: 0,
      voiceActive: false,
      dwellActive: false,
    }))
    expect(score).toBe(1.0)
  })

  it('preserves optional metadata fields without affecting score', () => {
    const score = computeInterestScore(makeSignals({
      voiceActive: true,
      voiceSegment: 'this button is broken',
      dwellActive: true,
      dwellElement: '.hero-button',
      dwellDurationMs: 3200,
    }))
    // Score should be same as voice + dwell without metadata
    expect(score).toBeCloseTo(0.6, 2)
  })
})
