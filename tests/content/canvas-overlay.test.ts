import { describe, it, expect, vi } from 'vitest'
import { CanvasOverlay } from '../../src/content/canvas-overlay'

// Minimal canvas mock
function createMockCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    strokeRect: vi.fn(),
    set strokeStyle(v: string) {},
    set fillStyle(v: string) {},
    set lineWidth(v: number) {},
  }
  return {
    getContext: vi.fn(() => ctx),
    setAttribute: vi.fn(),
    style: {} as any,
    width: 1200,
    height: 800,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    ctx,
  }
}

function createMockWindow(scrollX = 0, scrollY = 0) {
  return {
    innerWidth: 1200,
    innerHeight: 800,
    scrollX,
    scrollY,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    requestAnimationFrame: vi.fn((cb: () => void) => { cb(); return 1 }),
    cancelAnimationFrame: vi.fn(),
  } as any
}

describe('CanvasOverlay', () => {
  it('creates canvas with correct attributes', () => {
    const mockDoc = {
      createElement: vi.fn(() => createMockCanvas()),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    expect(mockDoc.createElement).toHaveBeenCalledWith('canvas')
  })

  it('records circle annotation on draw complete', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
      elementsFromPoint: vi.fn(() => []),
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('circle')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 }, // start
      { clientX: 150, clientY: 250 }, // end
      1000, // captureStartedAt
      2300  // now
    )

    expect(annotation).toBeTruthy()
    expect(annotation!.type).toBe('circle')
  })

  it('records arrow annotation on draw complete', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
      elementsFromPoint: vi.fn(() => []),
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('arrow')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 },
      { clientX: 300, clientY: 400 },
      1000,
      3000
    )

    expect(annotation).toBeTruthy()
    expect(annotation!.type).toBe('arrow')
  })

  it('returns null for select mode', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('select')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 },
      { clientX: 150, clientY: 250 },
      1000, 2300
    )
    expect(annotation).toBeNull()
  })

  it('stores page-relative coords and draws viewport-relative', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const mockWin = createMockWindow(100, 200) // scrolled 100x, 200y
    const overlay = new CanvasOverlay(mockDoc as any, mockWin)
    overlay.setMode('circle')

    const annotation = overlay.completeAnnotation(
      { clientX: 50, clientY: 60 },
      { clientX: 80, clientY: 90 },
      1000, 2000
    )

    // Annotation data coordinates should be page-relative (viewport + scroll)
    expect(annotation!.coordinates).toEqual({
      centerX: 150, // 50 + 100
      centerY: 260, // 60 + 200
      radiusX: 30,
      radiusY: 30,
    })

    // The ellipse drawn should be viewport-relative (page coords - current scroll)
    // After completeAnnotation calls redraw, ellipse should be at (50, 60) = (150-100, 260-200)
    expect(canvas.ctx.ellipse).toHaveBeenCalledWith(50, 60, 30, 30, 0, 0, Math.PI * 2)
  })

  it('registers and cleans up scroll listener', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const mockWin = createMockWindow()
    const overlay = new CanvasOverlay(mockDoc as any, mockWin)

    expect(mockWin.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })

    overlay.destroy()
    expect(mockWin.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
  })

  it('records rectangle annotation on draw complete', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('rectangle')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 },
      { clientX: 250, clientY: 350 },
      1000, 2000
    )

    expect(annotation).toBeTruthy()
    expect(annotation!.type).toBe('rectangle')
    const coords = annotation!.coordinates as any
    expect(coords.width).toBe(150)
    expect(coords.height).toBe(150)
  })

  it('rejects rectangle smaller than 10px', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('rectangle')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 },
      { clientX: 105, clientY: 205 },
      1000, 2000
    )
    expect(annotation).toBeNull()
  })

  it('rejects thin rectangle sliver', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('rectangle')

    // 3px wide, 200px tall — should be rejected (either dimension < 10px)
    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 100 },
      { clientX: 103, clientY: 300 },
      1000, 2000
    )
    expect(annotation).toBeNull()
  })

  it('records freehand annotation', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('freehand')

    const points = [
      { clientX: 100, clientY: 200 },
      { clientX: 110, clientY: 210 },
      { clientX: 120, clientY: 220 },
      { clientX: 130, clientY: 230 },
    ]
    const annotation = overlay.completeFreehandAnnotation(points, 1000, 2000)

    expect(annotation).toBeTruthy()
    expect(annotation!.type).toBe('freehand')
    const coords = annotation!.coordinates as any
    expect(coords.points).toHaveLength(4)
  })

  it('rejects freehand with fewer than 3 points', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, createMockWindow())
    overlay.setMode('freehand')

    const annotation = overlay.completeFreehandAnnotation(
      [{ clientX: 100, clientY: 200 }, { clientX: 110, clientY: 210 }],
      1000, 2000
    )
    expect(annotation).toBeNull()
  })
})
