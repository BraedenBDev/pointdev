import { CanvasOverlay } from './canvas-overlay'
import { CursorTracker } from './cursor-tracker'
import { extractElementData, findNearestElement } from './element-selector'
import { inspectReactComponent } from './react-inspector'
import { collectDeviceMetadata } from './device-metadata'
import type { CaptureMode } from '@shared/messages'
import type { AnnotationData } from '@shared/types'

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
let captureStartedAt = 0
let isCapturing = false
let currentMode: CaptureMode = 'select'

// Drawing state
let drawStart: { clientX: number; clientY: number } | null = null
let freehandPoints: Array<{ clientX: number; clientY: number }> = []

function handleClick(e: MouseEvent) {
  if (!isCapturing || currentMode !== 'select') return

  e.preventDefault()
  e.stopPropagation()

  const element = findNearestElement(e.clientX, e.clientY, document)
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
    // Resolve focal point for nearestElement
    let viewportX: number, viewportY: number
    const coords = annotation.coordinates as any

    if (annotation.type === 'circle') {
      viewportX = coords.centerX - window.scrollX
      viewportY = coords.centerY - window.scrollY
    } else if (annotation.type === 'arrow') {
      viewportX = coords.endX - window.scrollX
      viewportY = coords.endY - window.scrollY
    } else if (annotation.type === 'freehand') {
      // Centroid of all points
      const pts = coords.points as Array<{ x: number; y: number }>
      const cx = pts.reduce((s: number, p: { x: number }) => s + p.x, 0) / pts.length
      const cy = pts.reduce((s: number, p: { y: number }) => s + p.y, 0) / pts.length
      viewportX = cx - window.scrollX
      viewportY = cy - window.scrollY
    } else {
      // Rectangle center
      viewportX = coords.x + coords.width / 2 - window.scrollX
      viewportY = coords.y + coords.height / 2 - window.scrollY
    }

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

  document.addEventListener('click', handleClick, true)
  document.addEventListener('mousedown', handleMouseDown, true)
  document.addEventListener('mousemove', handleMouseMove, true)
  document.addEventListener('mouseup', handleMouseUp, true)
}

function stopCapture() {
  isCapturing = false

  document.removeEventListener('click', handleClick, true)
  document.removeEventListener('mousedown', handleMouseDown, true)
  document.removeEventListener('mousemove', handleMouseMove, true)
  document.removeEventListener('mouseup', handleMouseUp, true)

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
