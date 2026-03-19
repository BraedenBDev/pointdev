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
    device: null,
    selectedElement: null,
    voiceRecording: null,
    annotations: [],
    cursorTrace: [],
    screenshots: [],
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

  it('formats element screenshots with timestamps and dimensions', () => {
    const output = formatSession(makeSession({
      screenshots: [
        { selector: 'div.hero > h1', timestampMs: 5000, dataUrl: 'data:image/png;base64,abc', width: 340, height: 50 },
        { selector: 'nav > a.pricing', timestampMs: 12000, dataUrl: 'data:image/png;base64,xyz', width: 120, height: 30 },
      ],
    }))
    expect(output).toContain('## Screenshots')
    expect(output).toContain('1. [00:05] div.hero > h1 (340x50px)')
    expect(output).toContain('2. [00:12] nav > a.pricing (120x30px)')
    expect(output).not.toContain('base64,abc')
    expect(output).not.toContain('base64,xyz')
  })

  it('omits Screenshots section when no screenshots', () => {
    const output = formatSession(makeSession())
    expect(output).not.toContain('## Screenshots')
  })

  it('includes Device section when device metadata is present', () => {
    const output = formatSession(makeSession({
      device: {
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        browser: { name: 'Chrome', version: '120.0.0.0' },
        os: 'MacIntel',
        language: 'en-US',
        screen: { width: 2560, height: 1440 },
        window: { innerWidth: 1280, innerHeight: 800, outerWidth: 1440, outerHeight: 900 },
        devicePixelRatio: 2,
        touchSupport: false,
        colorScheme: 'dark',
      },
    }))
    expect(output).toContain('## Device')
    expect(output).toContain('Browser: Chrome 120.0.0.0')
    expect(output).toContain('OS: MacIntel')
    expect(output).toContain('Screen: 2560 x 1440px')
    expect(output).toContain('Pixel ratio: 2x')
    expect(output).toContain('Language: en-US')
    expect(output).toContain('Color scheme: dark')
    expect(output).not.toContain('Touch')
  })

  it('omits Device section when no device metadata', () => {
    const output = formatSession(makeSession())
    expect(output).not.toContain('## Device')
  })

  it('formats CSS variables when present', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: '.card',
        computedStyles: {},
        domSubtree: '<div class="card"></div>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
        cssVariables: { '--primary': '#2563eb', '--spacing': '16px' },
      },
    }))
    expect(output).toContain('CSS Variables: --primary: #2563eb, --spacing: 16px')
  })

  it('omits CSS variables line when none found', () => {
    const output = formatSession(makeSession({
      selectedElement: {
        selector: '.card',
        computedStyles: {},
        domSubtree: '<div class="card"></div>',
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0, toJSON: () => ({}) },
      },
    }))
    expect(output).not.toContain('CSS Variables')
  })

  it('shows touch support when enabled', () => {
    const output = formatSession(makeSession({
      device: {
        userAgent: 'Mozilla/5.0',
        browser: { name: 'Chrome', version: '120' },
        os: 'Linux',
        language: 'en',
        screen: { width: 1920, height: 1080 },
        window: { innerWidth: 1920, innerHeight: 1080, outerWidth: 1920, outerHeight: 1080 },
        devicePixelRatio: 1,
        touchSupport: true,
        colorScheme: 'unknown',
      },
    }))
    expect(output).toContain('Touch: supported')
    expect(output).not.toContain('Color scheme')
  })
})
