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

  constructor(onBatch: (samples: CursorSampleData[]) => void) {
    this.onBatch = onBatch
  }

  start(captureStartedAt: number, doc: Document, win: Window): void {
    this.buffer = []
    this.doc = doc

    this.handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - this.lastSampleTime < SAMPLE_INTERVAL_MS) return
      this.lastSampleTime = now

      const pageX = e.clientX + win.scrollX
      const pageY = e.clientY + win.scrollY

      const nearestSelector = resolveNearestSelector(e.clientX, e.clientY, doc)

      this.buffer.push({
        x: pageX,
        y: pageY,
        timestampMs: now - captureStartedAt,
        nearestElement: nearestSelector,
      })
    }

    doc.addEventListener('mousemove', this.handleMouseMove)

    this.intervalId = win.setInterval(() => {
      if (this.buffer.length > 0) {
        this.onBatch([...this.buffer])
        this.buffer = []
      }
    }, BATCH_INTERVAL_MS) as unknown as number
  }

  stop(): CursorSampleData[] {
    if (this.doc && this.handleMouseMove) {
      this.doc.removeEventListener('mousemove', this.handleMouseMove)
      this.handleMouseMove = null
      this.doc = null
    }
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
