import type { CursorSampleData } from '@shared/types'

const SAMPLE_INTERVAL_MS = 100
const BATCH_INTERVAL_MS = 500

export class CursorTracker {
  private buffer: CursorSampleData[] = []
  private intervalId: number | null = null
  private lastSampleTime = 0
  private onBatch: (samples: CursorSampleData[]) => void
  private doc: Document | null = null
  private handleMouseMove: ((e: MouseEvent) => void) | null = null
  private handleMouseOut: ((e: MouseEvent) => void) | null = null
  private lastPointer: { clientX: number; clientY: number } | null = null

  constructor(onBatch: (samples: CursorSampleData[]) => void) {
    this.onBatch = onBatch
  }

  start(captureStartedAt: number, doc: Document, win: Window): void {
    this.buffer = []
    this.doc = doc
    this.lastPointer = null

    const record = (now: number) => {
      const { clientX, clientY } = this.lastPointer!
      // Pausing over PointDev's own floating card (e.g. before clicking Stop) isn't page dwell
      const el = typeof doc.elementFromPoint === 'function' ? doc.elementFromPoint(clientX, clientY) : null
      if (el?.closest('[data-pointdev-float]')) return
      this.lastSampleTime = now
      this.buffer.push({
        x: clientX + win.scrollX,
        y: clientY + win.scrollY,
        timestampMs: now - captureStartedAt,
        nearestElement: resolveNearestSelector(clientX, clientY, doc),
      })
    }

    this.handleMouseMove = (e: MouseEvent) => {
      this.lastPointer = { clientX: e.clientX, clientY: e.clientY }
      const now = Date.now()
      if (now - this.lastSampleTime < SAMPLE_INTERVAL_MS) return
      record(now)
    }

    // relatedTarget is null when the pointer leaves the page (e.g. into the side panel)
    this.handleMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget) this.lastPointer = null
    }

    doc.addEventListener('mousemove', this.handleMouseMove)
    doc.addEventListener('mouseout', this.handleMouseOut)

    this.intervalId = win.setInterval(() => {
      // A resting pointer fires no mousemove events, so sample its last position here.
      // Without this, dwells — the pointer holding still — leave no samples, and the
      // position the throttle dropped just before the pointer stopped is never recorded.
      const now = Date.now()
      if (this.lastPointer && doc.visibilityState !== 'hidden' && now - this.lastSampleTime >= SAMPLE_INTERVAL_MS) {
        record(now)
      }
      if (this.buffer.length > 0) {
        this.onBatch([...this.buffer])
        this.buffer = []
      }
    }, BATCH_INTERVAL_MS) as unknown as number
  }

  stop(): CursorSampleData[] {
    if (this.doc && this.handleMouseMove && this.handleMouseOut) {
      this.doc.removeEventListener('mousemove', this.handleMouseMove)
      this.doc.removeEventListener('mouseout', this.handleMouseOut)
      this.handleMouseMove = null
      this.handleMouseOut = null
      this.doc = null
    }
    this.lastPointer = null
    if (this.intervalId != null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    const remaining = [...this.buffer]
    this.buffer = []
    return remaining
  }
}

function resolveNearestSelector(clientX: number, clientY: number, doc: Document): string | undefined {
  const element =
    typeof doc.elementFromPoint === 'function'
      ? doc.elementFromPoint(clientX, clientY)
      : null

  if (
    !element ||
    element.hasAttribute('data-pointdev') ||
    element.tagName === 'HTML' ||
    element.tagName === 'BODY'
  ) {
    return undefined
  }

  if (element.id) return `#${element.id}`

  let tag = element.tagName.toLowerCase()
  if (element.className && typeof element.className === 'string') {
    tag += '.' + element.className.trim().split(/\s+/).slice(0, 2).join('.')
  }
  return tag
}
