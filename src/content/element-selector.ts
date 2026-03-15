import type { SelectedElementData } from '@shared/types'

export const COMPUTED_STYLE_PROPS = [
  'font-size', 'font-weight', 'font-family',
  'color', 'background-color',
  'width', 'height',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'display', 'position',
]

export function extractElementData(
  element: Element,
  selector: string,
  getComputedStyle: (el: Element) => CSSStyleDeclaration,
  scroll: { scrollX: number; scrollY: number }
): SelectedElementData {
  const computed = getComputedStyle(element)
  const styles: Record<string, string> = {}
  for (const prop of COMPUTED_STYLE_PROPS) {
    const value = computed.getPropertyValue(prop)
    if (value && value !== '' && value !== 'normal' && value !== 'none' && value !== 'auto') {
      styles[prop] = value
    }
  }

  const rect = element.getBoundingClientRect()
  const boundingRect = {
    x: rect.x + scroll.scrollX,
    y: rect.y + scroll.scrollY,
    width: rect.width,
    height: rect.height,
    top: rect.top + scroll.scrollY,
    right: rect.right + scroll.scrollX,
    bottom: rect.bottom + scroll.scrollY,
    left: rect.left + scroll.scrollX,
    toJSON: () => ({}),
  }

  let domSubtree = element.outerHTML
  if (domSubtree.length > 500) {
    domSubtree = domSubtree.slice(0, 500) + '<!-- truncated -->'
  }

  return {
    selector,
    computedStyles: styles,
    domSubtree,
    boundingRect: boundingRect as DOMRect,
  }
}

export function findNearestElement(
  viewportX: number,
  viewportY: number,
  doc: Document
): Element | null {
  const elements = doc.elementsFromPoint(viewportX, viewportY)
  for (const el of elements) {
    if (el.hasAttribute('data-pointdev')) continue
    if (el.tagName === 'HTML' || el.tagName === 'BODY') continue
    return el
  }
  return null
}
