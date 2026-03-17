import type { AnnotationData } from '@shared/types'
import type { CaptureMode } from '@shared/messages'

const STROKE_COLOR = '#FF3333'
const STROKE_WIDTH = 2
const ARROW_HEAD_SIZE = 12

interface Point { clientX: number; clientY: number }

interface StoredCircle { type: 'circle'; cx: number; cy: number; rx: number; ry: number }
interface StoredArrow { type: 'arrow'; sx: number; sy: number; ex: number; ey: number }
type StoredAnnotation = StoredCircle | StoredArrow

export class CanvasOverlay {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private mode: CaptureMode = 'select'
  private doc: Document
  private win: Window
  // Stored as page-relative coordinates (viewport + scroll at draw time)
  private drawnAnnotations: StoredAnnotation[] = []
  private scrollRAF: number | null = null
  private boundOnScroll: () => void
  // Track in-progress preview so scroll redraws can preserve it
  private currentPreview: { type: 'circle' | 'arrow'; start: Point; current: Point } | null = null

  constructor(doc: Document, win: Window) {
    this.doc = doc
    this.win = win

    this.canvas = doc.createElement('canvas')
    this.canvas.setAttribute('data-pointdev', 'overlay')
    this.canvas.width = win.innerWidth
    this.canvas.height = win.innerHeight

    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483647',
      pointerEvents: 'none',
      cursor: 'crosshair',
    })

    this.ctx = this.canvas.getContext('2d')!
    doc.body.appendChild(this.canvas)

    // Redraw on scroll so annotations follow the page content
    this.boundOnScroll = () => {
      if (this.scrollRAF) return
      this.scrollRAF = win.requestAnimationFrame(() => {
        this.scrollRAF = null
        this.redraw()
      })
    }
    win.addEventListener('scroll', this.boundOnScroll, { passive: true })
  }

  setMode(mode: CaptureMode): void {
    this.mode = mode
    this.canvas.style.pointerEvents = mode === 'select' ? 'none' : 'all'
  }

  getMode(): CaptureMode {
    return this.mode
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  drawCirclePreview(start: Point, current: Point): void {
    this.currentPreview = { type: 'circle', start, current }
    this.redraw()
  }

  drawArrowPreview(start: Point, current: Point): void {
    this.currentPreview = { type: 'arrow', start, current }
    this.redraw()
  }

  completeAnnotation(
    start: Point,
    end: Point,
    captureStartedAt: number,
    now: number
  ): AnnotationData | null {
    if (this.mode === 'select') return null

    this.currentPreview = null
    const scrollX = this.win.scrollX
    const scrollY = this.win.scrollY
    const timestampMs = now - captureStartedAt

    if (this.mode === 'circle') {
      const cx = start.clientX
      const cy = start.clientY
      const rx = Math.abs(end.clientX - start.clientX)
      const ry = Math.abs(end.clientY - start.clientY)

      if (rx < 5 && ry < 5) return null // too small

      // Store page-relative so annotations follow the page on scroll
      this.drawnAnnotations.push({ type: 'circle', cx: cx + scrollX, cy: cy + scrollY, rx, ry })
      this.redraw()

      return {
        type: 'circle' as const,
        coordinates: { centerX: cx + scrollX, centerY: cy + scrollY, radiusX: rx, radiusY: ry },
        timestampMs,
      }
    }

    if (this.mode === 'arrow') {
      const sx = start.clientX, sy = start.clientY
      const ex = end.clientX, ey = end.clientY

      const dist = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
      if (dist < 10) return null // too small

      // Store page-relative so annotations follow the page on scroll
      this.drawnAnnotations.push({
        type: 'arrow', sx: sx + scrollX, sy: sy + scrollY, ex: ex + scrollX, ey: ey + scrollY,
      })
      this.redraw()

      return {
        type: 'arrow' as const,
        coordinates: { startX: sx + scrollX, startY: sy + scrollY, endX: ex + scrollX, endY: ey + scrollY },
        timestampMs,
      }
    }

    return null
  }

  private redraw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.applyStrokeStyle()
    const sx = this.win.scrollX
    const sy = this.win.scrollY
    for (const ann of this.drawnAnnotations) {
      if (ann.type === 'circle') {
        this.drawEllipse(ann.cx - sx, ann.cy - sy, ann.rx, ann.ry)
      } else {
        this.drawArrow(ann.sx - sx, ann.sy - sy, ann.ex - sx, ann.ey - sy)
      }
    }
    // Re-render in-progress preview so it survives scroll redraws
    if (this.currentPreview) {
      const { type, start, current } = this.currentPreview
      if (type === 'circle') {
        this.drawEllipse(start.clientX, start.clientY,
          Math.abs(current.clientX - start.clientX), Math.abs(current.clientY - start.clientY))
      } else {
        this.drawArrow(start.clientX, start.clientY, current.clientX, current.clientY)
      }
    }
  }

  private applyStrokeStyle(): void {
    this.ctx.strokeStyle = STROKE_COLOR
    this.ctx.fillStyle = STROKE_COLOR
    this.ctx.lineWidth = STROKE_WIDTH
  }

  private drawEllipse(cx: number, cy: number, rx: number, ry: number): void {
    this.ctx.beginPath()
    this.ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
    this.ctx.stroke()
  }

  private drawArrow(sx: number, sy: number, ex: number, ey: number): void {
    this.ctx.beginPath()
    this.ctx.moveTo(sx, sy)
    this.ctx.lineTo(ex, ey)
    this.ctx.stroke()

    const angle = Math.atan2(ey - sy, ex - sx)
    this.ctx.save()
    this.ctx.translate(ex, ey)
    this.ctx.rotate(angle)
    this.ctx.beginPath()
    this.ctx.moveTo(0, 0)
    this.ctx.lineTo(-ARROW_HEAD_SIZE, -ARROW_HEAD_SIZE / 2)
    this.ctx.lineTo(-ARROW_HEAD_SIZE, ARROW_HEAD_SIZE / 2)
    this.ctx.fill()
    this.ctx.restore()
  }

  destroy(): void {
    this.win.removeEventListener('scroll', this.boundOnScroll)
    if (this.scrollRAF) {
      this.win.cancelAnimationFrame(this.scrollRAF)
    }
    this.canvas.remove()
  }
}
