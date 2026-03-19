import { describe, it, expect, vi } from 'vitest'
import { extractElementData, COMPUTED_STYLE_PROPS, discoverCssVariables } from '../../src/content/element-selector'

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

describe('discoverCssVariables', () => {
  it('extracts CSS custom properties from matching rules', () => {
    const mockElement = {
      matches: vi.fn((selector: string) => selector === '.card'),
    }
    const mockDoc = {
      styleSheets: [{
        cssRules: [{
          // Duck-type: has selectorText and style = looks like a CSSStyleRule
          selectorText: '.card',
          style: {
            length: 2,
            0: '--card-bg',
            1: '--card-padding',
            getPropertyValue: (prop: string) => {
              const vals: Record<string, string> = { '--card-bg': '#fff', '--card-padding': '16px' }
              return vals[prop] || ''
            },
          },
        }],
      }],
    }

    const vars = discoverCssVariables(mockElement as any, mockDoc as any)
    expect(vars['--card-bg']).toBe('#fff')
    expect(vars['--card-padding']).toBe('16px')
  })

  it('caps at 50 variables', () => {
    const props = Array.from({ length: 60 }, (_, i) => `--var-${i}`)
    const mockElement = { matches: vi.fn(() => true) }
    const mockRule = {
      selectorText: '.big',
      style: {
        length: 60,
        ...Object.fromEntries(props.map((p, i) => [i, p])),
        getPropertyValue: (prop: string) => 'value',
        item: (i: number) => props[i],
      },
    }
    const mockDoc = {
      styleSheets: [{ cssRules: [mockRule] }],
    }

    const vars = discoverCssVariables(mockElement as any, mockDoc as any)
    expect(Object.keys(vars).length).toBe(50)
  })

  it('skips cross-origin sheets that throw', () => {
    const mockElement = { matches: vi.fn(() => true) }
    const mockDoc = {
      styleSheets: [{
        get cssRules() { throw new DOMException('SecurityError') },
      }],
    }

    const vars = discoverCssVariables(mockElement as any, mockDoc as any)
    expect(Object.keys(vars).length).toBe(0)
  })

  it('handles element.matches throwing SyntaxError', () => {
    const mockElement = {
      matches: vi.fn((sel: string) => {
        if (sel.includes('::')) throw new DOMException('SyntaxError')
        return sel === '.card'
      }),
    }
    const mockDoc = {
      styleSheets: [{
        cssRules: [
          { selectorText: '.card::before', style: { length: 1, 0: '--x', getPropertyValue: () => '1' } },
          { selectorText: '.card', style: { length: 1, 0: '--y', getPropertyValue: () => '2' } },
        ],
      }],
    }

    const vars = discoverCssVariables(mockElement as any, mockDoc as any)
    expect(vars['--y']).toBe('2')
    expect(vars['--x']).toBeUndefined()
  })
})
