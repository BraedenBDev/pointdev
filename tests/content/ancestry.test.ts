import { describe, it, expect, vi } from 'vitest'
import { getAncestryChain } from '../../src/content/element-selector'

function mockElement(tag: string, attrs: Record<string, string> = {}, parent?: any): any {
  const el = {
    tagName: tag.toUpperCase(),
    parentElement: parent || null,
    hasAttribute: vi.fn((name: string) => name in attrs),
    getAttribute: vi.fn((name: string) => attrs[name] || null),
  }
  return el
}

describe('getAncestryChain', () => {
  it('returns chain from element to ancestors', () => {
    const grandparent = mockElement('section')
    const parent = mockElement('div', {}, grandparent)
    const child = mockElement('span', {}, parent)

    const chain = getAncestryChain(child)
    expect(chain).toHaveLength(3)
    expect(chain[0].tagName).toBe('SPAN')
    expect(chain[1].tagName).toBe('DIV')
    expect(chain[2].tagName).toBe('SECTION')
  })

  it('stops at document.body', () => {
    const body = mockElement('body')
    const div = mockElement('div', {}, body)
    const span = mockElement('span', {}, div)

    const chain = getAncestryChain(span)
    expect(chain).toHaveLength(2) // span, div — stops before body
    expect(chain[chain.length - 1].tagName).toBe('DIV')
  })

  it('caps at maxDepth', () => {
    // Build a chain of 15 elements
    let current: any = mockElement('div')
    for (let i = 0; i < 14; i++) {
      current = mockElement('div', {}, current)
    }

    const chain = getAncestryChain(current, 10)
    expect(chain).toHaveLength(10)
  })

  it('skips elements with data-pointdev attribute', () => {
    const grandparent = mockElement('section')
    const overlay = mockElement('div', { 'data-pointdev': 'overlay' }, grandparent)
    const child = mockElement('span', {}, overlay)

    const chain = getAncestryChain(child)
    // Should skip the overlay element
    expect(chain.find((el: any) => el.hasAttribute('data-pointdev'))).toBeUndefined()
  })
})
