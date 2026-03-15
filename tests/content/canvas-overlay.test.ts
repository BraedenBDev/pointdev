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

describe('CanvasOverlay', () => {
  it('creates canvas with correct attributes', () => {
    const mockDoc = {
      createElement: vi.fn(() => createMockCanvas()),
      body: { appendChild: vi.fn() },
    }
    const overlay = new CanvasOverlay(mockDoc as any, { innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0 } as any)
    expect(mockDoc.createElement).toHaveBeenCalledWith('canvas')
  })

  it('records circle annotation on draw complete', () => {
    const canvas = createMockCanvas()
    const mockDoc = {
      createElement: vi.fn(() => canvas),
      body: { appendChild: vi.fn() },
      elementsFromPoint: vi.fn(() => []),
    }
    const overlay = new CanvasOverlay(mockDoc as any, { innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0 } as any)
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
    const overlay = new CanvasOverlay(mockDoc as any, { innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0 } as any)
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
    const overlay = new CanvasOverlay(mockDoc as any, { innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0 } as any)
    overlay.setMode('select')

    const annotation = overlay.completeAnnotation(
      { clientX: 100, clientY: 200 },
      { clientX: 150, clientY: 250 },
      1000, 2300
    )
    expect(annotation).toBeNull()
  })
})
