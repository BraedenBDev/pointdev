import { describe, it, expect, vi } from 'vitest'
import { collectDeviceMetadata, parseBrowser } from '../../src/content/device-metadata'

describe('parseBrowser', () => {
  it('detects Chrome', () => {
    const result = parseBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    expect(result.name).toBe('Chrome')
    expect(result.version).toBe('120.0.0.0')
  })

  it('detects Edge', () => {
    const result = parseBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0')
    expect(result.name).toBe('Edge')
    expect(result.version).toBe('120.0.0.0')
  })

  it('detects Firefox', () => {
    const result = parseBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0')
    expect(result.name).toBe('Firefox')
    expect(result.version).toBe('121.0')
  })

  it('returns unknown for unrecognized UA', () => {
    const result = parseBrowser('SomeBot/1.0')
    expect(result.name).toBe('Unknown')
  })
})

describe('collectDeviceMetadata', () => {
  it('collects metadata from window and navigator', () => {
    const mockWindow = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        language: 'en-US',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      },
      screen: { width: 2560, height: 1440 },
      innerWidth: 1280,
      innerHeight: 800,
      outerWidth: 1440,
      outerHeight: 900,
      devicePixelRatio: 2,
      matchMedia: vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
      })),
    }

    const result = collectDeviceMetadata(mockWindow as any)

    expect(result.userAgent).toContain('Chrome/120')
    expect(result.browser.name).toBe('Chrome')
    expect(result.browser.version).toBe('120.0.0.0')
    expect(result.os).toBe('MacIntel')
    expect(result.language).toBe('en-US')
    expect(result.screen).toEqual({ width: 2560, height: 1440 })
    expect(result.window).toEqual({ innerWidth: 1280, innerHeight: 800, outerWidth: 1440, outerHeight: 900 })
    expect(result.devicePixelRatio).toBe(2)
    expect(result.touchSupport).toBe(false)
    expect(result.colorScheme).toBe('dark')
  })

  it('detects touch support', () => {
    const mockWindow = {
      navigator: {
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        language: 'en',
        platform: 'Linux',
        maxTouchPoints: 5,
      },
      screen: { width: 1920, height: 1080 },
      innerWidth: 1920,
      innerHeight: 1080,
      outerWidth: 1920,
      outerHeight: 1080,
      devicePixelRatio: 1,
      matchMedia: vi.fn(() => ({ matches: false })),
    }

    const result = collectDeviceMetadata(mockWindow as any)
    expect(result.touchSupport).toBe(true)
  })

  it('detects light color scheme', () => {
    const mockWindow = {
      navigator: {
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
        language: 'en',
        platform: 'Win32',
        maxTouchPoints: 0,
      },
      screen: { width: 1920, height: 1080 },
      innerWidth: 1920,
      innerHeight: 1080,
      outerWidth: 1920,
      outerHeight: 1080,
      devicePixelRatio: 1,
      matchMedia: vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: light)',
      })),
    }

    const result = collectDeviceMetadata(mockWindow as any)
    expect(result.colorScheme).toBe('light')
  })
})
