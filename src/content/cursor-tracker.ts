import type { CursorSampleData } from '@shared/types'

const SAMPLE_INTERVAL_MS = 100
const BATCH_INTERVAL_MS = 500

export class CursorTracker {
  private buffer: CursorSampleData[] = []
  private intervalId: number | null = null
  private lastSampleTime = 0
  private captureStartedAt = 0
  private currentPosition = { x: 0, y: 0 }
  private onBatch: (samples: CursorSampleData[]) => void

  constructor(onBatch: (samples: CursorSampleData[]) => void) {
    this.onBatch = onBatch
  }

  start(captureStartedAt: number, doc: Document, win: Window): void {
    this.captureStartedAt = captureStartedAt
    this.buffer = []

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - this.lastSampleTime < SAMPLE_INTERVAL_MS) return
      this.lastSampleTime = now

      const pageX = e.clientX + win.scrollX
      const pageY = e.clientY + win.scrollY
      this.currentPosition = { x: pageX, y: pageY }

      // Resolve nearest element and generate selector inline
      let nearestSelector: string | undefined
      const element =
        typeof doc.elementFromPoint === 'function'
          ? doc.elementFromPoint(e.clientX, e.clientY)
          : null
      if (
        element &&
        !element.hasAttribute('data-pointdev') &&
        element.tagName !== 'HTML' &&
        element.tagName !== 'BODY'
      ) {
        if (element.id) {
          nearestSelector = `#${element.id}`
        } else {
          let tag = element.tagName.toLowerCase()
          if (element.className && typeof element.className === 'string') {
            tag += '.' + element.className.trim().split(/\s+/).slice(0, 2).join('.')
          }
          nearestSelector = tag
        }
      }

      this.buffer.push({
        x: pageX,
        y: pageY,
        timestampMs: now - captureStartedAt,
        nearestElement: nearestSelector,
      })
    }

    doc.addEventListener('mousemove', handleMouseMove)

    this.intervalId = win.setInterval(() => {
      if (this.buffer.length > 0) {
        this.onBatch([...this.buffer])
        this.buffer = []
      }
    }, BATCH_INTERVAL_MS) as unknown as number

    // Store for cleanup
    ;(this as any)._handleMouseMove = handleMouseMove
    ;(this as any)._doc = doc
  }

  stop(): CursorSampleData[] {
    const doc = (this as any)._doc as Document | undefined
    if (doc && (this as any)._handleMouseMove) {
      doc.removeEventListener('mousemove', (this as any)._handleMouseMove)
    }
    if (this.intervalId != null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    // Flush remaining
    const remaining = [...this.buffer]
    this.buffer = []
    return remaining
  }
}
