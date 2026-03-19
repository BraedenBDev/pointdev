import { CanvasOverlay } from './canvas-overlay'
import { CursorTracker } from './cursor-tracker'
import { ConsoleNetworkCapture } from './console-network-capture'
import { extractElementData, findNearestElement, discoverCssVariables, getAncestryChain } from './element-selector'
import { inspectReactComponent } from './react-inspector'
import { collectDeviceMetadata } from './device-metadata'
import type { CaptureMode } from '@shared/messages'
import type { AnnotationData, CircleCoords, ArrowCoords, FreehandCoords, RectangleCoords } from '@shared/types'

// Use dynamic import of css-selector-generator to keep it tree-shakeable
let generateSelector: ((el: Element) => string) | null = null
import('css-selector-generator').then(mod => {
  generateSelector = mod.getCSSSelector || mod.default
}).catch(() => {
  // Fallback: simple selector
  generateSelector = (el: Element) => {
    if (el.id) return `#${el.id}`
    let path = el.tagName.toLowerCase()
    if (el.className && typeof el.className === 'string') {
      path += '.' + el.className.trim().split(/\s+/).join('.')
    }
    return path
  }
})

let overlay: CanvasOverlay | null = null
let cursorTracker: CursorTracker | null = null
let consoleCapture: ConsoleNetworkCapture | null = null
let captureStartedAt = 0
let isCapturing = false
let currentMode: CaptureMode = 'select'

// Drawing state
let drawStart: { clientX: number; clientY: number } | null = null
let freehandPoints: Array<{ clientX: number; clientY: number }> = []

// Ancestry cycling state
let hoveredElement: Element | null = null
let ancestryChain: Element[] = []
let ancestryIndex = 0
let highlightEl: HTMLElement | null = null

function handleClick(e: MouseEvent) {
  if (!isCapturing || currentMode !== 'select') return

  e.preventDefault()
  e.stopPropagation()

  // Use ancestry-adjusted element if available, otherwise findNearestElement
  const element = (ancestryChain.length > 0 && hoveredElement)
    ? ancestryChain[ancestryIndex]
    : findNearestElement(e.clientX, e.clientY, document)
  if (!element) return

  const selector = generateSelector ? generateSelector(element) : element.tagName.toLowerCase()
  const data = extractElementData(
    element,
    selector,
    window.getComputedStyle.bind(window),
    { scrollX: window.scrollX, scrollY: window.scrollY }
  )

  // Try React inspection
  const reactInfo = inspectReactComponent(element)
  if (reactInfo) {
    data.reactComponent = reactInfo
  }

  // Discover CSS custom properties
  const cssVars = discoverCssVariables(element, document)
  if (Object.keys(cssVars).length > 0) {
    data.cssVariables = cssVars
  }

  chrome.runtime.sendMessage({ type: 'ELEMENT_SELECTED', data })

  // Request an element-scoped screenshot from the service worker
  const rect = element.getBoundingClientRect()
  chrome.runtime.sendMessage({
    type: 'SCREENSHOT_REQUEST',
    data: {
      selector,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      timestampMs: Date.now() - captureStartedAt,
    },
  })
}

function handleMouseDown(e: MouseEvent) {
  if (!isCapturing || currentMode === 'select' || !overlay) return
  drawStart = { clientX: e.clientX, clientY: e.clientY }
  if (currentMode === 'freehand') {
    freehandPoints = [{ clientX: e.clientX, clientY: e.clientY }]
  }
}

function handleMouseMove(e: MouseEvent) {
  // Update hovered element for ancestry cycling in select mode
  if (isCapturing && currentMode === 'select') {
    const el = findNearestElement(e.clientX, e.clientY, document)
    if (el !== hoveredElement) {
      hoveredElement = el
      ancestryChain = el ? getAncestryChain(el) : []
      ancestryIndex = 0
      updateHighlight(el)
    }
  }

  if (!drawStart || !overlay) return
  if (currentMode === 'circle') {
    overlay.drawCirclePreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  } else if (currentMode === 'arrow') {
    overlay.drawArrowPreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  } else if (currentMode === 'freehand') {
    // Throttle: skip points within 3px of the last one to avoid excessive accumulation
    const last = freehandPoints[freehandPoints.length - 1]
    if (!last || Math.abs(e.clientX - last.clientX) > 3 || Math.abs(e.clientY - last.clientY) > 3) {
      freehandPoints.push({ clientX: e.clientX, clientY: e.clientY })
    }
    overlay.drawFreehandPreview(freehandPoints)
  } else if (currentMode === 'rectangle') {
    overlay.drawRectanglePreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  }
}

function getAnnotationFocalPoint(annotation: AnnotationData): { x: number; y: number } {
  switch (annotation.type) {
    case 'circle': {
      const c = annotation.coordinates as CircleCoords
      return { x: c.centerX, y: c.centerY }
    }
    case 'arrow': {
      const a = annotation.coordinates as ArrowCoords
      return { x: a.endX, y: a.endY }
    }
    case 'freehand': {
      const f = annotation.coordinates as FreehandCoords
      const sumX = f.points.reduce((s, p) => s + p.x, 0)
      const sumY = f.points.reduce((s, p) => s + p.y, 0)
      return { x: sumX / f.points.length, y: sumY / f.points.length }
    }
    case 'rectangle': {
      const r = annotation.coordinates as RectangleCoords
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }
  }
}

function handleMouseUp(e: MouseEvent) {
  if (!drawStart || !overlay) return

  let annotation: AnnotationData | null = null

  if (currentMode === 'freehand') {
    annotation = overlay.completeFreehandAnnotation(freehandPoints, captureStartedAt, Date.now())
    freehandPoints = []
  } else {
    annotation = overlay.completeAnnotation(
      drawStart, { clientX: e.clientX, clientY: e.clientY },
      captureStartedAt, Date.now()
    )
  }

  drawStart = null

  if (annotation) {
    // Resolve focal point for nearestElement lookup (viewport-relative)
    const focalPoint = getAnnotationFocalPoint(annotation)
    const viewportX = focalPoint.x - window.scrollX
    const viewportY = focalPoint.y - window.scrollY

    const nearestEl = findNearestElement(viewportX, viewportY, document)
    if (nearestEl && generateSelector) {
      annotation.nearestElement = generateSelector(nearestEl)
      const elData = extractElementData(
        nearestEl,
        annotation.nearestElement,
        window.getComputedStyle.bind(window),
        { scrollX: window.scrollX, scrollY: window.scrollY }
      )
      annotation.nearestElementContext = {
        computedStyles: elData.computedStyles,
        boxModel: elData.boxModel,
        domSubtree: elData.domSubtree,
      }
    }

    chrome.runtime.sendMessage({ type: 'ANNOTATION_ADDED', data: annotation })
  }
}

function updateHighlight(element: Element | null) {
  if (highlightEl) {
    highlightEl.remove()
    highlightEl = null
  }
  if (!element) return

  const rect = element.getBoundingClientRect()
  highlightEl = document.createElement('div')
  highlightEl.setAttribute('data-pointdev', 'highlight')
  Object.assign(highlightEl.style, {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    outline: '2px dashed #FF3333',
    pointerEvents: 'none',
    zIndex: '2147483646',
  })
  document.body.appendChild(highlightEl)
}

function handleWheel(e: WheelEvent) {
  if (!isCapturing || currentMode !== 'select' || !e.altKey) return
  e.preventDefault()

  if (ancestryChain.length === 0) return

  if (e.deltaY < 0) {
    // Scroll up = select parent
    ancestryIndex = Math.min(ancestryIndex + 1, ancestryChain.length - 1)
  } else {
    // Scroll down = select child
    ancestryIndex = Math.max(ancestryIndex - 1, 0)
  }

  updateHighlight(ancestryChain[ancestryIndex])
}

function startCapture() {
  captureStartedAt = Date.now()
  isCapturing = true
  currentMode = 'select'

  overlay = new CanvasOverlay(document, window)
  overlay.setMode('select')

  cursorTracker = new CursorTracker((batch) => {
    chrome.runtime.sendMessage({ type: 'CURSOR_BATCH', data: batch })
  })
  cursorTracker.start(captureStartedAt, document, window)

  consoleCapture = new ConsoleNetworkCapture((entries, requests) => {
    chrome.runtime.sendMessage({ type: 'CONSOLE_BATCH', data: { entries, requests } })
  })
  consoleCapture.start()

  document.addEventListener('click', handleClick, true)
  document.addEventListener('mousedown', handleMouseDown, true)
  document.addEventListener('mousemove', handleMouseMove, true)
  document.addEventListener('mouseup', handleMouseUp, true)
  document.addEventListener('wheel', handleWheel, { passive: false })
}

function stopCapture() {
  isCapturing = false

  document.removeEventListener('click', handleClick, true)
  document.removeEventListener('mousedown', handleMouseDown, true)
  document.removeEventListener('mousemove', handleMouseMove, true)
  document.removeEventListener('mouseup', handleMouseUp, true)
  document.removeEventListener('wheel', handleWheel)
  hoveredElement = null
  ancestryChain = []
  ancestryIndex = 0
  updateHighlight(null)

  if (consoleCapture) {
    consoleCapture.stop()
    consoleCapture = null
  }

  if (cursorTracker) {
    const remaining = cursorTracker.stop()
    if (remaining.length > 0) {
      chrome.runtime.sendMessage({ type: 'CURSOR_BATCH', data: remaining })
    }
    cursorTracker = null
  }

  if (overlay) {
    overlay.destroy()
    overlay = null
  }
}

// Message listener — only return true for types this context handles
const CONTENT_HANDLED = new Set(['PING', 'INJECT_CAPTURE', 'REMOVE_CAPTURE', 'MODE_CHANGED'])

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!CONTENT_HANDLED.has(message.type)) return false

  switch (message.type) {
    case 'PING':
      sendResponse({ type: 'PONG' })
      return false // synchronous response
    case 'INJECT_CAPTURE':
      startCapture()
      chrome.runtime.sendMessage({ type: 'DEVICE_METADATA', data: collectDeviceMetadata(window) })
      sendResponse({
        ok: true,
        url: window.location.href,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      })
      return false // synchronous response
    case 'REMOVE_CAPTURE':
      stopCapture()
      sendResponse({ ok: true })
      return false // synchronous response
    case 'MODE_CHANGED':
      currentMode = message.mode
      if (overlay) overlay.setMode(message.mode)
      sendResponse({ ok: true })
      return false // synchronous response
  }
})
