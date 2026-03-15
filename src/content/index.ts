import { CanvasOverlay } from './canvas-overlay'
import { CursorTracker } from './cursor-tracker'
import { extractElementData, findNearestElement } from './element-selector'
import { inspectReactComponent } from './react-inspector'
import { collectDeviceMetadata } from './device-metadata'
import type { CaptureMode } from '@shared/messages'

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
}

function handleMouseMove(e: MouseEvent) {
  if (!drawStart || !overlay) return
  if (currentMode === 'circle') {
    overlay.drawCirclePreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  } else if (currentMode === 'arrow') {
    overlay.drawArrowPreview(drawStart, { clientX: e.clientX, clientY: e.clientY })
  }
}

function handleMouseUp(e: MouseEvent) {
  if (!drawStart || !overlay) return

  const annotation = overlay.completeAnnotation(
    drawStart,
    { clientX: e.clientX, clientY: e.clientY },
    captureStartedAt,
    Date.now()
  )

  drawStart = null

  if (annotation) {
    // Resolve nearest element at the annotation's focal point
    const coords = annotation.coordinates as Record<string, number>
    const viewportX = annotation.type === 'circle'
      ? coords.centerX - window.scrollX
      : coords.endX - window.scrollX
    const viewportY = annotation.type === 'circle'
      ? coords.centerY - window.scrollY
      : coords.endY - window.scrollY

    const nearestEl = findNearestElement(viewportX, viewportY, document)
    if (nearestEl && generateSelector) {
      annotation.nearestElement = generateSelector(nearestEl)
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

// Message listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      sendResponse({ type: 'PONG' })
      break
    case 'INJECT_CAPTURE':
      startCapture()
      chrome.runtime.sendMessage({ type: 'DEVICE_METADATA', data: collectDeviceMetadata(window) })
      sendResponse({
        ok: true,
        url: window.location.href,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      })
      break
    case 'REMOVE_CAPTURE':
      stopCapture()
      sendResponse({ ok: true })
      break
    case 'MODE_CHANGED':
      currentMode = message.mode
      if (overlay) overlay.setMode(message.mode)
      sendResponse({ ok: true })
      break
  }
  return true
})
