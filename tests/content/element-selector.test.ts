import { describe, it, expect, vi } from 'vitest'
import { extractElementData, COMPUTED_STYLE_PROPS } from '../../src/content/element-selector'

// Mock document and window
const mockElement = {
  tagName: 'H1',
  className: 'hero-title',
  id: '',
  outerHTML: '<h1 class="hero-title">Hello World</h1>',
  getBoundingClientRect: () => ({ x: 10, y: 20, width: 200, height: 40, top: 20, right: 210, bottom: 60, left: 10, toJSON: () => ({}) }),
  getAttribute: vi.fn(() => null),
  closest: vi.fn(() => null),
}

describe('extractElementData', () => {
  it('extracts selector, styles, and DOM subtree', () => {
    const mockGetComputedStyle = vi.fn(() => {
      const styles: Record<string, string> = { 'font-size': '32px', 'color': 'rgb(0,0,0)' }
      return { getPropertyValue: (prop: string) => styles[prop] || '' }
    })

    const data = extractElementData(
      mockElement as any,
      'h1.hero-title',
      mockGetComputedStyle as any,
      { scrollX: 0, scrollY: 100 }
    )

    expect(data.selector).toBe('h1.hero-title')
    expect(data.domSubtree).toContain('hero-title')
    expect(data.boundingRect).toBeTruthy()
  })

  it('defines the correct computed style properties list', () => {
    expect(COMPUTED_STYLE_PROPS).toContain('font-size')
    expect(COMPUTED_STYLE_PROPS).toContain('padding-top')
    expect(COMPUTED_STYLE_PROPS).toContain('margin-left')
    expect(COMPUTED_STYLE_PROPS).not.toContain('padding') // shorthand
    expect(COMPUTED_STYLE_PROPS).not.toContain('margin')   // shorthand
  })
})
