import { describe, it, expect } from 'vitest'
import { formatSession } from '../../src/shared/formatter'
import type { CaptureSession } from '@shared/types'

function makeSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: 'test-1',
    tabId: 1,
    startedAt: 1000,
    url: 'https://example.com/page',
    title: 'Example Page',
    viewport: { width: 1200, height: 800 },
    selectedElement: null,
    voiceRecording: null,
    annotations: [],
    cursorTrace: [],
    screenshot: null,
    ...overrides,
  }
}

describe('formatSession', () => {
  it('formats context section for minimal session', () => {
    const output = formatSession(makeSession())
    expect(output).toContain('## Context')
    expect(output).toContain('URL: https://example.com/page')
    expect(output).toContain('Page title: Example Page')
    expect(output).toContain('Viewport: 1200 x 800px')
  })

  it('omits Target Element section when no element selected', () => {
    const output = formatSession(makeSession())
    expect(output).not.toContain('## Target Element')
  })

  it('includes Target Element when element is selected', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div.hero > h1',
        computedStyles: { 'font-size': '32px', 'color': 'rgb(0, 0, 0)' },
        domSubtree: '<h1 class="title">Hello World</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).toContain('## Target Element')
    expect(output).toContain('Selector: div.hero > h1')
    expect(output).toContain('font-size: 32px')
  })

  it('includes React component name when detected', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div.hero > h1',
        computedStyles: {},
        domSubtree: '<h1>Hello</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
        reactComponent: { name: 'HeroSection', filePath: 'src/Hero.tsx' },
      },
    }))
    expect(output).toContain('React Component: <HeroSection> (src/Hero.tsx)')
  })

  it('omits React Component line when not detected', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div > h1',
        computedStyles: {},
        domSubtree: '<h1>Hello</h1>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).not.toContain('React Component')
  })

  it('formats voice transcript with timestamps', () => {
    const output = formatSession(makeSession({
      voiceRecording: {
        transcript: 'the font is too small',
        durationMs: 5000,
        segments: [
          { text: 'the font is too small', startMs: 23000, endMs: 25000 },
        ],
      },
    }))
    expect(output).toContain('## User Intent (voice transcript)')
    expect(output).toContain('[00:23]')
    expect(output).toContain('"the font is too small"')
  })

  it('omits voice section when no recording', () => {
    const output = formatSession(makeSession())
    expect(output).not.toContain('## User Intent')
  })

  it('formats circle annotations', () => {
    const output = formatSession(makeSession({
      annotations: [{
        type: 'circle',
        coordinates: { centerX: 340, centerY: 180, radiusX: 85, radiusY: 85 },
        timestampMs: 2300,
        nearestElement: 'div.hero > h1',
      }],
    }))
    expect(output).toContain('## Annotations')
    expect(output).toContain('Circle around div.hero > h1')
  })

  it('formats arrow annotations', () => {
    const output = formatSession(makeSession({
      annotations: [{
        type: 'arrow',
        coordinates: { startX: 100, startY: 200, endX: 300, endY: 400 },
        timestampMs: 3000,
        nearestElement: 'nav > a',
      }],
    }))
    expect(output).toContain('Arrow')
    expect(output).toContain('nav > a')
  })

  it('omits Annotations section when no annotations', () => {
    const output = formatSession(makeSession())
    expect(output).not.toContain('## Annotations')
  })

  it('formats cursor dwells', () => {
    const output = formatSession(makeSession({
      cursorTrace: [
        { x: 340, y: 180, timestampMs: 2200, nearestElement: 'div.hero > h1', dwellMs: 3100 },
      ],
    }))
    expect(output).toContain('## Cursor Behavior')
    expect(output).toContain('div.hero > h1')
    expect(output).toContain('3.1s')
  })

  it('omits cursor section when no dwells', () => {
    const output = formatSession(makeSession({
      cursorTrace: [
        { x: 100, y: 200, timestampMs: 500 }, // no dwellMs = not a dwell
      ],
    }))
    expect(output).not.toContain('## Cursor Behavior')
  })

  it('suppresses cursor dwells that overlap with annotations', () => {
    const output = formatSession(makeSession({
      annotations: [{
        type: 'circle',
        coordinates: { centerX: 340, centerY: 180, radiusX: 85, radiusY: 85 },
        timestampMs: 2300,
        nearestElement: 'div.hero > h1',
      }],
      cursorTrace: [
        { x: 340, y: 180, timestampMs: 2200, nearestElement: 'div.hero > h1', dwellMs: 3100 },
      ],
    }))
    // Dwell on same element as annotation should be suppressed
    expect(output).not.toContain('## Cursor Behavior')
  })

  it('reconstructs shorthand padding when all sides equal', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div',
        computedStyles: {
          'padding-top': '8px',
          'padding-right': '8px',
          'padding-bottom': '8px',
          'padding-left': '8px',
        },
        domSubtree: '<div></div>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).toContain('padding: 8px')
    expect(output).not.toContain('padding-top')
  })

  it('truncates long DOM subtrees', () => {
    const longHtml = '<div class="wrapper">' + '<span>x</span>'.repeat(100) + '</div>'
    const output = formatSession(makeSession({
      selectedElement: {
        selector: 'div',
        computedStyles: {},
        domSubtree: longHtml,
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).toContain('<!-- truncated -->')
    // Should not exceed ~550 chars for the DOM line
    const domLine = output.split('\n').find(l => l.startsWith('- DOM:'))
    expect(domLine!.length).toBeLessThan(600)
  })
})
